# MCore.js

轻量级微服务基础框架，提供各服务通用的基础功能和标准组件。

## 功能特性

- ✅ API标准模块：统一的API响应格式和错误处理
- ✅ 服务注册与发现：基于Consul的服务注册与发现
- ✅ 审计模块：操作审计日志记录
- ✅ 缓存模块：支持内存缓存和Redis缓存
- ✅ 消息队列集成：支持RabbitMQ和Kafka，统一的消息发布/订阅接口
- ✅ 限流和熔断机制：RateLimiter、CircuitBreaker、BulkheadPattern和Retry等弹性组件
- ✅ 配置中心集成：支持多种配置源，配置热更新
- ✅ 监控与指标收集：健康检查、性能指标收集和导出
- ✅ 安全模块：加密、哈希、密码处理、CSRF防护、XSS防护和访问控制

## 安装

```bash
npm install --save @carturns/common-lib
```

## 使用示例

### 创建应用

```javascript
const { createApp } = require('@carturns/common-lib');

const app = createApp({
  name: 'user-service',
  port: 3000
});

app.start();
```

### API标准模块

```javascript
const { api } = require('@carturns/common-lib');

// 创建标准响应
const response = api.createResponse({
  data: { id: 1, name: 'User' },
  message: '获取用户成功'
});

// 创建错误响应
const errorResponse = api.createErrorResponse({
  code: 'USER_NOT_FOUND',
  message: '用户不存在'
});
```

### 服务注册与发现

```javascript
const { registry } = require('@carturns/common-lib');

// 注册服务
const service = registry.registerService({
  name: 'user-service',
  address: 'localhost',
  port: 3000,
  tags: ['api', 'v1']
});

// 发现服务
const services = await registry.discoverService('order-service');
```

### 审计模块

```javascript
const { audit } = require('@carturns/common-lib');

// 记录审计日志
audit.log({
  action: 'USER_CREATE',
  userId: '123',
  targetId: '456',
  targetType: 'USER',
  details: { name: 'New User' }
});
```

### 缓存模块

```javascript
const { cache } = require('@carturns/common-lib');

// 使用内存缓存
const memoryCache = cache.createMemoryCache();
await memoryCache.set('key', 'value', 60); // 缓存60秒
const value = await memoryCache.get('key');

// 使用Redis缓存
const redisCache = cache.createRedisCache({
  host: 'localhost',
  port: 6379
});
await redisCache.set('key', { complex: 'object' }, 300); // 缓存300秒
const object = await redisCache.get('key');
```

### 消息队列集成

```javascript
const { mq } = require('@carturns/common-lib');

// 创建RabbitMQ消息队列
const rabbitmq = mq.createRabbitMQClient({
  url: 'amqp://localhost'
});

// 发布消息
await rabbitmq.publish('exchange', 'routing.key', { message: 'Hello' });

// 订阅消息
rabbitmq.subscribe('queue', async (message) => {
  console.log('Received:', message);
});
```

### 弹性模块

```javascript
const { resilience } = require('@carturns/common-lib');

// 限流器
const rateLimiter = resilience.createRateLimiter({
  points: 10,
  duration: 1
});

// 熔断器
const circuitBreaker = resilience.createCircuitBreaker(
  async (id) => {
    // 调用外部服务...
    return { id, name: 'User' };
  },
  {
    failureThreshold: 50,
    resetTimeout: 10000
  }
);

// 并发限制
const bulkhead = resilience.createBulkhead({
  maxConcurrent: 10,
  maxQueueSize: 100
});

// 重试策略
const retry = resilience.createRetry({
  maxRetries: 3,
  strategy: 'exponential'
});

// 超时控制
const timeout = resilience.createTimeout({
  timeout: 5000
});

// 降级策略
const fallback = resilience.createFallback({
  fallbackFunction: (error, ...args) => {
    return { error: true, message: '服务暂时不可用' };
  }
});

// 使用单一弹性组件
try {
  await rateLimiter.consume('user:123');
  const result = await circuitBreaker.exec(123);
} catch (error) {
  console.error('操作被限制或熔断');
}

// 组合多个弹性组件
async function getUserWithResilience(id) {
  return await timeout.execute(async () => {
    return await retry.execute(async () => {
      return await circuitBreaker.exec(id);
    });
  });
}
```

### 配置中心集成

```javascript
const { config } = require('@carturns/common-lib');

// 创建配置管理器
const configManager = config.createConfigManager({
  providers: [
    // 文件配置提供者
    new config.providers.FileProvider({
      path: './config.json',
      watch: true
    }),
    // Consul配置提供者
    new config.providers.ConsulProvider({
      prefix: 'config/user-service',
      watch: true
    })
  ],
  autoRefresh: true
});

// 获取配置
const dbConfig = configManager.get('database');

// 监听配置变更
configManager.on('change:database.host', (newValue, oldValue) => {
  console.log(`数据库主机从${oldValue}变更为${newValue}`);
});
```

### 监控与指标收集

```javascript
const { monitor } = require('@carturns/common-lib');

// 创建指标收集器
const metricsCollector = monitor.createMetricsCollector({
  prefix: 'user_service_',
  enableDefaultMetrics: true
});

// 注册自定义指标
const userCounter = metricsCollector.registerMetric(
  'users_total', 
  'counter', 
  '用户总数', 
  ['status']
);

// 更新指标
userCounter.inc({ status: 'active' });

// 启动指标收集
metricsCollector.start();

// 创建健康检查器
const healthChecker = monitor.createHealthChecker({
  serviceName: 'user-service'
});

// 添加自定义健康检查
healthChecker.addCheck('database', async () => {
  try {
    await checkDatabaseConnection();
    return { status: 'UP' };
  } catch (error) {
    return { 
      status: 'DOWN', 
      error,
      details: { message: '数据库连接失败' }
    };
  }
});

// 添加依赖服务
healthChecker.addDependency('auth-service', 'rest', {
  critical: true,
  checkFn: async () => {
    try {
      await checkServiceHealth('http://auth-service/health');
      return { status: 'UP' };
    } catch (error) {
      return { status: 'DOWN', error };
    }
  }
});

// 启动健康检查
healthChecker.start();
```

### 安全模块

#### 加密与哈希

```javascript
const { security } = require('@carturns/common-lib');

// AES加密
const { encrypted, iv, authTag } = security.encryption.aesEncrypt('敏感数据', '安全密钥');

// AES解密
const decrypted = security.encryption.aesDecrypt(encrypted, '安全密钥', iv, authTag);

// RSA密钥对生成
const { publicKey, privateKey } = security.encryption.generateRSAKeyPair();

// RSA加密解密
const rsaEncrypted = security.encryption.rsaEncrypt('敏感数据', publicKey);
const rsaDecrypted = security.encryption.rsaDecrypt(rsaEncrypted, privateKey);

// 哈希计算
const hash = security.hash.sha256('数据');
const hmac = security.hash.hmacSha256('数据', '密钥');
```

#### 密码处理

```javascript
const { security } = require('@carturns/common-lib');

// 密码哈希
const hashedPassword = security.password.hashPassword('用户密码');

// 密码验证
const isValid = security.password.verifyPassword('用户输入密码', hashedPassword);

// 生成随机安全密码
const randomPassword = security.password.generatePassword({
  length: 12,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true
});

// 检查密码强度
const strength = security.password.checkPasswordStrength('用户密码');
console.log(`密码强度: ${strength.strength}, 分数: ${strength.score}`);
console.log(`建议: ${strength.feedback.join(', ')}`);
```

#### CSRF防护

```javascript
const { security } = require('@carturns/common-lib');

// 创建CSRF管理器
const csrfManager = security.csrf.createCSRFManager({
  secret: process.env.CSRF_SECRET,
  cookieName: 'csrf_token'
});

// 添加中间件到Koa应用
app.use(csrfManager.koaMiddleware());

// 或添加到Express应用
app.use(csrfManager.expressMiddleware());

// 在模板中使用CSRF令牌
// 例如在Koa中:
// ctx.state.csrfToken 包含生成的令牌
```

#### XSS防护

```javascript
const { security } = require('@carturns/common-lib');

// 转义HTML
const escaped = security.xss.escapeHtml('<script>alert("XSS")</script>');

// 转义整个对象
const cleanObject = security.xss.escapeObject({
  name: '<b>用户名</b>',
  description: '<script>alert("XSS")</script>'
});

// 创建内容过滤器
const filter = security.xss.createContentFilter();
const cleanHtml = filter('<div>允许的HTML<script>alert("不允许")</script></div>');

// 使用XSS防护中间件
app.use(security.xss.middleware.koa());
```

#### 访问控制

```javascript
const { security } = require('@carturns/common-lib');

// 1. 使用函数式访问控制 - 最简单灵活的方式
const functionProvider = security.authorization.createFunctionBasedProvider(
  (subject, action, resource, context) => {
    // 简单示例: 实现自己的权限检查逻辑
    if (!subject) return false;
    
    // 示例：检查资源所有者
    if (action === 'edit' && resource && resource.ownerId === subject.id) {
      return true;
    }
    
    // 示例：根据主体属性判断权限
    if (subject.isAdmin) {
      return true;
    }
    
    return false; // 默认拒绝
  }
);

// 2. 使用基于策略的访问控制 - 更复杂但更分离的方式
const policyProvider = security.authorization.createPolicyBasedProvider();

// 添加策略
policyProvider.addPolicy((subject, action, resource) => {
  // 示例：管理员策略
  return subject && subject.isAdmin;
});

policyProvider.addPolicy((subject, action, resource) => {
  // 示例：资源所有者策略
  return subject && resource && resource.ownerId === subject.id;
});

// 3. 创建授权守卫并用于Web中间件
const guard = security.authorization.createAuthorizationGuard(policyProvider, {
  // 自定义如何从请求上下文中提取主体和资源
  subjectExtractor: (ctx) => ctx.state.user,
  resourceExtractor: async (ctx) => {
    // 可以是异步的, 例如从数据库获取资源
    return { id: ctx.params.id, ownerId: ctx.state.user.id };
  }
});

// 在Koa应用中使用
app.use('/api/articles/:id', guard.createMiddleware('edit').koa);

// 在Express应用中使用
app.use('/api/articles/:id', guard.createMiddleware('edit').express);
```

### 中间件集成

```javascript
const Koa = require('koa');
const { monitor, security } = require('@carturns/common-lib');

const app = new Koa();
const metricsCollector = monitor.createMetricsCollector();
const healthChecker = monitor.createHealthChecker();

// 添加XSS防护中间件
app.use(security.xss.middleware.koa());

// 添加CSRF防护中间件
const csrfManager = security.csrf.createCSRFManager();
app.use(csrfManager.koaMiddleware());

// 添加健康检查中间件
app.use(monitor.middleware.health.koa(healthChecker, {
  path: '/health',
  infoPath: '/info'
}));

// 添加指标中间件
app.use(monitor.middleware.metrics.koa(metricsCollector, {
  path: '/metrics'
}));

// 添加HTTP请求指标收集中间件
app.use(monitor.middleware.httpMetrics.koa(metricsCollector));
```

## 模块结构

- `app`: 基础应用框架
- `router`: 路由模块
- `auth`: 认证模块
- `api`: API标准模块
- `db`: 数据库模块
- `registry`: 服务注册与发现模块
- `logging`: 日志模块
- `audit`: 审计模块
- `cache`: 缓存模块
- `mq`: 消息队列模块
- `resilience`: 弹性模块（限流、熔断等）
- `config`: 配置中心模块
- `monitor`: 监控与指标收集模块
- `security`: 安全模块（加密、哈希、密码、CSRF、XSS、权限控制）
- `hooks`: 钩子系统
- `middlewares`: 中间件集合
- `utils`: 工具函数
- `constants`: 常量定义

## 许可证

ISC 