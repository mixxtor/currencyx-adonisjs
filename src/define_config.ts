import { exchanges as currencyExchanges } from '@mixxtor/currencyx-js'
import type { DatabaseConfig, ServiceConfigProvider, ProviderFactory } from './types.js'
import { DatabaseProvider } from './exchanges/database_provider.js'
import { ApplicationService } from '@adonisjs/core/types'
import { configProvider } from '@adonisjs/core'
import type { ConfigProvider } from '@adonisjs/core/types'

/**
 * Define database provider configuration
 * Returns a factory function to avoid eager instantiation
 */
function database(config: DatabaseConfig, app?: ApplicationService): DatabaseProvider {
  if (!config.model) {
    throw new Error('Database provider requires a model')
  }

  const dbConfig = {
    model: config.model,
    base: config.base || 'USD',
    columns: {
      code: 'code',
      rate: 'exchange_rate',
      ...config.columns,
    },
    cache: config.cache,
  }

  return new DatabaseProvider(dbConfig, app)
}

/**
 * Provider configuration helpers
 */
export const exchanges = {
  ...currencyExchanges,
  database,
} as const

/**
 * Helper to remap known exchange providers to factory functions
 */
type ResolvedConfig<Providers extends Record<string, ProviderFactory>> = {
  default: keyof Providers
  providers: {
    [K in keyof Providers]: Providers[K] extends ServiceConfigProvider<infer A> ? A : Providers[K]
  }
}

/**
 * Define currency configuration with type inference
 * Following AdonisJS pattern for better type safety
 */
export function defineConfig<Providers extends Record<string, any>>(
  config: ResolvedConfig<Providers>
): ConfigProvider<ResolvedConfig<Providers>> {
  return configProvider.create(async (_app) => {
    const { providers, default: defaultExchange } = config
    const providersNames = Object.keys(providers)

    /**
     * Configured exchanges
     */
    const providerExchanges = {} as Record<string, ProviderFactory>

    /**
     * Looping over providers and resolving their config providers
     * to get factory functions
     */
    for (let providerName of providersNames) {
      const exchange = providers[providerName]
      providerExchanges[providerName] = exchange
    }

    return {
      default: defaultExchange,
      providers: providerExchanges,
    } as ResolvedConfig<Providers>
  })
}
