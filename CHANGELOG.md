# Changelog

All notable changes to this project will be documented in this file.



## 1.0.1 (2025-07-19)

# 1.0.0 (2025-07-19)

## [1.0.0-beta.1] - 2025-07-19

### Added
- Initial release of CurrencyX AdonisJS integration
- Database provider with Lucid ORM support
- Base currency concept with automatic cross-rate calculations
- Cache support with @adonisjs/cache integration
- Type-safe configuration with module augmentation
- Automatic model and migration generation via `node ace configure`
- Comprehensive test suite with 23 tests
- Support for real database schema with exchange_rate column
- Flexible cache configuration (false | CacheConfig)

### Features
- **Database Provider**: Full Lucid ORM integration for storing exchange rates
- **Service Provider**: Auto-registration with AdonisJS IoC container
- **Configuration**: AdonisJS-style config with environment validation
- **Type Safety**: Full TypeScript support with module augmentation
- **Cache Support**: Optional caching with @adonisjs/cache
- **Auto Setup**: Automatic model and migration generation
- **Well Tested**: Comprehensive test suite

### Technical Details
- Base currency support (default: USD)
- Column mapping for custom database schemas
- Cross-rate calculations (EUR → GBP = GBP_rate / EUR_rate)
- Error handling with graceful fallbacks
- Cache key pattern: `currency:rate:USD:EUR`
