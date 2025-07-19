/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.js'

// Configuration helpers
export {
  defineConfig,
  exchanges,
  database,
  google,
  fixer,
  cache,
  createCurrencyModel,
  createCurrencyMigration,
  type InferProviders,
  type InferDefaultProvider,
} from './src/config.js'

// Types
export type {
  DatabaseConfig,
  CacheConfig,
  CurrencyConfig,
  CurrencyRecord,
  CacheManager,
} from './src/types.js'

// Database Provider
export { DatabaseProvider } from './src/database_provider.js'

// Re-export from core package
export {
  createCurrency,
  CurrencyService,
  type CurrencyCode,
  type ConversionResult,
  type ExchangeRatesResult,
  type HealthCheckResult,
} from '@mixxtor/currencyx-js'
