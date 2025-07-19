/**
 * Database Provider for CurrencyX using Lucid ORM
 */

import type { BaseModel } from '@adonisjs/lucid/orm'
import type {
  CurrencyCode,
  ConversionResult,
  ExchangeRatesResult,
  ConvertParams,
  ExchangeRatesParams,
  HealthCheckResult,
} from '@mixxtor/currencyx-js'
import { BaseCurrencyProvider } from '@mixxtor/currencyx-js'
import type { DatabaseConfig, CurrencyRecord, CacheConfig } from './types.js'
import type { CacheService } from '@adonisjs/cache/types'
import type { ApplicationService } from '@adonisjs/core/types'

export class DatabaseProvider extends BaseCurrencyProvider {
  readonly name = 'database'

  private model: typeof BaseModel | null = null
  private columns: Required<NonNullable<DatabaseConfig['columns']>>
  private baseCurrency: string
  private cache?: CacheService
  private cacheEnabled: boolean = false
  private cacheConfig?: {
    ttl: number
    prefix: string
  }

  constructor(config: DatabaseConfig, app?: any) {
    super()

    this.columns = {
      code: config.columns?.code || 'code',
      rate: config.columns?.rate || 'exchange_rate',
    }

    this.baseCurrency = config.base || 'USD'

    // Setup cache if configured
    if (config.cache !== false && config.cache) {
      this.setupCache(config.cache, app)
    }

    // Load model asynchronously
    this.loadModel(config.model)
  }

  /**
   * Setup cache based on configuration
   */
  private async setupCache(cacheConfig: CacheConfig, app?: ApplicationService): Promise<void> {
    if (!app) return

    // Check if cache is enabled
    this.cacheEnabled = cacheConfig.enabled !== false // Default to true

    if (!this.cacheEnabled) {
      return
    }

    try {
      this.cacheConfig = {
        ttl: cacheConfig.ttl || 3600,
        prefix: cacheConfig.prefix || 'currency',
      }

      // Use @adonisjs/cache
      const cacheManager = await app.container.make('cache')
      this.cache = cacheManager
    } catch (error) {
      // Cache is optional, continue without it
      console.warn('Cache setup failed, continuing without cache:', error.message)
      this.cacheEnabled = false
    }
  }

  /**
   * Load the Lucid model
   */
  private async loadModel(modelLoader: DatabaseConfig['model']): Promise<void> {
    try {
      this.model = await modelLoader()
    } catch (error) {
      throw new Error(`Failed to load currency model: ${error.message}`)
    }
  }

  /**
   * Get the loaded model instance
   */
  private async getModel(): Promise<typeof BaseModel> {
    if (!this.model) {
      throw new Error('Currency model not loaded. Make sure the model is properly configured.')
    }
    return this.model
  }

  /**
   * Generate cache key
   */
  private getCacheKey(key: string): string {
    const prefix = this.cacheConfig?.prefix || 'currency'
    return `${prefix}:${key}`
  }

  /**
   * Get data from cache
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.cacheEnabled || !this.cacheConfig || !this.cache) return null

    try {
      const cacheKey = this.getCacheKey(key)
      return await this.cache.get({ key: cacheKey })
    } catch (error) {
      // Cache errors should not break the main functionality
      console.warn('Cache get error:', error.message)
      return null
    }
  }

  /**
   * Set data to cache
   */
  private async setToCache<T>(key: string, value: T): Promise<void> {
    if (!this.cacheEnabled || !this.cacheConfig || !this.cache) return

    try {
      const cacheKey = this.getCacheKey(key)
      await this.cache.set({ key: cacheKey, value, ttl: this.cacheConfig.ttl })
    } catch (error) {
      // Cache errors should not break the main functionality
      console.warn('Cache set error:', error.message)
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
      let rate = await this.getFromCache<number>(cacheKey)

      if (!rate) {
        // Get rate from database
        rate = await this.getExchangeRate(from, to)

        // Cache the rate
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
    } catch (error) {
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

  /**
   * Get latest rates (required abstract method)
   */
  async latestRates(params?: ExchangeRatesParams): Promise<ExchangeRatesResult> {
    const symbols = params?.symbols
    const base = params?.base || this.base
    return this.getExchangeRates(base, symbols)
  }

  /**
   * Get convert rate (required abstract method)
   */
  async getConvertRate(from: CurrencyCode, to: CurrencyCode): Promise<number | undefined> {
    try {
      return await this.getExchangeRate(from, to)
    } catch {
      return undefined
    }
  }

  /**
   * Get exchange rate between two currencies
   * Logic: all rates are stored relative to base currency (e.g., USD)
   */
  private async getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    const Model = await this.getModel()

    // Handle base currency conversions
    if (from === this.baseCurrency && to === this.baseCurrency) {
      return 1.0
    }

    if (from === this.baseCurrency) {
      // Converting from base currency to target currency
      const toRate = (await Model.query()
        .where(this.columns.code, to)
        .first()) as CurrencyRecord | null

      if (!toRate || !toRate[this.columns.rate]) {
        throw new Error(`Exchange rate not found for currency: ${to}`)
      }

      return Number(toRate[this.columns.rate])
    }

    if (to === this.baseCurrency) {
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

  /**
   * Get all exchange rates for a base currency
   */
  async getExchangeRates(
    base?: CurrencyCode,
    symbols?: CurrencyCode[]
  ): Promise<ExchangeRatesResult> {
    try {
      const Model = await this.getModel()

      let query = Model.query()

      // Note: base parameter is ignored since we removed base column
      // All rates are assumed to be relative to a common base currency

      if (symbols && symbols.length > 0) {
        query = query.whereIn(this.columns.code, symbols)
      }

      const records = (await query.exec()) as CurrencyRecord[]

      const rates: Record<string, number> = {}

      for (const record of records) {
        const code = record[this.columns.code]
        const rate = record[this.columns.rate]

        if (code && rate) {
          rates[code] = Number(rate)
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        base: base || 'USD',
        rates,
      }
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        date: new Date().toISOString(),
        base: base || 'USD',
        rates: {},
        error: {
          info: error.message,
          type: 'database_error',
        },
      }
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const Model = await this.getModel()

      // Try a simple query to check database connectivity
      await Model.query().limit(1).exec()

      const latency = Date.now() - startTime

      return {
        healthy: true,
        latency,
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      }
    }
  }
}
