import type {
  CurrencyCode,
  ConversionResult,
  ExchangeRatesResult,
  ConvertParams,
  ExchangeRatesParams,
} from '@mixxtor/currencyx-js'
import { BaseCurrencyExchange } from '@mixxtor/currencyx-js'
import type { DatabaseConfig, CacheConfig } from '../types.js'
import type { CacheService } from '@adonisjs/cache/types'
import { PROVIDER_CURRENCY_MODEL } from '../symbols.js'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export class DatabaseExchange<Model extends LucidModel = LucidModel> extends BaseCurrencyExchange {
  declare [PROVIDER_CURRENCY_MODEL]: InstanceType<Model>

  readonly name = 'database'

  protected model?: Model
  private columns: NonNullable<DatabaseConfig<Model>['columns']>
  private configModel?: DatabaseConfig<Model>['model']
  private cacheService?: CacheConfig['service']
  private cache?: CacheService
  private cacheConfig?: CacheConfig
  private cacheSetupPromise?: Promise<void>
  private config: DatabaseConfig<Model>

  constructor(config: DatabaseConfig<Model>) {
    super()

    this.config = config
    this.columns = {
      ...config.columns,
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
    this.model = 'default' in importedModel ? importedModel.default : importedModel
    return this.model
  }

  /**
   * Imports the cache service from the provider, returns and caches it
   * for further operations.
   */
  protected async getCacheService() {
    if (!this.cacheService) {
      throw new Error('Currency cache not configured')
    }

    if (this.cache && !('hot' in import.meta)) {
      return this.cache
    }

    const importedCache = await this.cacheService()
    this.cache = 'default' in importedCache ? importedCache.default : importedCache
    return this.cache
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
    if (cacheConfig === false || !cacheConfig) {
      return
    }

    try {
      this.cacheConfig = cacheConfig
      this.cache = await this.getCacheService()
    } catch (error) {
      console.warn('Cache setup failed, continuing without cache:', error.message)
    }
  }

  /**
   * Convert currency using database rates
   */
  async convert(params: ConvertParams): Promise<ConversionResult> {
    const { amount, from, to } = params
    const result: ConversionResult = {
      success: false,
      query: { from, to, amount },
      info: { timestamp: Date.now(), rate: 1 },
      date: new Date().toISOString(),
      result: amount,
    }

    if (from === to) {
      result.success = true
      return result
    }

    try {
      const currencies = await this.#currencyList()
      const fromCurrency = currencies?.find((c) => c[this.columns.code as keyof typeof c] === from)
      const toCurrency = currencies?.find((c) => c[this.columns.code as keyof typeof c] === to)
      const updatedAt = currencies?.[0]?.[
        this.columns.updated_at as keyof (typeof currencies)[number]
      ] as string

      const fromRate = fromCurrency?.[this.columns.rate as keyof typeof fromCurrency] as number
      const toRate = toCurrency?.[this.columns.rate as keyof typeof toCurrency] as number
      if (fromRate && toRate) {
        // Conversion formula: amount * (1/fromCurrencyRate) * toCurrencyRate
        const convertRate = (1 / fromRate) * toRate
        const convertAmount = amount * convertRate
        result.success = true
        result.query = { from, to, amount }
        result.info.rate = convertRate
        result.info.timestamp = new Date(updatedAt).getTime()
        result.date = new Date(updatedAt).toISOString()
        result.result = convertAmount
      }

      return result
    } catch (error) {
      return {
        success: false,
        query: { from, to, amount },
        info: { timestamp: Date.now() },
        date: new Date().toISOString(),
        error: {
          info: error.message,
        },
      }
    }
  }

  async #currencyList(refresh = true) {
    // Ensure cache is setup before using it
    await this.#ensureCacheSetup()

    const Model = await this.getModel()
    const query = Model.query().select(Object.values(this.columns))

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
    const { base = this.base, codes: currencyCodes, cache } = params || {}
    const result: ExchangeRatesResult = {
      success: false,
      timestamp: new Date().getTime(),
      date: new Date().toISOString(),
      base: base,
      rates: {} as Record<CurrencyCode, number>,
      error: undefined,
    }

    try {
      const currencies = await this.#currencyList(!cache)
      for (const record of currencies ?? []) {
        const code = record[this.columns.code as keyof typeof record] as string
        const rate = record[this.columns.rate as keyof typeof record] as number
        const updatedAt = record[this.columns.updated_at as keyof typeof record] as string
        const updatedAtDate = updatedAt ? new Date(updatedAt) : undefined
        if (!code || !currencyCodes?.length || currencyCodes?.includes(code)) {
          result.rates[code] = rate

          // Update latest date
          if (updatedAtDate && updatedAtDate > (result.date as unknown as Date)) {
            result.date = updatedAtDate?.toISOString()
            result.timestamp = updatedAtDate.getTime()
          }
        }
      }

      result.success = true
    } catch (error) {
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
      const currencies = await this.#currencyList()
      const fromCurrency = currencies?.find((c) => c[this.columns.code as keyof typeof c] === from)
      const toCurrency = currencies?.find((c) => c[this.columns.code as keyof typeof c] === to)

      const fromRate = fromCurrency?.[this.columns.rate as keyof typeof fromCurrency] as number
      const toRate = toCurrency?.[this.columns.rate as keyof typeof toCurrency] as number
      if (fromRate && toRate) {
        const convertRate = (1 / fromRate) * toRate
        return convertRate
      }
    } catch {
      return undefined
    }
  }
}
