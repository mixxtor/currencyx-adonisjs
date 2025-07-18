import { test } from '@japa/runner'
import {
  defineConfig,
  exchanges,
  database,
  google,
  fixer,
  cache,
  DatabaseProvider,
} from '../index.js'

test.group('CurrencyX AdonisJS Package', () => {
  test('should export configuration helpers', ({ assert }) => {
    assert.isFunction(defineConfig)
    assert.isObject(exchanges)
    assert.isFunction(database)
    assert.isFunction(google)
    assert.isFunction(fixer)
    assert.isFunction(cache)
  })

  test('should export types', ({ assert }) => {
    assert.isFunction(DatabaseProvider)
  })
})
