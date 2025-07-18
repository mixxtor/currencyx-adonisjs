/**
 * Types for CurrencyX AdonisJS integration
 */

import type { BaseModel } from '@adonisjs/lucid/orm'
import type { CacheService } from '@adonisjs/cache/types'
import {
  createCurrency,
  type CurrencyProviderContract,
  type CurrencyProviders,
} from '@mixxtor/currencyx-js'

// // Cache manager interface (simplified to avoid dependency issues)
// interface CacheStore {
//   get<T = any>(key: string): Promise<T | null>
//   set<T = any>(key: string, value: T, ttl?: number): Promise<void>
// }
interface CacheStore extends CacheService {}

/**
 * Database configuration for currency provider
 */
export interface DatabaseConfig {
  /**
   * The Lucid model to use for currency queries
   */
  model: () => typeof BaseModel | Promise<typeof BaseModel>

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
    code?: string

    /**
     * Exchange rate column
     * @default 'exchange_rate'
     */
    rate?: string
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
  default: keyof CurrencyProviders

  /**
   * Provider configurations
   */
  providers: Record<keyof CurrencyProviders, CurrencyProviderContract>
}

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
 * Cache manager interface
 */
export interface CacheManager extends CacheStore {}

/**
 * Service container bindings
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    currency: Awaited<ReturnType<typeof createCurrency>>
  }
}
