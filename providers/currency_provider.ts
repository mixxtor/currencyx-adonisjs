/**
 * CurrencyX Service Provider for AdonisJS
 */

import type { ApplicationService } from '@adonisjs/core/types'
import {
  createCurrency,
  type CurrencyProviderContract,
  type CurrencyProviders,
} from '@mixxtor/currencyx-js'
import type { CurrencyConfig } from '../src/types.js'

export default class CurrencyProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register currency service
   */
  async register() {
    this.app.container.singleton('currency', async () => {
      const config = this.app.config.get<CurrencyConfig>('currency')

      if (!config) {
        throw new Error(
          'Currency configuration not found. Please run "node ace configure @mixxtor/currencyx-adonisjs"'
        )
      }

      // Build providers config dynamically
      const providers: Record<keyof CurrencyProviders, CurrencyProviderContract> = {}

      for (const providerName of Object.keys(config.providers)) {
        providers[providerName] = config.providers[providerName]
      }

      // Create currency service with all providers
      return createCurrency({
        default: config.default,
        providers,
      })
    })
  }

  /**
   * Boot the provider
   */
  async boot() {
    // Nothing to boot
  }

  /**
   * Shutdown the provider
   */
  async shutdown() {
    // Nothing to shutdown
  }
}
