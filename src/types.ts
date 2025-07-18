/**
 * Types for CurrencyX AdonisJS integration
 */

import type { BaseModel } from '@adonisjs/lucid/orm'
import type { CacheService } from '@adonisjs/cache/types'

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
     * @default 'rate'
     */
    rate?: string

    /**
     * Base currency column (optional)
     * @default 'base'
     */
    base?: string

    /**
     * Updated at timestamp column (optional)
     * @default 'updated_at'
     */
    updatedAt?: string
  }

  /**
   * Cache configuration for this database provider
   */
  cache?: CacheConfig | false
}

/**
 * Cache configuration for database provider
 */
export interface CacheConfig {
  /**
   * Cache store to use
   * - 'redis': Use @adonisjs/redis directly
   * - 'cache': Use @adonisjs/cache (if available)
   * @default 'redis'
   */
  store?: 'redis' | 'cache' | string

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
  defaultProvider: 'database' | 'google' | 'fixer'

  /**
   * Provider configurations
   */
  providers: {
    database?: DatabaseConfig
    google?: {
      base?: string
      timeout?: number
    }
    fixer?: {
      accessKey: string
      base?: string
      timeout?: number
    }
  }
}

/**
 * Currency record interface for database queries
 */
export interface CurrencyRecord {
  [key: string]: any
  code?: string
  rate?: number
  base?: string
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
    currency: any
  }
}
