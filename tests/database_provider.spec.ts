import { test } from '@japa/runner'
import { DatabaseProvider } from '../src/database_provider.js'

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
    }

    const provider = new DatabaseProvider(config)

    // Wait a bit for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert(100, 'USD', 'USD')

    assert.equal(result.success, true)
    assert.equal(result.query.amount, 100)
    assert.equal(result.query.from, 'USD')
    assert.equal(result.query.to, 'USD')
    assert.equal(result.result, 100)
    assert.equal(result.info.rate, 1)
  })

  test('should convert currency using direct rate', async ({ assert }) => {
    // Setup mock data
    MockModel.queryBuilder = {
      directResult: {
        code: 'EUR',
        rate: 0.85,
        base: 'USD',
      },
    }

    const config = {
      model: () => Promise.resolve(MockModel as any),
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert(100, 'USD', 'EUR')

    assert.equal(result.success, true)
    assert.equal(result.query.amount, 100)
    assert.equal(result.query.from, 'USD')
    assert.equal(result.query.to, 'EUR')
    assert.equal(result.result, 85)
    assert.equal(result.info.rate, 0.85)
  })

  test('should get exchange rates for base currency', async ({ assert }) => {
    // Setup mock data
    MockModel.queryBuilder = {
      allResults: [
        { code: 'EUR', rate: 0.85, base: 'USD' },
        { code: 'GBP', rate: 0.73, base: 'USD' },
        { code: 'JPY', rate: 110.0, base: 'USD' },
      ],
    }

    const config = {
      model: () => Promise.resolve(MockModel as any),
    }

    const provider = new DatabaseProvider(config)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.getExchangeRates('USD')

    assert.equal(result.success, true)
    assert.equal(result.base, 'USD')
    assert.deepEqual(result.rates, {
      EUR: 0.85,
      GBP: 0.73,
      JPY: 110.0,
    })
  })

  test('should perform health check', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve(MockModel as any),
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
    }

    const provider = new DatabaseProvider(config)

    // Wait for model loading to fail
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert(100, 'USD', 'EUR')

    // Should return error result instead of throwing
    assert.equal(result.success, false)
    assert.include(result.error?.info || '', 'Currency model not loaded')
  })

  test('should work with cache when provided', async ({ assert }) => {
    const mockApp = {
      container: {
        make: async (service: string) => {
          if (service === 'redis') {
            return {
              get: async (_key: string) => null,
              set: async (_key: string, _value: any, _ttl: number) => {},
            }
          }
          throw new Error('Service not found')
        },
      },
    }

    const config = {
      model: () => Promise.resolve(MockModel as any),
      cache: {
        store: 'redis' as const,
        ttl: 3600,
        prefix: 'test',
      },
    }

    const provider = new DatabaseProvider(config, mockApp)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const healthCheck = await provider.healthCheck()
    assert.equal(healthCheck.healthy, true)
  })
})
