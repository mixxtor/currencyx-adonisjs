import { CacheService } from '@adonisjs/cache/types'
import { ApplicationService, ConfigProvider } from '@adonisjs/core/types'
import { LucidModel } from '@adonisjs/lucid/types/model'
import BaseCurrencyService, { BaseCurrencyExchange, createCurrency } from '@mixxtor/currencyx-js'
import type { CurrencyExchanges } from '@mixxtor/currencyx-js'

/**
 * A list of known currency providers inferred from the user config
 * This interface must be extended in user-land
 */
export type { CurrencyExchanges } from '@mixxtor/currencyx-js'

/**
 * Database configuration for currency provider
 */
export interface DatabaseConfig<
  Model extends LucidModel = LucidModel,
  Cache extends CacheConfig | undefined | false = CacheConfig | undefined,
> {
  /**
   * The Lucid model to use for currency queries
   */
  model: () => Promise<{ default: Model }> | Model

  /**
   * Base currency - all exchange rates in database are relative to this currency
   * @default 'USD'
   * @example 'USD' // 1 USD = 0.85 EUR, 1 USD = 0.73 GBP
   */
  base?: string

  /**
   * Column mapping for the currency table
   */
  columns?: {
    /**
     * Currency code column (e.g., 'USD', 'EUR')
     * @default 'code'
     */
    code: string

    /**
     * Exchange rate column
     * @default 'exchange_rate'
     */
    rate: string
  }

  /**
   * Cache configuration for this database provider
   * @default false
   */
  cache?: Cache | undefined | false
}

/**
 * Cache configuration for database provider
 */
export interface CacheConfig {
  /**
   * The AdonisJS cache service instance
   * @requires @adonisjs/cache
   */
  service: () => Promise<{ default: CacheService }> | CacheService

  /**
   * Cache TTL in seconds
   * @default 3600 (1 hour)
   */
  ttl?: number

  /**
   * Cache key prefix
   * @default 'currency'
   */
  prefix?: string
}

/**
 * Complete currency configuration for AdonisJS
 */
export interface CurrencyConfig {
  /**
   * Default provider to use
   */
  default: keyof CurrencyExchanges

  /**
   * Provider configurations
   */
  exchanges: Record<keyof CurrencyExchanges, BaseCurrencyExchange>
}

/**
 * Infer the providers from the user config
 */
export type InferExchanges<
  T extends ConfigProvider<{ exchanges: Record<string, ExchangeFactory> }>,
> = Awaited<ReturnType<T['resolver']>>['exchanges']

// export type InferExchanges<T extends { exchanges: Record<string, BaseCurrencyExchange> }> = {
//   [K in keyof T['exchanges']]: any
// }

/**
 * Currency record interface for database queries
 */
export interface CurrencyRecord {
  [key: string]: any
  code?: string
  rate?: number
  updated_at?: Date
}

/**
 * Representation of a factory function that returns
 * an instance of a driver.
 */
export type ExchangeFactory = BaseCurrencyExchange

/**
 * Main Currency Service Implementation
 */
export interface CurrencyService
  extends BaseCurrencyService<
    CurrencyExchanges extends Record<string, ReturnType<typeof createCurrency>>
      ? CurrencyExchanges
      : never
  > {}

/**
 * Service config provider is an extension of the config
 * provider and accepts the name of the disk service
 */
export type ServiceConfigProvider<Factory extends ExchangeFactory> = {
  type: 'provider'
  resolver: (name: string, app: ApplicationService) => Promise<Factory>
}
