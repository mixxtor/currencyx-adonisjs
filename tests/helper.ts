/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { getActiveTest } from '@japa/runner'
import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import { memoryDriver } from 'bentocache/drivers/memory'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { AppEnvironments } from '@adonisjs/core/types/app'
import { defineConfig as defineLucidConfig } from '@adonisjs/lucid'
import { defineConfig as defineCacheConfig, drivers, store } from '@adonisjs/cache'
import { defineConfig } from '../index.js'

export function getCurrencyService(config?: any): BentoCache<any> {
  const defaultConfig = {
    default: 'redis' as const,
    stores: {
      redis: bentostore().useL2Layer(
        redisDriver({ connection: { host: '127.0.0.1', port: 6379 } })
      ),

      memory: bentostore().useL1Layer(memoryDriver({})),
    },
  }

  const bentocache = new BentoCache(defaultConfig || config)
  const test = getActiveTest()
  test?.cleanup(() => bentocache.disconnectAll())

  return bentocache
}

const BASE_URL = new URL('./tmp/', import.meta.url)

export async function setupApp(
  env?: AppEnvironments,
  config: {
    database?: ReturnType<typeof defineLucidConfig>
    cache?: ReturnType<typeof defineCacheConfig>
    currency?: ReturnType<typeof defineConfig>
  } = {}
) {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge({
      config: {
        database:
          config.database ||
          defineLucidConfig({
            connection: 'sqlite',
            connections: {
              sqlite: {
                client: 'better-sqlite3',
                connection: { filename: 'db.sqlite3' },
                useNullAsDefault: true,
              },
            },
          }),
        cache:
          config.cache ||
          defineCacheConfig({
            default: 'memory',
            stores: {
              memory: store().useL1Layer(drivers.memory({})),
              redis: store().useL2Layer(drivers.redis({ connectionName: 'local' as any })),
            },
          }),
        currency:
          config.currency ||
          defineConfig({
            default: 'database',
            providers: {
              database: {
                model: () => Promise.resolve({} as any),
              } as any,
            },
          }),
      },
      rcFileContents: {
        providers: [
          () => import('@adonisjs/lucid/database_provider'),
          () => import('@adonisjs/cache/cache_provider'),
          () => import('../providers/currency_provider.js'),
        ],
      },
    })
    .create(BASE_URL, {
      importer: (filePath) => {
        if (filePath.startsWith('./') || filePath.startsWith('../')) {
          return import(new URL(filePath, BASE_URL).href)
        }

        return import(filePath)
      },
    })

  const app = ignitor.createApp(env || 'web')
  await app.init().then(() => app.boot())

  getActiveTest()?.cleanup(() => app.terminate())

  return app
}
