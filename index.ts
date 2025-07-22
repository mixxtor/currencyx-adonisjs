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
  DatabaseConfig,
  CacheConfig,
  CurrencyConfig,
  CurrencyRecord,
  CurrencyProviders,
  InferProviders as InferCurrencyProviders,
} from './src/types.js'

// Database Provider
export { DatabaseProvider } from './src/exchanges/database_provider.js'
