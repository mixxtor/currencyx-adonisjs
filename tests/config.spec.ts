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

    const result = defineConfig(config as any)
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

    // After refactor, database() returns a DatabaseProvider instance
    assert.instanceOf(config, Object)
    assert.equal(config.constructor.name, 'DatabaseProvider')
    assert.equal(config.base, 'USD')

    // Check that provider has required methods
    assert.isFunction(config.convert)
    assert.isFunction(config.latestRates)
    assert.isFunction(config.getExchangeRates)
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

    // After refactor, database() returns a DatabaseProvider instance
    assert.instanceOf(config, Object)
    assert.equal(config.constructor.name, 'DatabaseProvider')
    assert.equal(config.base, 'EUR')

    // Check that provider has required methods
    assert.isFunction(config.convert)
    assert.isFunction(config.latestRates)
    assert.isFunction(config.getExchangeRates)
  })

  test('google helper should set defaults', ({ assert }) => {
    const provider = google()

    // After refactor, google() returns a GoogleFinanceProvider instance
    assert.instanceOf(provider, Object)
    assert.equal(provider.constructor.name, 'GoogleFinanceProvider')

    // Check that provider has required methods
    assert.isFunction(provider.convert)
    assert.isFunction(provider.latestRates)
  })

  test('google helper should accept custom config', ({ assert }) => {
    const provider = google({
      base: 'EUR',
      timeout: 10000,
    })

    // After refactor, google() returns a GoogleFinanceProvider instance
    assert.instanceOf(provider, Object)
    assert.equal(provider.constructor.name, 'GoogleFinanceProvider')

    // Check that provider has required methods
    assert.isFunction(provider.convert)
    assert.isFunction(provider.latestRates)
  })

  test('fixer helper should require accessKey', ({ assert }) => {
    assert.throws(() => {
      fixer({} as any)
    }, 'Fixer provider requires an accessKey')
  })

  test('fixer helper should set defaults with accessKey', ({ assert }) => {
    const provider = fixer({ accessKey: 'test-key' })

    // Check that it returns a FixerProvider instance
    assert.instanceOf(provider, Object)
    assert.equal(provider.constructor.name, 'FixerProvider')

    // Check that provider has required methods
    assert.isFunction(provider.convert)
    assert.isFunction(provider.latestRates)
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
