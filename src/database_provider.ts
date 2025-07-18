/**
 * Database Provider for CurrencyX using Lucid ORM
 */

import type { BaseModel } from '@adonisjs/lucid/orm'
import type {
  CurrencyCode,
  ConversionResult,
  ExchangeRatesResult,
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
  private cache?: CacheService
  private cacheConfig?: {
    ttl: number
    prefix: string
  }

  constructor(config: DatabaseConfig, app?: any) {
    super()

    this.columns = {
      code: config.columns?.code || 'code',
      rate: config.columns?.rate || 'rate',
      base: config.columns?.base || 'base',
      updatedAt: config.columns?.updatedAt || 'updated_at',
    }

    // Setup cache if configured
    if (config.cache && typeof config.cache === 'object') {
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

    try {
      this.cacheConfig = {
        ttl: cacheConfig.ttl || 3600,
        prefix: cacheConfig.prefix || 'currency',
      }

      const store = cacheConfig.store || 'redis'

      if (store === 'cache') {
        // Try to use @adonisjs/cache first
        try {
          const cache = await app.container.make('cache.manager')
          this.cache = cache
        } catch {
          // Fallback to direct redis if cache not available
          const redis = await app.container.make('redis')
          this.cache = redis
        }
      } else {
        // Use @adonisjs/redis directly
        const redis = await app.container.make('redis')
        this.cache = redis
      }
    } catch (error) {
      // Cache is optional, continue without it
      console.warn('Cache setup failed, continuing without cache:', error.message)
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
    if (!this.cache) return null

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
    if (!this.cache || !this.cacheConfig) return

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
  async convert(amount: number, from: CurrencyCode, to: CurrencyCode): Promise<ConversionResult> {
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
  async latestRates(symbols?: CurrencyCode[]): Promise<ExchangeRatesResult> {
    return this.getExchangeRates(this.base, symbols)
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
   */
  private async getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    const Model = await this.getModel()

    // Try direct rate first (from -> to)
    const directRate = (await Model.query()
      .where(this.columns.code, to)
      .where(this.columns.base, from)
      .first()) as CurrencyRecord | null

    if (directRate && directRate[this.columns.rate]) {
      return Number(directRate[this.columns.rate])
    }

    // Try inverse rate (to -> from)
    const inverseRate = (await Model.query()
      .where(this.columns.code, from)
      .where(this.columns.base, to)
      .first()) as CurrencyRecord | null

    if (inverseRate && inverseRate[this.columns.rate]) {
      return 1 / Number(inverseRate[this.columns.rate])
    }

    // Try cross rate via base currency (USD typically)
    const fromToBase = (await Model.query()
      .where(this.columns.code, from)
      .first()) as CurrencyRecord | null

    const toToBase = (await Model.query()
      .where(this.columns.code, to)
      .first()) as CurrencyRecord | null

    if (fromToBase && toToBase && fromToBase[this.columns.rate] && toToBase[this.columns.rate]) {
      const fromRate = Number(fromToBase[this.columns.rate])
      const toRate = Number(toToBase[this.columns.rate])
      return toRate / fromRate
    }

    throw new Error(`Exchange rate not found for ${from} to ${to}`)
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

      if (base) {
        query = query.where(this.columns.base, base)
      }

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
