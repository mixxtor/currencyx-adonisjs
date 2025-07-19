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
  default: 'database',

  providers: {
    // Database provider using Lucid ORM
    database: exchanges.database({
      model: () => import('#models/currency'),
      base: 'USD', // Base currency - all exchange rates are relative to this
      columns: {
        code: 'code', // Currency code (USD, EUR, etc.)
        rate: 'exchange_rate', // Exchange rate column name
      },
      cache: cache({
        enabled: true, // Enable/disable caching
        ttl: 3600, // 1 hour
        prefix: 'currency', // Cache key prefix
      }),
      // Or disable caching:
      // cache: false,
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

  // Global cache configuration (optional)
  // cache: cache(), // Enable global caching
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

    const result = await currency.convert({ amount: 100, from: 'USD', to: 'EUR' })

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
const dbResult = await currency.convert({ amount: 100, from: 'USD', to: 'EUR' })

// Switch to Google Finance
currency.use('google')
const googleResult = await currency.convert({ amount: 100, from: 'USD', to: 'EUR' })

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
        enabled: true, // Enable/disable caching
        ttl: 3600, // 1 hour
        prefix: 'currency', // cache key prefix
      }),
      // Or disable caching completely:
      // cache: false,
    }),
  },
})
```

### Cache Configuration Options:

- **`enabled`**: Enable or disable caching (default: `true`)
- **`ttl`**: Cache TTL in seconds (default: `3600` - 1 hour)
- **`prefix`**: Cache key prefix (default: `'currency'`)
- **`false`**: Disable caching completely

### Cache Behavior:

- **When `enabled: false`**: Always queries database directly, no caching
- **When `enabled: true`**: Caches exchange rates using `@adonisjs/cache` to improve performance
- **Error handling**: Cache errors don't break functionality, falls back to database

### Database Schema:

The package expects a table structure matching your existing currency schema:

```sql
CREATE TABLE currencies (
  id INTEGER PRIMARY KEY,
  code VARCHAR(3) UNIQUE NOT NULL,        -- Currency code (USD, EUR, etc.)
  name VARCHAR(255) NOT NULL,             -- Currency name (US Dollar, Euro, etc.)
  symbol VARCHAR(10) NOT NULL,            -- Currency symbol ($, €, £, etc.)
  countries JSON,                         -- Countries using this currency
  exchange_rate DECIMAL(15,8) NOT NULL,   -- Exchange rate relative to base currency
  status BOOLEAN DEFAULT TRUE,            -- Currency status (active/inactive)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Example data (matching your real schema):**
```sql
INSERT INTO currencies (code, name, symbol, countries, exchange_rate, status) VALUES
  ('USD', 'US Dollar', '$', '["US"]', 1.0, true),
  ('EUR', 'Euro', '€', '["DE","FR","IT","ES"]', 0.85, true),
  ('GBP', 'British Pound', '£', '["GB"]', 0.73, true),
  ('AUD', 'Australian Dollar', 'AU$', '["AU","CX","CC","HM","KI","NR","NF","TV"]', 1.51, true);
```

### Base Currency Concept:

- **All exchange rates are stored relative to a single base currency** (default: USD)
- **Base currency rate = 1.0** (e.g., USD = 1.0)
- **Other currencies** store their rate relative to base (e.g., EUR = 0.85 means 1 USD = 0.85 EUR)
- **Cross-rate calculations** are handled automatically (e.g., EUR to GBP = GBP_rate / EUR_rate)

Cache keys follow the pattern: `currency:rate:USD:EUR`

## 🧪 Testing

```bash
npm test
```

## 🚀 Release Process

This package uses `release-it` for automated releases:

```bash
# Patch release (1.0.0 → 1.0.1)
npm run release:patch

# Minor release (1.0.0 → 1.1.0)
npm run release:minor

# Major release (1.0.0 → 2.0.0)
npm run release:major

# Pre-release versions
npm run release:beta   # 1.0.0 → 1.0.1-beta.0
npm run release:alpha  # 1.0.0 → 1.0.1-alpha.0

# Dry run (test without actually releasing)
npm run release:dry
```

The release process automatically:
- ✅ Runs linting and tests
- 📦 Builds the package
- 📝 Updates CHANGELOG.md
- 🏷️ Creates git tag
- 📤 Publishes to npm
- 🎉 Creates GitHub release

## 📄 License

MIT License - see LICENSE file for details.
