/**
 * CurrencyX Service Provider for AdonisJS
 */

import type { ApplicationService } from '@adonisjs/core/types'
import { createCurrency } from '@mixxtor/currencyx-js'
import { DatabaseProvider } from '../src/database_provider.js'
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
      const providers: any = {}

      // Add external providers
      if (config.providers.google) {
        providers.google = config.providers.google
      }
      if (config.providers.fixer) {
        providers.fixer = config.providers.fixer
      }

      // Add database provider if configured
      if (config.providers.database) {
        // Create database provider instance with app context for cache setup
        const databaseProvider = new DatabaseProvider(config.providers.database, this.app)
        providers.database = databaseProvider
      }

      // Create currency service with all providers
      const currency = createCurrency({
        default: config.default as any,
        providers,
      })

      return currency
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
