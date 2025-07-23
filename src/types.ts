/**
 * Types for CurrencyX AdonisJS integration
 */

import { ApplicationService, ConfigProvider } from '@adonisjs/core/types'
import { LucidModel } from '@adonisjs/lucid/types/model'
import { type CurrencyExchanges, BaseCurrencyExchange } from '@mixxtor/currencyx-js'

/**
 * A list of known currency providers inferred from the user config
 * This interface must be extended in user-land
 */
export { CurrencyExchanges }

/**
 * Database configuration for currency provider
 */
export interface DatabaseConfig<Model extends LucidModel = LucidModel> {
  /**
   * The Lucid model to use for currency queries
   */
  model: () => Promise<{ default: Model }>

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
  cache?: CacheConfig | false
}

/**
 * Cache configuration for database provider
 */
export interface CacheConfig {
  /**
   * Enable or disable caching
   * @default true
   */
  enabled?: boolean

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
  providers: Record<keyof CurrencyExchanges, BaseCurrencyExchange>
}

/**
 * Infer the providers from the user config
 */
export type InferExchanges<
  T extends ConfigProvider<{ providers: Record<string, ProviderFactory> }>,
> = Awaited<ReturnType<T['resolver']>>['providers']

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
export type ProviderFactory = () => BaseCurrencyExchange

/**
 * Service config provider is an extension of the config
 * provider and accepts the name of the disk service
 */
export type ServiceConfigProvider<Factory extends ProviderFactory> = {
  type: 'provider'
  resolver: (name: string, app: ApplicationService) => Promise<Factory>
}
