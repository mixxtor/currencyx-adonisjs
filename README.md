# CurrencyX AdonisJS

AdonisJS integration for CurrencyX.js with database provider and cache support.

## ✨ Features

- 🗄️ **Database Provider**: Full Lucid ORM integration for storing exchange rates
- 🔧 **Service Provider**: Auto-registration with AdonisJS IoC container
- ⚙️ **Configuration**: AdonisJS-style config with environment validation
- 🎯 **Type Safety**: Full TypeScript support with module augmentation
- 💾 **Cache Support**: Optional caching with @adonisjs/cache
- 🚀 **Auto Setup**: Automatic model and migration generation
- 🧪 **Well Tested**: Comprehensive test suite

## 🚀 Installation

```bash
npm install @mixxtor/currencyx-adonisjs
node ace configure @mixxtor/currencyx-adonisjs
```

The configure command will:

- Create `config/currency.ts` configuration file
- Generate `app/models/currency.ts` model
- Create database migration for currencies table
- Register the service provider in `adonisrc.ts`

## 📋 Requirements

- AdonisJS v6.2.0 or higher
- @adonisjs/lucid v21.0.0 or higher
- @adonisjs/cache (optional, for caching support)

## ⚙️ Configuration

After installation, configure your currency settings in `config/currency.ts`:

```typescript
import env from '#start/env'
import { defineConfig, exchanges, cache } from '@mixxtor/currencyx-adonisjs'

export default defineConfig({
  defaultProvider: 'database',

  providers: {
    // Database provider using Lucid ORM
    database: exchanges.database({
      model: () => import('#models/currency'),
      columns: {
        code: 'code', // Currency code (USD, EUR, etc.)
        rate: 'rate', // Exchange rate
        base: 'base', // Base currency
        updatedAt: 'updated_at', // Timestamp
      },
      cache: cache({
        store: 'redis', // 'redis' for @adonisjs/redis, 'cache' for @adonisjs/cache
        ttl: 3600, // 1 hour
        prefix: 'currency', // Cache key prefix
      }),
    }),

    // External providers (optional)
    google: exchanges.google({
      base: env.get('CURRENCY_BASE', 'USD'),
      timeout: 5000,
    }),

    fixer: exchanges.fixer({
      accessKey: env.get('FIXER_API_KEY'),
      base: 'EUR',
      timeout: 10000,
    }),
  },

  // Optional caching
  cache: cache({
    store: 'redis',
    ttl: 3600, // 1 hour
    prefix: 'currency',
  }),
})
```

## 🗄️ Database Setup

Run the migration to create the currencies table:

```bash
node ace migration:run
```

Seed some initial data:

```typescript
// database/seeders/currency_seeder.ts
import Currency from '#models/currency'

export default class CurrencySeeder {
  async run() {
    await Currency.createMany([
      { code: 'USD', rate: 1.0, base: 'USD' },
      { code: 'EUR', rate: 0.85, base: 'USD' },
      { code: 'GBP', rate: 0.73, base: 'USD' },
      { code: 'JPY', rate: 110.0, base: 'USD' },
    ])
  }
}
```

## 💻 Usage

### Basic Usage

```typescript
// In your controllers or services
export default class CurrencyController {
  async convert({ request, response }: HttpContext) {
    const currency = await app.container.make('currency')

    const result = await currency.convert(100, 'USD', 'EUR')

    return response.json({
      amount: result.amount, // 100
      from: result.from, // 'USD'
      to: result.to, // 'EUR'
      result: result.result, // 85.0
      rate: result.rate, // 0.85
      provider: result.provider, // 'database'
    })
  }
}
```

### Provider Switching

```typescript
const currency = await app.container.make('currency')

// Use database provider
currency.use('database')
const dbResult = await currency.convert(100, 'USD', 'EUR')

// Switch to Google Finance
currency.use('google')
const googleResult = await currency.convert(100, 'USD', 'EUR')

// Get available providers
const providers = currency.getAvailableProviders()
// ['database', 'google', 'fixer']
```

### Batch Operations

```typescript
// Get all rates for USD
const rates = await currency.getExchangeRates('USD')
// { base: 'USD', rates: { EUR: 0.85, GBP: 0.73, JPY: 110.0 } }

// Get specific rates
const specificRates = await currency.getExchangeRates('USD', ['EUR', 'GBP'])
// { base: 'USD', rates: { EUR: 0.85, GBP: 0.73 } }
```

### Health Checks

```typescript
const health = await currency.healthCheck()
// {
//   provider: 'database',
//   status: 'healthy',
//   timestamp: Date,
//   details: { database: 'connected', cache: 'enabled' }
// }
```

## 🎯 Type Safety

The package provides full TypeScript support with module augmentation:

```typescript
// Types are automatically available
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    currency: Awaited<ReturnType<typeof import('@mixxtor/currencyx-js').createCurrency>>
  }
}

// IntelliSense works perfectly
const currency = await app.container.make('currency') // ✅ Fully typed
```

## 💾 Caching

Cache is configured per database provider to improve performance:

```typescript
// config/currency.ts
export default defineConfig({
  providers: {
    database: exchanges.database({
      model: () => import('#models/currency'),
      cache: cache({
        store: 'redis', // 'redis' or 'cache'
        ttl: 3600, // 1 hour
        prefix: 'currency', // cache key prefix
      }),
      // Disable caching for this provider
      // cache: false
    }),
  },
})
```

### Cache Store Options:

- **`'redis'`**: Uses `@adonisjs/redis` directly (default)
- **`'cache'`**: Uses `@adonisjs/cache` if available, falls back to redis

The package automatically detects available services and falls back gracefully.

Cache keys follow the pattern: `currency:rate:USD:EUR`

## 🧪 Testing

```bash
npm test
```

## 📄 License

MIT License - see LICENSE file for details.
