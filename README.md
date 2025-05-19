# MCore.js

轻量级微服务基础框架，提供各服务通用的基础功能和标准组件。

## 特性

- 🚀 简单易用：直观的API设计，低学习成本
- 🔌 渐进式采用：支持按需引入模块，灵活组合
- 🛡️ 安全可靠：内置安全防护，优雅的错误处理
- 📦 模块化：松耦合设计，易于扩展
- 🔄 生命周期管理：完整的应用生命周期控制
- 🎯 最佳实践：内置常用功能，遵循最佳实践

## 项目结构

```
mcore.js/
├── src/                    # 源代码目录
│   ├── app/               # 应用核心
│   ├── auth/              # 认证模块
│   ├── cache/             # 缓存系统
│   ├── config/            # 配置管理
│   ├── db/                # 数据库集成
│   ├── hooks/             # 钩子系统
│   ├── logging/           # 日志系统
│   ├── middlewares/       # 中间件
│   ├── monitor/           # 监控系统
│   ├── mq/                # 消息队列
│   ├── registry/          # 服务注册
│   ├── resilience/        # 弹性机制
│   ├── router/            # 路由系统
│   ├── security/          # 安全模块
│   └── utils/             # 工具函数
├── examples/              # 示例代码
├── docs/                  # 文档
└── tests/                # 测试文件
```

## 已实现功能

### 1. 应用核心功能
- ✅ 应用生命周期管理（启动、停止、重启）
- ✅ 优雅关闭支持
- ✅ 进程信号处理
- ✅ 未捕获异常处理
- ✅ 应用状态监控

### 2. 中间件系统
- ✅ 请求ID生成
- ✅ 响应处理器
- ✅ 错误处理中间件
- ✅ HTTP请求日志
- ✅ CORS支持
- ✅ 速率限制
- ✅ Helmet安全头
- ✅ 自定义中间件注册

### 3. 路由系统
- ✅ 路由自动加载
- ✅ 递归目录扫描
- ✅ 多文件格式支持
- ✅ 路由分组
- ✅ 中间件绑定
- ✅ 参数验证

### 4. 服务层
- ✅ 基础服务类
- ✅ 分页处理
- ✅ 缓存管理
- ✅ 事务支持
- ✅ 操作日志
- ✅ 用户服务示例

### 5. 安全特性
- ✅ JWT认证
- ✅ 密码加密
- ✅ XSS防护
- ✅ CSRF防护
- ✅ 请求速率限制
- ✅ 安全响应头

### 6. 工具类
- ✅ 错误处理工具
- ✅ 数据验证工具
- ✅ 日志工具
- ✅ 配置管理
- ✅ 缓存工具

### 7. 开发支持
- ✅ 开发环境配置
- ✅ 测试环境配置
- ✅ 生产环境配置
- ✅ 日志级别控制
- ✅ 调试信息开关

### 8. 监控与可观测性
- ✅ 性能指标收集
- ✅ 健康检查
- ✅ 资源使用监控
- ✅ 请求追踪
- ✅ 错误报告

### 9. 消息队列集成
- ✅ RabbitMQ支持
- ✅ Kafka支持
- ✅ 消息发布/订阅
- ✅ 消息持久化
- ✅ 死信队列

### 10. 缓存系统
- ✅ Redis集成
- ✅ 内存缓存
- ✅ 分布式缓存
- ✅ 缓存策略
- ✅ 缓存预热

### 11. 审计日志
- ✅ 操作审计
- ✅ 安全审计
- ✅ 性能审计
- ✅ 审计日志存储
- ✅ 审计报告

### 12. 服务注册与发现
- ✅ Consul集成
- ✅ 服务注册
- ✅ 服务发现
- ✅ 健康检查
- ✅ 负载均衡

### 13. 数据库集成
- ✅ MongoDB支持
- ✅ MySQL支持
- ✅ 连接池管理
- ✅ 事务支持
- ✅ 数据迁移

### 14. 日志系统
- ✅ 多级别日志
- ✅ 日志轮转
- ✅ 日志聚合
- ✅ 结构化日志
- ✅ 日志分析

### 15. 钩子系统
- ✅ 生命周期钩子
- ✅ 中间件钩子
- ✅ 路由钩子
- ✅ 错误钩子
- ✅ 自定义钩子

### 16. 认证系统
- ✅ JWT认证
- ✅ OAuth2支持
- ✅ 角色权限
- ✅ 会话管理
- ✅ 多因素认证

### 17. 弹性机制
- ✅ 熔断器
- ✅ 重试机制
- ✅ 限流器
- ✅ 降级策略
- ✅ 超时控制

## 快速开始

### 安装

```bash
npm install mcore.js
```

### 最小示例

```javascript
const { createApp } = require('mcore.js');

// 创建应用实例
const app = createApp({
  name: 'my-app',
  port: 3000
});

// 启动应用
app.start();
```

### 完整示例

```javascript
const { createApp } = require('mcore.js');

// 创建应用实例
const app = createApp({
  name: 'my-app',
  port: 3000,
  
  // 中间件配置
  middleware: {
    errorHandler: {
      enabled: true,
      options: {
        showStack: process.env.NODE_ENV === 'development'
      }
    },
    requestLogger: {
      enabled: true,
      options: {
        level: 'info'
      }
    }
  },
  
  // 生命周期配置
  lifecycle: {
    shutdownTimeout: 5000,
    gracefulShutdown: true
  }
});

// 注册路由
app.loadRoutes('routes');

// 注册生命周期钩子
app.on('beforeStart', async ({ app }) => {
  // 初始化数据库连接等
});

app.on('afterStart', async ({ app }) => {
  // 启动后的工作
});

// 启动应用
app.start();
```

## 核心功能

### 1. 应用生命周期管理

```javascript
const app = createApp({
  name: 'lifecycle-demo',
  port: 3000,
  lifecycle: {
    shutdownTimeout: 5000,
    gracefulShutdown: true
  }
});

// 生命周期钩子
app.on('beforeStart', async ({ app }) => {
  // 初始化工作
});

app.on('afterStart', async ({ app }) => {
  // 启动后工作
});

app.on('beforeStop', async ({ app }) => {
  // 清理工作
});

// 应用控制
await app.start();
await app.stop();
await app.restart();

// 获取应用状态
const status = app.getStatus();
```

### 2. 中间件管理

```javascript
const app = createApp({
  middleware: {
    // 错误处理中间件
    errorHandler: {
      enabled: true,
      options: {
        showStack: process.env.NODE_ENV === 'development'
      }
    },
    
    // 请求日志中间件
    requestLogger: {
      enabled: true,
      options: {
        level: 'info'
      }
    },
    
    // 安全中间件
    security: {
      enabled: true,
      options: {
        cors: true,
        helmet: true,
        xss: true
      }
    }
  }
});

// 注册自定义中间件
app.registerMiddleware('customLogger', {
  factory: (options) => async (ctx, next) => {
    console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.url}`);
    await next();
  },
  config: {
    enabled: true,
    options: {}
  }
});

// 配置中间件
app.configureMiddleware('requestLogger', {
  enabled: true,
  options: {
    level: 'debug'
  }
});
```

### 3. 路由管理

```javascript
// 自动加载路由
app.loadRoutes('routes', {
  recursive: true,
  fileExtensions: ['.js'],
  excludePatterns: [/\.test\.js$/]
});

// 路由文件示例 (routes/users.js)
module.exports = {
  prefix: '/api/users',
  middlewares: [
    async (ctx, next) => {
      console.log('用户API访问');
      await next();
    }
  ],
  routes: {
    '/': {
      get: async (ctx) => {
        ctx.body = { users: [] };
      },
      post: async (ctx) => {
        ctx.body = { message: '创建成功' };
      }
    },
    '/:id': {
      get: async (ctx) => {
        ctx.body = { id: ctx.params.id };
      }
    }
  }
};
```

### 4. 错误处理

```javascript
// 使用内置错误处理
app.configureMiddleware('errorHandler', {
  enabled: true,
  options: {
    showStack: process.env.NODE_ENV === 'development',
    includeRequestInfo: true
  }
});

// 自定义错误处理
app.on('error', async (err, ctx) => {
  // 自定义错误处理逻辑
  console.error('应用错误:', err);
});
```

## 最佳实践

### 1. 项目结构

```
my-app/
├── src/
│   ├── routes/           # 路由文件
│   ├── controllers/      # 控制器
│   ├── services/         # 业务逻辑
│   ├── models/          # 数据模型
│   ├── middlewares/     # 自定义中间件
│   └── utils/           # 工具函数
├── config/              # 配置文件
├── tests/              # 测试文件
└── app.js             # 应用入口
```

### 2. 配置管理

```javascript
// config/index.js
module.exports = {
  development: {
    port: 3000,
    database: {
      url: 'mongodb://localhost:27017/dev'
    }
  },
  production: {
    port: process.env.PORT,
    database: {
      url: process.env.DATABASE_URL
    }
  }
}[process.env.NODE_ENV || 'development'];
```

### 3. 错误处理

```javascript
// utils/errors.js
class AppError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// 使用示例
throw new AppError('USER_NOT_FOUND', '用户不存在', 404);
```

### 4. 日志管理

```javascript
// 配置日志中间件
app.configureMiddleware('requestLogger', {
  enabled: true,
  options: {
    level: 'info',
    format: 'combined'
  }
});

// 使用日志
app.logger.info('应用启动');
app.logger.error('发生错误', { error: err });
```

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

ISC 