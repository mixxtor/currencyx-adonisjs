import { test } from '@japa/runner'
import { defineConfig, exchanges, database, google, fixer, cache } from '../src/config.js'

test.group('Configuration Helpers', () => {
  test('defineConfig should return the same config', ({ assert }) => {
    const config = {
      defaultProvider: 'database' as const,
      providers: {
        database: {
          model: () => Promise.resolve({} as any),
        },
      },
    }

    const result = defineConfig(config)
    assert.deepEqual(result, config)
  })

  test('database helper should validate model requirement', ({ assert }) => {
    assert.throws(() => {
      database({} as any)
    }, 'Database provider requires a model')
  })

  test('database helper should set default columns', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)
    const config = database({ model: mockModel })

    assert.equal(config.model, mockModel)
    assert.deepEqual(config.columns, {
      code: 'code',
      rate: 'rate',
      base: 'base',
      updatedAt: 'updated_at',
    })
    assert.isUndefined(config.cache)
  })

  test('database helper should merge custom columns and cache', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)
    const cacheConfig = { store: 'cache' as const, ttl: 1800 }
    const config = database({
      model: mockModel,
      columns: {
        code: 'currency_code',
        rate: 'exchange_rate',
      },
      cache: cacheConfig,
    })

    assert.deepEqual(config.columns, {
      code: 'currency_code',
      rate: 'exchange_rate',
      base: 'base',
      updatedAt: 'updated_at',
    })
    assert.deepEqual(config.cache, cacheConfig)
  })

  test('google helper should set defaults', ({ assert }) => {
    const config = google()

    assert.deepEqual(config, {
      base: 'USD',
      timeout: 5000,
    })
  })

  test('google helper should accept custom config', ({ assert }) => {
    const config = google({
      base: 'EUR',
      timeout: 10000,
    })

    assert.deepEqual(config, {
      base: 'EUR',
      timeout: 10000,
    })
  })

  test('fixer helper should require accessKey', ({ assert }) => {
    assert.throws(() => {
      fixer({} as any)
    }, 'Fixer provider requires an accessKey')
  })

  test('fixer helper should set defaults with accessKey', ({ assert }) => {
    const config = fixer({ accessKey: 'test-key' })

    assert.deepEqual(config, {
      accessKey: 'test-key',
      base: 'EUR',
      timeout: 5000,
    })
  })

  test('cache helper should set defaults', ({ assert }) => {
    const config = cache()

    assert.deepEqual(config, {
      store: 'redis',
      ttl: 3600,
      prefix: 'currency',
    })
  })

  test('cache helper should accept custom config', ({ assert }) => {
    const config = cache({
      store: 'memory',
      ttl: 1800,
      prefix: 'rates',
    })

    assert.deepEqual(config, {
      store: 'memory',
      ttl: 1800,
      prefix: 'rates',
    })
  })

  test('exchanges object should contain all helpers', ({ assert }) => {
    assert.isFunction(exchanges.database)
    assert.isFunction(exchanges.google)
    assert.isFunction(exchanges.fixer)
  })
})
