/**
 * Configuration helpers for CurrencyX AdonisJS
 */

import {
  FixerProvider,
  GoogleFinanceProvider,
  type FixerConfig,
  type GoogleFinanceConfig,
} from '@mixxtor/currencyx-js'
import type { DatabaseConfig, CurrencyConfig, CacheConfig } from './types.js'
import { DatabaseProvider } from './database_provider.js'
import { ApplicationService } from '@adonisjs/core/types'

/**
 * Define database provider configuration
 */
export function database(config: DatabaseConfig, app?: ApplicationService): DatabaseProvider {
  if (!config.model) {
    throw new Error('Database provider requires a model')
  }

  return new DatabaseProvider(
    {
      model: config.model,
      base: config.base || 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
        ...config.columns,
      },
      cache: config.cache,
    },
    app
  )
}

/**
 * Define Google Finance provider configuration
 */
export function google(config: GoogleFinanceConfig = {}): GoogleFinanceProvider {
  return new GoogleFinanceProvider({
    base: config.base || 'USD',
    timeout: config.timeout || 5000,
  })
}

/**
 * Define Fixer.io provider configuration
 */
export function fixer(config: FixerConfig): FixerProvider {
  if (!config.accessKey) {
    throw new Error('Fixer provider requires an accessKey')
  }

  return new FixerProvider({
    accessKey: config.accessKey,
    base: config.base || 'USD',
    timeout: config.timeout || 5000,
  })
}

/**
 * Define cache configuration for database provider
 */
export function cache(config: CacheConfig = {}): CacheConfig {
  return {
    enabled: config.enabled !== false, // Default to true
    ttl: config.ttl || 3600, // 1 hour
    prefix: config.prefix || 'currency',
  }
}

/**
 * Provider configuration helpers
 */
export const exchanges = {
  database,
  google,
  fixer,
} as const

/**
 * Define currency configuration with type inference
 */
export function defineConfig<T extends CurrencyConfig>(config: T): T {
  return config
}

/**
 * Helper to create a currency model stub
 */
export function createCurrencyModel(tableName: string = 'currencies') {
  return `import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Currency extends BaseModel {
  public static table = '${tableName}'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare rate: number

  @column()
  declare base: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}`
}

/**
 * Helper to create a migration stub
 */
export function createCurrencyMigration(tableName: string = 'currencies') {
  return `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = '${tableName}'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('code', 3).notNullable()
      table.decimal('rate', 15, 8).notNullable()
      table.string('base', 3).defaultTo('USD')
      table.timestamp('created_at')
      table.timestamp('updated_at')
      
      // Indexes
      table.index(['code'])
      table.index(['base'])
      table.unique(['code', 'base'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}`
}

/**
 * Type inference helper
 */
export type InferProviders<T> = T extends { providers: infer P } ? P : never
export type InferDefaultProvider<T> = T extends { defaultProvider: infer D } ? D : never
