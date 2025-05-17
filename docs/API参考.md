# MCore.js API参考文档

## 目录

1. [App模块](#1-app模块)
2. [API模块](#2-api模块)
3. [Auth模块](#3-auth模块)
4. [Cache模块](#4-cache模块)
5. [Resilience模块](#5-resilience模块)
6. [Security模块](#6-security模块)
7. [Monitor模块](#7-monitor模块)
8. [Registry模块](#8-registry模块)
9. [Logging模块](#9-logging模块)

## 1. App模块

App模块是MCore.js的核心，用于创建和管理微服务应用。

### 1.1 创建应用

```javascript
const { createApp } = require('mcore.js');

const app = createApp({
  name: 'my-service',            // 服务名称
  port: 3000,                    // 服务端口
  version: '1.0.0',              // 服务版本
  logger: {                      // 日志配置
    level: 'info',
    transport: 'console'
  },
  cors: {                        // CORS配置
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  bodyParser: {                  // 请求体解析配置
    jsonLimit: '1mb'
  },
  registry: {                    // 服务注册配置
    enabled: true,
    type: 'consul',
    consul: {
      host: 'localhost',
      port: 8500
    }
  }
});
```

### 1.2 注册路由

```javascript
// 方法1: 注册路由函数
app.registerRoutes((app, baseApp) => {
  baseApp.publicRouter.get('/api/ping', (ctx) => {
    ctx.body = { message: 'pong' };
  });
  
  baseApp.protectedRouter.get('/api/user', async (ctx) => {
    // 受保护的路由...
  });
});

// 方法2: 加载路由目录
app.loadRoutes('./src/routes');
```

### 1.3 数据库初始化

```javascript
await app.initDatabase({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'mydb',
  modelsDir: './src/models',
  sync: true
});
```

### 1.4 启动应用

```javascript
await app.start();
```

### 1.5 注册钩子

```javascript
// 注册应用启动前钩子
app.hook('beforeStart', async (context) => {
  console.log('应用即将启动...');
  return context;
});

// 注册响应前钩子
app.hook('beforeResponse', async (context) => {
  const { health } = context;
  // 修改健康状态信息
  health.version = 'v1.0.1';
  return { ...context, health };
});
```

## 2. API模块

API模块提供标准化的API响应格式和错误处理。

### 2.1 创建标准响应

```javascript
const { api } = require('mcore.js');

// 创建成功响应
const successResponse = api.createResponse({
  data: { id: 1, name: '用户' },
  message: '操作成功'
});
// 输出: { code: 0, data: { id: 1, name: '用户' }, message: '操作成功' }

// 创建分页响应
const pageResponse = api.createPageResponse({
  list: [{ id: 1 }, { id: 2 }],
  total: 100,
  page: 1,
  pageSize: 10
});
```

### 2.2 创建错误响应

```javascript
// 创建错误响应
const errorResponse = api.createErrorResponse({
  code: 40400,
  message: '资源不存在'
});
// 输出: { code: 40400, message: '资源不存在', success: false }

// 使用预定义错误码
const notFoundError = api.createErrorResponse({
  code: api.RESPONSE_CODES.NOT_FOUND,
  message: '用户不存在'
});
```

### 2.3 参数验证

```javascript
const { api } = require('mcore.js');

// 定义验证规则
const rules = {
  username: { type: 'string', required: true, min: 3, max: 20 },
  password: { type: 'string', required: true, min: 6 },
  email: { type: 'email', required: true }
};

// 验证参数
const params = { username: 'test', password: '123', email: 'invalid' };
const { valid, errors } = api.validator.validate(params, rules);

if (!valid) {
  const errorResponse = api.createErrorResponse({
    code: api.RESPONSE_CODES.VALIDATION_ERROR,
    message: '参数验证失败',
    errors
  });
}
```

## 3. Auth模块

Auth模块提供认证和授权功能。

### 3.1 JWT认证

```javascript
const { auth } = require('mcore.js');

// 创建JWT管理器
const jwtManager = auth.jwt.createManager({
  secret: 'your-secret-key',
  expiresIn: '8h'
});

// 生成令牌
const token = jwtManager.sign({ userId: 123, role: 'admin' });

// 验证令牌
try {
  const payload = jwtManager.verify(token);
  console.log('认证成功', payload);
} catch (error) {
  console.error('认证失败', error.message);
}

// 创建JWT中间件
const jwtMiddleware = auth.middleware.jwt({
  secret: 'your-secret-key',
  isRevoked: async (payload, token) => {
    // 检查令牌是否被撤销
    return false;
  }
});

// 添加中间件到应用
app.protectedRouter.use(jwtMiddleware);
```

### 3.2 权限控制

```javascript
const { auth } = require('mcore.js');

// 创建RBAC权限管理器
const rbacManager = auth.rbac.createManager();

// 添加角色和权限
rbacManager.addRole('admin');
rbacManager.addRole('user');
rbacManager.addPermission('user:read');
rbacManager.addPermission('user:write');

// 分配权限给角色
rbacManager.grantPermission('admin', 'user:read');
rbacManager.grantPermission('admin', 'user:write');
rbacManager.grantPermission('user', 'user:read');

// 检查权限
const hasPermission = await rbacManager.checkPermission('admin', 'user:write');
```

## 4. Cache模块

Cache模块提供缓存功能，支持内存缓存和Redis缓存。

### 4.1 创建缓存管理器

```javascript
const { cache } = require('mcore.js');

// 创建内存缓存
const memoryCache = cache.createCacheManager({
  type: 'memory',
  defaultTTL: 300 // 默认缓存5分钟
});

// 创建Redis缓存
const redisCache = cache.createCacheManager({
  type: 'redis',
  redis: {
    host: 'localhost',
    port: 6379
  },
  defaultTTL: 300
});
```

### 4.2 基本缓存操作

```javascript
// 设置缓存
await memoryCache.set('key', { data: 'value' }, 60); // 缓存60秒

// 获取缓存
const value = await memoryCache.get('key');
console.log(value); // { data: 'value' }

// 删除缓存
await memoryCache.del('key');

// 检查缓存是否存在
const exists = await memoryCache.has('key');

// 清空所有缓存
await memoryCache.clear();
```

### 4.3 高级缓存模式

```javascript
// 获取或设置缓存
const data = await memoryCache.getOrSet('user:123', async () => {
  // 当缓存不存在时执行此函数
  return await fetchUserFromDatabase(123);
}, 300); // 缓存300秒

// 带标签的缓存，方便批量失效
await memoryCache.set('user:1', userData1, 300, ['users', 'active']);
await memoryCache.set('user:2', userData2, 300, ['users', 'inactive']);

// 按标签清除缓存
await memoryCache.clearByTags(['inactive']);
```

## 5. Resilience模块

Resilience模块提供限流、熔断、重试等弹性功能。

### 5.1 限流器

```javascript
const { resilience } = require('mcore.js');

// 创建限流器
const rateLimiter = resilience.createRateLimiter({
  points: 10,        // 每个时间窗口允许的请求数
  duration: 1,       // 时间窗口（秒）
  blockDuration: 60, // 达到限制后的阻塞时间（秒）
  keyPrefix: 'rl'    // 键前缀
});

// 使用限流器
try {
  // 消耗一个令牌，如果超出限制会抛出异常
  await rateLimiter.consume('user:123');
  
  // 处理请求...
  
} catch (error) {
  // 请求被限流
  console.error('请求被限流', error.message);
}
```

### 5.2 熔断器

```javascript
const { resilience } = require('mcore.js');

// 创建熔断器
const circuitBreaker = resilience.createCircuitBreaker(
  async (id) => {
    // 被保护的函数
    return await fetchUserFromApi(id);
  },
  {
    name: 'userApiBreaker',        // 熔断器名称
    failureThreshold: 50,          // 失败阈值（百分比）
    failureCountThreshold: 5,      // 触发熔断的失败次数
    resetTimeout: 10000,           // 熔断后尝试恢复的时间（毫秒）
    halfOpenSuccessThreshold: 3    // 半开状态下成功多少次后闭合
  }
);

// 使用熔断器
try {
  const user = await circuitBreaker.exec(123);
} catch (error) {
  // 操作失败或熔断器打开
  console.error('服务不可用', error.message);
}

// 订阅熔断器状态变化
circuitBreaker.onStateChange((oldState, newState) => {
  console.log(`熔断器状态从${oldState}变为${newState}`);
});
```

### 5.3 重试策略

```javascript
const { resilience } = require('mcore.js');

// 创建重试策略
const retry = resilience.createRetry({
  maxRetries: 3,                     // 最大重试次数
  delay: 1000,                       // 初始延迟（毫秒）
  strategy: 'exponential',           // 重试策略: 'fixed', 'exponential', 'fibonacci'
  multiplier: 2,                     // 指数增长的乘数
  retryOn: (error) => error.retryable // 判断是否需要重试的函数
});

// 使用重试
try {
  const result = await retry.execute(async () => {
    // 可能失败的操作
    return await fetchDataFromService();
  });
} catch (error) {
  // 重试多次后仍然失败
  console.error('操作失败', error.message);
}
```

### 5.4 超时控制

```javascript
const { resilience } = require('mcore.js');

// 创建超时控制
const timeout = resilience.createTimeout({
  timeout: 5000 // 超时时间（毫秒）
});

// 使用超时
try {
  const result = await timeout.execute(async () => {
    // 可能超时的操作
    return await longRunningOperation();
  });
} catch (error) {
  // 操作超时
  console.error('操作超时', error.message);
}
```

### 5.5 组合多种弹性策略

```javascript
const { resilience } = require('mcore.js');

async function fetchUserWithResilience(id) {
  const timeout = resilience.createTimeout({ timeout: 3000 });
  const retry = resilience.createRetry({ maxRetries: 3 });
  const circuitBreaker = resilience.createCircuitBreaker(fetchUserFromApi);
  
  return await timeout.execute(async () => {
    return await retry.execute(async () => {
      return await circuitBreaker.exec(id);
    });
  });
}
```

## 6. Security模块

Security模块提供各种安全功能。

### 6.1 加密与解密

```javascript
const { security } = require('mcore.js');

// AES加密
const { encrypted, iv, authTag } = security.encryption.aesEncrypt(
  '敏感数据',
  'your-secret-key'
);

// AES解密
const decrypted = security.encryption.aesDecrypt(
  encrypted,
  'your-secret-key',
  iv,
  authTag
);

// RSA密钥对生成
const { publicKey, privateKey } = security.encryption.generateRSAKeyPair();

// RSA加密解密
const rsaEncrypted = security.encryption.rsaEncrypt('敏感数据', publicKey);
const rsaDecrypted = security.encryption.rsaDecrypt(rsaEncrypted, privateKey);
```

### 6.2 密码处理

```javascript
const { security } = require('mcore.js');

// 哈希密码
const hashedPassword = await security.password.hashPassword('user-password');

// 验证密码
const isValid = await security.password.verifyPassword(
  'input-password',
  hashedPassword
);

// 生成随机密码
const randomPassword = security.password.generatePassword({
  length: 12,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true
});

// 检查密码强度
const strength = security.password.checkPasswordStrength('input-password');
```

### 6.3 CSRF防护

```javascript
const { security } = require('mcore.js');

// 创建CSRF中间件
const csrfMiddleware = security.csrf.createCorsMiddleware({
  secret: 'your-csrf-secret',
  cookieName: 'csrf-token',
  headerName: 'X-CSRF-Token'
});

// 添加中间件
app.use(csrfMiddleware);

// 获取CSRF令牌
app.publicRouter.get('/csrf-token', (ctx) => {
  ctx.body = { token: ctx.state.csrfToken };
});
```

### 6.4 XSS防护

```javascript
const { security } = require('mcore.js');

// 转义HTML
const escapedHtml = security.xss.escapeHtml('<script>alert("XSS")</script>');

// 创建内容过滤器（使用白名单）
const filter = security.xss.createContentFilter({
  allowedTags: ['p', 'span', 'b', 'i', 'em', 'strong'],
  allowedAttributes: {
    'p': ['class'],
    'span': ['class']
  }
});

// 过滤HTML
const cleanHtml = filter.process('<p class="text"><script>alert("XSS")</script><span>安全内容</span></p>');

// XSS中间件
const xssMiddleware = security.xss.middleware.koa();
app.use(xssMiddleware);
```

### 6.5 跨域资源共享(CORS)

```javascript
const { security } = require('mcore.js');

// 创建CORS中间件
const corsMiddleware = security.cors.createCorsMiddleware({
  origin: ['https://example.com', 'https://api.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
  credentials: true
});

// 添加中间件
app.use(corsMiddleware);
```

### 6.6 安全头设置

```javascript
const { security } = require('mcore.js');

// 创建安全头中间件
const helmetMiddleware = security.helmet.createHelmetMiddleware({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  xssFilter: true,
  hsts: {
    maxAge: 15552000,
    includeSubDomains: true
  },
  noSniff: true
});

// 添加中间件
app.use(helmetMiddleware);
```

## 7. Monitor模块

Monitor模块提供监控和指标收集功能。

### 7.1 健康检查

```javascript
const { monitor } = require('mcore.js');

// 创建健康检查器
const healthChecker = monitor.createHealthChecker({
  serviceName: 'my-service',
  version: '1.0.0'
});

// 添加数据库健康检查
healthChecker.addCheck('database', async () => {
  try {
    await checkDatabaseConnection();
    return { status: 'UP' };
  } catch (error) {
    return {
      status: 'DOWN',
      details: { message: '数据库连接失败', error: error.message }
    };
  }
});

// 添加依赖服务检查
healthChecker.addDependency('auth-service', 'http', {
  checkFn: async () => {
    try {
      const response = await fetch('http://auth-service/health');
      if (response.ok) {
        return { status: 'UP' };
      }
      return {
        status: 'DOWN',
        details: { message: '认证服务不健康' }
      };
    } catch (error) {
      return {
        status: 'DOWN',
        details: { message: '认证服务不可达', error: error.message }
      };
    }
  },
  critical: true
});

// 添加健康检查中间件
app.use(monitor.middleware.health.koa(healthChecker, {
  path: '/health',
  liveness: true,
  readiness: true
}));
```

### 7.2 指标收集

```javascript
const { monitor } = require('mcore.js');

// 创建指标收集器
const metricsCollector = monitor.createMetricsCollector({
  prefix: 'my_service_',
  defaultMetrics: true,
  labels: {
    service: 'my-service',
    environment: 'production'
  }
});

// 注册计数器
const requestCounter = metricsCollector.registerCounter(
  'http_requests_total',
  'HTTP请求总数',
  ['method', 'path', 'status']
);

// 注册直方图
const requestDuration = metricsCollector.registerHistogram(
  'http_request_duration_seconds',
  'HTTP请求耗时',
  ['method', 'path'],
  {
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 10]
  }
);

// 注册仪表
const activeSessions = metricsCollector.registerGauge(
  'active_sessions',
  '活跃会话数',
  ['app']
);

// 使用指标
requestCounter.inc({ method: 'GET', path: '/api/users', status: 200 });
requestDuration.observe({ method: 'GET', path: '/api/users' }, 0.42);
activeSessions.set({ app: 'web' }, 123);

// 添加指标中间件
app.use(monitor.middleware.metrics.koa(metricsCollector, {
  path: '/metrics'
}));

// 添加HTTP指标中间件
app.use(monitor.middleware.httpMetrics.koa(metricsCollector, {
  ignorePaths: ['/health', '/metrics']
}));
```

## 8. Registry模块

Registry模块提供服务注册与发现功能。

### 8.1 服务注册

```javascript
const { registry } = require('mcore.js');

// 创建服务注册器
const serviceRegistry = registry.createRegistry({
  type: 'consul',
  consul: {
    host: 'localhost',
    port: 8500
  },
  service: {
    name: 'my-service',
    port: 3000,
    tags: ['api', 'v1'],
    check: {
      http: 'http://localhost:3000/health',
      interval: '15s',
      timeout: '5s'
    }
  }
});

// 注册服务
await serviceRegistry.register();

// 优雅关闭时注销服务
process.on('SIGINT', async () => {
  await serviceRegistry.deregister();
  process.exit(0);
});
```

### 8.2 服务发现

```javascript
const { registry } = require('mcore.js');

// 创建服务发现器
const serviceDiscovery = registry.createDiscovery({
  type: 'consul',
  consul: {
    host: 'localhost',
    port: 8500
  },
  cache: {
    enabled: true,
    ttl: 60 // 缓存60秒
  }
});

// 发现服务实例
const instances = await serviceDiscovery.getService('user-service');

// 使用负载均衡器选择一个实例
const instance = serviceDiscovery.loadBalancer.next('user-service');

// 获取服务的健康实例
const healthyInstances = await serviceDiscovery.getHealthyService('user-service');
```

## 9. Logging模块

Logging模块提供日志记录功能。

### 9.1 创建日志工厂

```javascript
const { logging } = require('mcore.js');

// 创建日志工厂
const loggerFactory = logging.createLoggerFactory({
  level: 'info',
  format: 'json',
  colors: true,
  timestamp: true,
  transports: [
    { type: 'console' },
    {
      type: 'file',
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d'
    }
  ]
});

// 创建特定模块的日志记录器
const logger = loggerFactory.createLogger('auth-service');
```

### 9.2 使用日志记录

```javascript
// 记录不同级别的日志
logger.error('严重错误', { error: err.message, stack: err.stack });
logger.warn('警告信息', { user: userId });
logger.info('普通信息', { orderId: 12345 });
logger.debug('调试信息', { query: req.query });

// 使用占位符
logger.info('用户 %s 登录成功，角色: %s', userId, role);

// 记录带元数据的日志
logger.info('处理请求完成', {
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  duration: Date.now() - startTime
});
```

### 9.3 自定义日志格式

```javascript
const { logging } = require('mcore.js');

// 创建自定义日志格式
const customFormat = logging.format.combine(
  logging.format.timestamp(),
  logging.format.label({ label: 'my-service' }),
  logging.format.json({
    space: process.env.NODE_ENV === 'development' ? 2 : 0
  })
);

// 使用自定义格式
const loggerFactory = logging.createLoggerFactory({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat
});
``` 