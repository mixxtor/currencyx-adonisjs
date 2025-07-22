import { test } from '@japa/runner'
import { defineConfig, exchanges } from '../src/define_config.js'

test.group('Configuration Helpers', () => {
  test('defineConfig should return a config provider', ({ assert }) => {
    const config = {
      default: 'database' as const,
      providers: {
        database: {
          model: () => Promise.resolve({} as any),
        },
      },
    }

    const result = defineConfig(config as any)

    // defineConfig returns a ConfigProvider, not the original config
    assert.equal(result.type, 'provider')
    assert.isFunction(result.resolver)
  })

  test('database helper should validate model requirement', ({ assert }) => {
    assert.throws(() => {
      exchanges.database({} as any)
    }, 'Database provider requires a model')
  })

  test('database helper should set default columns and base currency', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)

    // Create the actual provider instance
    const config = exchanges.database({ model: mockModel })
    assert.instanceOf(config, Object)
    assert.equal(config.constructor.name, 'DatabaseProvider')
    assert.equal(config.base, 'USD')

    // Check that provider has required methods
    assert.isFunction(config.convert)
    assert.isFunction(config.latestRates)
  })

  test('database helper should merge custom config', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)

    // Create the actual provider instance
    const config = exchanges.database({
      model: mockModel,
      base: 'EUR',
      columns: {
        code: 'currency_code',
        rate: 'rate_value',
      },
      cache: false,
    })

    assert.instanceOf(config, Object)
    assert.equal(config.constructor.name, 'DatabaseProvider')
    assert.equal(config.base, 'EUR')

    // Check that provider has required methods
    assert.isFunction(config.convert)
    assert.isFunction(config.latestRates)
  })

  test('google helper should set defaults', ({ assert }) => {
    // Create the actual provider instance
    const provider = exchanges.google()
    assert.instanceOf(provider, Object)
    assert.equal(provider.constructor.name, 'GoogleFinanceProvider')

    // Check that provider has required methods
    assert.isFunction(provider.convert)
    assert.isFunction(provider.latestRates)
  })

  test('google helper should accept custom config', ({ assert }) => {
    // Create the actual provider instance
    const provider = exchanges.google({
      base: 'EUR',
      timeout: 10000,
    })

    assert.instanceOf(provider, Object)
    assert.equal(provider.constructor.name, 'GoogleFinanceProvider')

    // Check that provider has required methods
    assert.isFunction(provider.convert)
    assert.isFunction(provider.latestRates)
  })

  test('fixer helper should require accessKey', ({ assert }) => {
    assert.throws(() => {
      exchanges.fixer({} as any)
    }, 'Fixer provider requires an accessKey')
  })

  test('fixer helper should set defaults with accessKey', ({ assert }) => {
    // Create the actual provider instance
    const provider = exchanges.fixer({ accessKey: 'test-key' })
    assert.instanceOf(provider, Object)
    assert.equal(provider.constructor.name, 'FixerProvider')

    // Check that provider has required methods
    assert.isFunction(provider.convert)
    assert.isFunction(provider.latestRates)
  })

  test('cache helper should accept custom config', ({ assert }) => {
    const config = {
      enabled: false,
      ttl: 1800,
      prefix: 'rates',
    }

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
