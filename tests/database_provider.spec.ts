import { test } from '@japa/runner'
import { DatabaseProvider } from '../src/database_provider.js'
import { cache } from '../src/config.js'
import type { ApplicationService } from '@adonisjs/core/types'

// Mock Model that simulates Lucid BaseModel behavior
const MockModel = {
  table: 'currencies',
  queryBuilder: {} as any,

  query() {
    return {
      where: (_column: string, _value: string) => ({
        where: (_column2: string, _value2: string) => ({
          first: () => Promise.resolve(MockModel.queryBuilder.directResult),
          exec: () => Promise.resolve(MockModel.queryBuilder.allResults || []),
        }),
        first: () => Promise.resolve(MockModel.queryBuilder.singleResult),
        exec: () => Promise.resolve(MockModel.queryBuilder.allResults || []),
      }),
      whereIn: (_column: string, _values: string[]) => ({
        exec: () => Promise.resolve(MockModel.queryBuilder.allResults || []),
      }),
      limit: (_count: number) => ({
        exec: () => Promise.resolve([]),
      }),
      exec: () => Promise.resolve(MockModel.queryBuilder.allResults || []),
    }
  },
}

test.group('DatabaseProvider Simple', () => {
  test('should initialize with correct configuration', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'currency_code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)
    assert.equal(provider.name, 'database')
  })

  test('should handle same currency conversion', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait a bit for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert({ amount: 100, from: 'USD', to: 'USD' })

    assert.equal(result.success, true)
    assert.equal(result.query.amount, 100)
    assert.equal(result.query.from, 'USD')
    assert.equal(result.query.to, 'USD')
    assert.equal(result.result, 100)
    assert.equal(result.info.rate, 1)
  })

  test('should convert currency using cross rates', async ({ assert }) => {
    // Setup mock data - simplified schema with cross rates
    MockModel.queryBuilder = {
      singleResult: null, // Will be set by individual queries
    }

    // Mock the query method to return different results based on the currency
    const originalQuery = MockModel.query
    MockModel.query = () => ({
      where: (_column: string, value: string) => ({
        where: (_column2: string, _value2: string) => ({
          first: () => Promise.resolve(null),
          exec: () => Promise.resolve([]),
        }),
        first: () => {
          // Return rates for USD=1.0, EUR=0.85 using exchange_rate column
          if (value === 'USD') {
            return Promise.resolve({ code: 'USD', exchange_rate: 1.0 })
          } else if (value === 'EUR') {
            return Promise.resolve({ code: 'EUR', exchange_rate: 0.85 })
          }
          return Promise.resolve(null)
        },
        exec: () => Promise.resolve([]),
      }),
      whereIn: () => ({ exec: () => Promise.resolve([]) }),
      limit: () => ({ exec: () => Promise.resolve([]) }),
      exec: () => Promise.resolve([]),
    })

    const config = {
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert({ amount: 100, from: 'USD', to: 'EUR' })

    // Restore original query method
    MockModel.query = originalQuery

    assert.equal(result.success, true)
    assert.equal(result.query.amount, 100)
    assert.equal(result.query.from, 'USD')
    assert.equal(result.query.to, 'EUR')
    assert.equal(result.result, 85)
    assert.equal(result.info.rate, 0.85)
  })

  test('should get exchange rates for all currencies', async ({ assert }) => {
    // Setup mock data - using exchange_rate column
    MockModel.queryBuilder = {
      allResults: [
        { code: 'USD', exchange_rate: 1.0 },
        { code: 'EUR', exchange_rate: 0.85 },
        { code: 'GBP', exchange_rate: 0.73 },
        { code: 'JPY', exchange_rate: 110.0 },
      ],
    }

    const config = {
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.getExchangeRates('USD')

    assert.equal(result.success, true)
    assert.equal(result.base, 'USD')
    assert.deepEqual(result.rates, {
      USD: 1.0,
      EUR: 0.85,
      GBP: 0.73,
      JPY: 110.0,
    })
  })

  test('should perform health check', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.healthCheck()

    assert.equal(result.healthy, true)
    assert.isNumber(result.latency)
  })

  test('should handle model loading error', async ({ assert }) => {
    const config = {
      model: () => Promise.reject(new Error('Model not found')),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait for model loading to fail
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert({ amount: 100, from: 'USD', to: 'EUR' })

    // Should return error result instead of throwing
    assert.equal(result.success, false)
    assert.include(result.error?.info || '', 'Currency model not loaded')
  })

  test('should work with cache when enabled', async ({ assert }) => {
    const mockApp: ApplicationService = {
      container: {
        make: async (service: string) => {
          if (service === 'cache') {
            return {
              get: async (_options: any) => null,
              set: async (_options: any) => {},
            }
          }
          throw new Error('Service not found')
        },
      },
    } as any

    const config = {
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
      cache: cache(),
    }

    const provider = new DatabaseProvider(config, mockApp)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const healthCheck = await provider.healthCheck()
    assert.equal(healthCheck.healthy, true)
  })

  test('should skip cache when disabled', async ({ assert }) => {
    const provider = new DatabaseProvider({
      model: () => Promise.resolve(MockModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
      cache: false,
    })

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const healthCheck = await provider.healthCheck()
    assert.equal(healthCheck.healthy, true)
  })
})

test.group('DatabaseProvider Base Currency Logic', () => {
  test('should understand base currency concept', async ({ assert }) => {
    // Mock model that simulates real database behavior
    const MockCurrencyModel = {
      query: () => ({
        where: (_column: string, value: string) => ({
          first: () => {
            // Simulate database with exchange rates relative to USD
            const rates = {
              USD: { code: 'USD', exchange_rate: 1.0 }, // Base currency
              EUR: { code: 'EUR', exchange_rate: 0.85 }, // 1 USD = 0.85 EUR
              GBP: { code: 'GBP', exchange_rate: 0.73 }, // 1 USD = 0.73 GBP
              AUD: { code: 'AUD', exchange_rate: 1.51 }, // 1 USD = 1.51 AUD
              JPY: { code: 'JPY', exchange_rate: 110.0 }, // 1 USD = 110 JPY
            }
            return Promise.resolve(rates[value as keyof typeof rates] || null)
          },
          exec: () => Promise.resolve([]),
        }),
        whereIn: () => ({ exec: () => Promise.resolve([]) }),
        limit: () => ({ exec: () => Promise.resolve([]) }),
        exec: () => {
          // Return all currencies for getExchangeRates
          return Promise.resolve([
            { code: 'USD', exchange_rate: 1.0 },
            { code: 'EUR', exchange_rate: 0.85 },
            { code: 'GBP', exchange_rate: 0.73 },
            { code: 'AUD', exchange_rate: 1.51 },
            { code: 'JPY', exchange_rate: 110.0 },
          ])
        },
      }),
    }

    const config = {
      model: () => Promise.resolve(MockCurrencyModel as any),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Test 1: USD to EUR (base to target)
    const usdToEur = await provider.convert({ amount: 100, from: 'USD', to: 'EUR' })
    assert.equal(usdToEur.success, true)
    assert.equal(usdToEur.result, 85) // 100 * 0.85
    assert.equal(usdToEur.info.rate, 0.85)

    // Test 2: EUR to USD (target to base)
    const eurToUsd = await provider.convert({ amount: 85, from: 'EUR', to: 'USD' })
    assert.equal(eurToUsd.success, true)
    assert.equal(eurToUsd.result, 100) // 85 / 0.85
    assert.approximately(eurToUsd.info.rate!, 1.1764705882352942, 0.000000000001) // 1 / 0.85

    // Test 3: EUR to GBP (cross rate)
    const eurToGbp = await provider.convert({ amount: 100, from: 'EUR', to: 'GBP' })
    assert.equal(eurToGbp.success, true)
    // Cross rate: GBP_rate / EUR_rate = 0.73 / 0.85 = 0.8588235294117647
    assert.approximately(eurToGbp.result!, 85.88235294117647, 0.00000000000001)
    assert.equal(eurToGbp.info.rate, 0.8588235294117647)

    // Test 4: Get all exchange rates
    const rates = await provider.getExchangeRates('USD')
    assert.equal(rates.success, true)
    assert.equal(rates.base, 'USD')
    assert.deepEqual(rates.rates, {
      USD: 1.0,
      EUR: 0.85,
      GBP: 0.73,
      AUD: 1.51,
      JPY: 110.0,
    })
  })

  test('should work with custom base currency', async ({ assert }) => {
    const MockCurrencyModel = {
      query: () => ({
        where: (_column: string, value: string) => ({
          first: () => {
            // Simulate database with exchange rates relative to EUR
            const rates = {
              EUR: { code: 'EUR', exchange_rate: 1.0 }, // Base currency
              USD: { code: 'USD', exchange_rate: 1.1765 }, // 1 EUR = 1.1765 USD
              GBP: { code: 'GBP', exchange_rate: 0.8588 }, // 1 EUR = 0.8588 GBP
            }
            return Promise.resolve(rates[value as keyof typeof rates] || null)
          },
          exec: () => Promise.resolve([]),
        }),
        whereIn: () => ({ exec: () => Promise.resolve([]) }),
        limit: () => ({ exec: () => Promise.resolve([]) }),
        exec: () => Promise.resolve([]),
      }),
    }

    const config = {
      model: () => Promise.resolve(MockCurrencyModel as any),
      base: 'EUR', // Custom base currency
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Test EUR to USD (base to target)
    const eurToUsd = await provider.convert({ amount: 100, from: 'EUR', to: 'USD' })
    assert.equal(eurToUsd.success, true)
    assert.equal(eurToUsd.result, 117.65) // 100 * 1.1765
    assert.equal(eurToUsd.info.rate, 1.1765)

    // Test USD to EUR (target to base)
    const usdToEur = await provider.convert({ amount: 117.65, from: 'USD', to: 'EUR' })
    assert.equal(usdToEur.success, true)
    assert.approximately(usdToEur.result!, 100, 0.000000000001) // 117.65 / 1.1765
    assert.approximately(usdToEur.info.rate!, 0.85, 0.001) // 1 / 1.1765
  })
})
