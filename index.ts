/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.js'
export { stubsRoot } from './stubs/main.js'
export { defineConfig, exchanges } from './src/define_config.js'

// Types
export type {
  CurrencyCode,
  DatabaseConfig,
  CacheConfig,
  CurrencyConfig,
  CurrencyRecord,
  CurrencyExchanges,
  InferExchanges,
} from './src/types.js'

// Database Provider
export { DatabaseExchange } from './src/exchanges/database.js'
