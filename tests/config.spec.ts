import { test } from '@japa/runner'
import { defineConfig, exchanges, database, google, fixer, cache } from '../src/config.js'

test.group('Configuration Helpers', () => {
  test('defineConfig should return the same config', ({ assert }) => {
    const config = {
      default: 'database' as const,
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

  test('database helper should set default columns and base currency', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)
    const config = database({ model: mockModel })

    assert.equal(config.model, mockModel)
    assert.equal(config.base, 'USD')
    assert.deepEqual(config.columns, {
      code: 'code',
      rate: 'exchange_rate',
    })
    assert.isUndefined(config.cache)
  })

  test('database helper should merge custom config', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)
    const config = database({
      model: mockModel,
      base: 'EUR',
      columns: {
        code: 'currency_code',
        rate: 'rate_value',
      },
      cache: cache(),
    })

    assert.equal(config.base, 'EUR')
    assert.deepEqual(config.columns, {
      code: 'currency_code',
      rate: 'rate_value',
    })
    assert.deepEqual(config.cache, {
      enabled: true,
      ttl: 3600,
      prefix: 'currency',
    })
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
      enabled: true,
      ttl: 3600,
      prefix: 'currency',
    })
  })

  test('cache helper should accept custom config', ({ assert }) => {
    const config = cache({
      enabled: false,
      ttl: 1800,
      prefix: 'rates',
    })

    assert.deepEqual(config, {
      enabled: false,
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
