import type {
  CurrencyCode,
  ConversionResult,
  ExchangeRatesResult,
  ConvertParams,
  ExchangeRatesParams,
} from '@mixxtor/currencyx-js'
import { BaseCurrencyExchange } from '@mixxtor/currencyx-js'
import type { DatabaseConfig, CurrencyRecord } from '../types.js'
import type { CacheService } from '@adonisjs/cache/types'
import type { ApplicationService } from '@adonisjs/core/types'
import { PROVIDER_CURRENCY_MODEL } from '../symbols.js'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export class DatabaseProvider<Model extends LucidModel = LucidModel> extends BaseCurrencyExchange {
  declare [PROVIDER_CURRENCY_MODEL]: InstanceType<Model>

  readonly name = 'database'

  protected model?: Model
  private columns: NonNullable<DatabaseConfig<Model>['columns']>
  private configModel?: DatabaseConfig<Model>['model']

  private cache?: CacheService
  private cacheConfig?: {
    enabled: boolean
    ttl: number
    prefix: string
  }
  private cacheSetupPromise?: Promise<void>
  private app?: ApplicationService
  private config: DatabaseConfig<Model>

  constructor(config: DatabaseConfig<Model>, app?: ApplicationService) {
    super()

    this.config = config
    this.app = app
    this.columns = {
      code: config.columns?.code || 'code',
      rate: config.columns?.rate || 'exchange_rate',
    }

    this.base = config.base || 'USD'
    this.configModel = config.model
  }

  /**
   * Imports the model from the provider, returns and caches it
   * for further operations.
   */
  protected async getModel() {
    if (!this.configModel) {
      throw new Error('Currency model not configured')
    }

    if (this.model && !('hot' in import.meta)) {
      return this.model
    }

    const importedModel = await this.configModel()
    this.model = importedModel.default
    return this.model
  }

  /**
   * Setup cache based on configuration (lazy initialization)
   */
  async #ensureCacheSetup(): Promise<void> {
    if (this.cacheSetupPromise) {
      return this.cacheSetupPromise
    }

    this.cacheSetupPromise = this.#setupCache()
    return this.cacheSetupPromise
  }

  /**
   * Setup cache based on configuration
   */
  async #setupCache(): Promise<void> {
    const cacheConfig = this.config.cache
    if (!this.app || cacheConfig === false || !cacheConfig) {
      return
    }

    // Check if cache is enabled
    if (!cacheConfig.enabled) {
      return
    }

    try {
      this.cacheConfig = {
        enabled: cacheConfig.enabled,
        ttl: cacheConfig.ttl || 3600,
        prefix: cacheConfig.prefix || 'currency',
      }

      // Use @adonisjs/cache
      const cacheManager = await this.app.container.make('cache')
      this.cache = cacheManager
    } catch (error: any) {
      // Cache is optional, continue without it
      console.warn('Cache setup failed, continuing without cache:', error.message)
    }
  }

  /**
   * Generate cache key
   */
  #getCacheKey(key: string): string {
    const prefix = this.cacheConfig?.prefix || 'currency'
    return `${prefix}:${key}`
  }

  /**
   * Get data from cache
   */
  async #getFromCache<T>(key: string): Promise<T | null> {
    await this.#ensureCacheSetup()

    if (!this.cacheConfig || !this.cacheConfig.enabled || !this.cache) return null

    try {
      const cacheKey = this.#getCacheKey(key)
      return await this.cache.get({ key: cacheKey })
    } catch (error) {
      console.error(error)
      return null
    }
  }

  /**
   * Set data to cache
   */
  private async setToCache<T>(key: string, value: T): Promise<void> {
    await this.#ensureCacheSetup()

    if (!this.cacheConfig || !this.cacheConfig.enabled || !this.cache) return

    try {
      const cacheKey = this.#getCacheKey(key)
      await this.cache.set({ key: cacheKey, value, ttl: this.cacheConfig.ttl })
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Convert currency using database rates
   */
  async convert(params: ConvertParams): Promise<ConversionResult> {
    const { amount, from, to } = params
    if (from === to) {
      return {
        success: true,
        query: { from, to, amount },
        info: { timestamp: Date.now(), rate: 1 },
        date: new Date().toISOString(),
        result: amount,
      }
    }

    try {
      // Try cache first
      const cacheKey = `rate:${from}:${to}`
      let rate = await this.#getFromCache<number>(cacheKey)

      if (!rate) {
        rate = await this.#getExchangeRate(from, to)
        await this.setToCache(cacheKey, rate)
      }

      const result = amount * rate

      return {
        success: true,
        query: { from, to, amount },
        info: { timestamp: Date.now(), rate },
        date: new Date().toISOString(),
        result,
      }
    } catch (error: any) {
      return {
        success: false,
        query: { from, to, amount },
        info: { timestamp: Date.now() },
        date: new Date().toISOString(),
        error: {
          info: error.message,
          type: 'database_error',
        },
      }
    }
  }

  async #currencyList(refresh = true) {
    // Ensure cache is setup before using it
    await this.#ensureCacheSetup()

    const Model = await this.getModel()
    const query = Model.query().select(Object.keys(this.columns))

    if (!refresh || !this.cache || !this.cacheConfig) {
      return await query
    }

    const { prefix = 'currency', ttl = 3600 } = this.cacheConfig

    refresh && (await this.cache.delete({ key: prefix }))

    return await this.cache.getOrSet({ key: prefix, factory: () => query, ttl })
  }

  /**
   * Get latest rates (required abstract method)
   */
  async latestRates(
    params?: ExchangeRatesParams & { cache?: boolean }
  ): Promise<ExchangeRatesResult> {
    const { base = this.base, symbols: currencyCodes, cache } = params || {}
    const result = {
      success: false,
      timestamp: new Date().getTime(),
      date: new Date().toISOString(),
      base: base,
      rates: {} as Record<string, number>,
      error: undefined as { info: string; type: string } | undefined,
    }

    try {
      const currencies = await this.#currencyList(!cache)
      for (const record of currencies ?? []) {
        const code = record[this.columns.code as keyof typeof record] as string
        const rate = record[this.columns.rate as keyof typeof record] as number
        if (!code || !currencyCodes?.length || currencyCodes?.includes(code)) {
          result.rates[code] = rate
        }
      }
      result.success = true
    } catch (error: any) {
      result.error = {
        info: error.message,
        type: 'database_error',
      }
    }

    return result
  }

  /**
   * Get convert rate (required abstract method)
   */
  async getConvertRate(from: CurrencyCode, to: CurrencyCode): Promise<number | undefined> {
    try {
      return await this.#getExchangeRate(from, to)
    } catch {
      return undefined
    }
  }

  /**
   * Get exchange rate between two currencies
   * Logic: all rates are stored relative to base currency (e.g., USD)
   */
  async #getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    const Model = await this.getModel()

    // Handle base currency conversions
    if (from === this.base && to === this.base) {
      return 1.0
    }

    if (from === this.base) {
      // Converting from base currency to target currency
      const toRate = (await Model.query()
        .where(this.columns.code, to)
        .first()) as CurrencyRecord | null

      if (!toRate || !toRate[this.columns.rate]) {
        throw new Error(`Exchange rate not found for currency: ${to}`)
      }

      return Number(toRate[this.columns.rate])
    }

    if (to === this.base) {
      // Converting from target currency to base currency
      const fromRate = (await Model.query()
        .where(this.columns.code, from)
        .first()) as CurrencyRecord | null

      if (!fromRate || !fromRate[this.columns.rate]) {
        throw new Error(`Exchange rate not found for currency: ${from}`)
      }

      return 1 / Number(fromRate[this.columns.rate])
    }

    // Cross rate conversion (neither is base currency)
    const fromRate = (await Model.query()
      .where(this.columns.code, from)
      .first()) as CurrencyRecord | null

    const toRate = (await Model.query()
      .where(this.columns.code, to)
      .first()) as CurrencyRecord | null

    if (!fromRate || !fromRate[this.columns.rate]) {
      throw new Error(`Exchange rate not found for currency: ${from}`)
    }

    if (!toRate || !toRate[this.columns.rate]) {
      throw new Error(`Exchange rate not found for currency: ${to}`)
    }

    // Calculate cross rate: to_rate / from_rate
    const fromRateValue = Number(fromRate[this.columns.rate])
    const toRateValue = Number(toRate[this.columns.rate])

    if (fromRateValue === 0) {
      throw new Error(`Invalid exchange rate for currency: ${from}`)
    }

    return toRateValue / fromRateValue
  }
}
