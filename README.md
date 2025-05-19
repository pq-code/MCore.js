# MCore.js

轻量级微服务基础框架，提供各服务通用的基础功能和标准组件。

## 特性

- 🚀 简单易用：直观的API设计，低学习成本
- 🔌 渐进式采用：支持按需引入模块，灵活组合
- 🛡️ 安全可靠：内置安全防护，优雅的错误处理
- 📦 模块化：松耦合设计，易于扩展
- 🔄 生命周期管理：完整的应用生命周期控制
- 🎯 最佳实践：内置常用功能，遵循最佳实践

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