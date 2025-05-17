# 缓存模块

缓存模块提供了灵活而强大的缓存功能，支持多种缓存策略和存储方式。

## 功能特性

- 支持多种缓存实现（内存缓存、Redis缓存）
- 统一的缓存管理器接口
- 灵活的缓存过期策略
- 缓存指标统计

## 快速开始

### 基本使用

```javascript
const { cache } = require('@carturns/common-lib');

// 创建缓存管理器
const cacheManager = cache.createCacheManager();

// 使用缓存
await cacheManager.set('user:1', { id: 1, name: '张三' }, { ttl: 3600 });
const user = await cacheManager.get('user:1');
```

### 使用Redis缓存

```javascript
const { cache } = require('@carturns/common-lib');

// 创建Redis缓存
const redisCache = cache.createCache({
  type: 'redis',
  host: 'localhost',
  port: 6379,
  keyPrefix: 'myapp:'
});

// 设置缓存
await redisCache.set('config', { theme: 'dark' }, { ttl: 86400 });
```

### 使用缓存管理器管理多个缓存

```javascript
const { cache } = require('@carturns/common-lib');

// 创建缓存管理器
const cacheManager = cache.createCacheManager({
  caches: {
    default: { type: 'memory', maxSize: 1000 },
    redis: { type: 'redis', host: 'localhost' },
    session: { type: 'memory', defaultTTL: 1800000 }
  }
});

// 使用不同的缓存
await cacheManager.set('config', { debug: true }, { cacheName: 'default' });
await cacheManager.set('user:1', { id: 1 }, { cacheName: 'redis' });
await cacheManager.set('token:123', { userId: 1 }, { cacheName: 'session' });
```

## 缓存类型

### 内存缓存 (MemoryCache)

基于JavaScript Map实现的内存缓存，适用于单节点服务或非共享数据。

```javascript
const memoryCache = cache.createCache({
  type: 'memory',
  maxSize: 1000,            // 最大缓存项数
  defaultTTL: 60000,        // 默认过期时间（毫秒）
  checkPeriod: 60000        // 定期清理间隔（毫秒）
});
```

### Redis缓存 (RedisCache)

基于Redis的分布式缓存，适用于多节点服务或需要共享数据的场景。

```javascript
const redisCache = cache.createCache({
  type: 'redis',
  host: 'localhost',         // Redis主机
  port: 6379,                // Redis端口
  password: 'secret',        // Redis密码
  db: 0,                     // Redis数据库
  keyPrefix: 'cache:',       // 键前缀
  defaultTTL: 60             // 默认过期时间（秒）
});
```

## 缓存管理器

缓存管理器提供了统一的接口来管理多个缓存实例。

```javascript
const cacheManager = cache.createCacheManager({
  defaultCacheName: 'default',  // 默认缓存名称
  caches: {
    default: { type: 'memory' },
    redis: { type: 'redis', host: 'localhost' }
  }
});
```

## 环境变量配置

缓存模块支持通过环境变量配置：

- `CACHE_TYPE`: 默认缓存类型，可选值：'memory', 'redis', 'none'
- `MEMORY_CACHE_MAX_SIZE`: 内存缓存最大项数
- `MEMORY_CACHE_DEFAULT_TTL`: 内存缓存默认过期时间（毫秒）
- `MEMORY_CACHE_CHECK_PERIOD`: 内存缓存清理间隔（毫秒）
- `REDIS_HOST`: Redis主机
- `REDIS_PORT`: Redis端口
- `REDIS_PASSWORD`: Redis密码
- `REDIS_DB`: Redis数据库
- `REDIS_KEY_PREFIX`: Redis键前缀
- `REDIS_CACHE_DEFAULT_TTL`: Redis缓存默认过期时间（秒） 