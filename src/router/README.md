# 路由模块

CarTurns 微服务共享基础库的路由模块提供了简单而强大的路由管理功能，帮助开发者快速定义和管理 API 路由。

## 基本用法

### 创建简单路由

```javascript
const { createRouter } = require('@carturns/common-lib').router;

// 创建路由实例
const router = createRouter({ prefix: '/api/v1' });

// 定义路由
router.get('/users', async (ctx) => {
  ctx.body = { users: [] };
});

router.post('/users', async (ctx) => {
  ctx.body = { message: '用户创建成功' };
});

// 导出路由
module.exports = router;
```

### 使用路由构建器

```javascript
const { createRouterBuilder } = require('@carturns/common-lib').router;

// 创建路由构建器
const builder = createRouterBuilder({ prefix: '/api/v1' });

// 添加全局中间件
const authMiddleware = async (ctx, next) => {
  // 验证逻辑
  await next();
};

builder.use(authMiddleware);

// 定义路由组
builder.group('/users', (r) => {
  // GET /api/v1/users
  r.get('/', async (ctx) => {
    ctx.body = { users: [] };
  });
  
  // POST /api/v1/users
  r.post('/', async (ctx) => {
    ctx.body = { message: '用户创建成功' };
  });
  
  // GET /api/v1/users/:id
  r.get('/:id', async (ctx) => {
    ctx.body = { id: ctx.params.id };
  });
});

// 构建并导出路由
module.exports = builder.build();
```

### RESTful 资源路由

```javascript
const { createRouter, restful } = require('@carturns/common-lib').router;

// 创建路由实例
const router = createRouter({ prefix: '/api/v1' });

// 控制器对象
const usersController = {
  list: async (ctx) => {
    ctx.body = { users: [] };
  },
  create: async (ctx) => {
    ctx.body = { message: '用户创建成功' };
  },
  get: async (ctx) => {
    ctx.body = { id: ctx.params.id };
  },
  update: async (ctx) => {
    ctx.body = { message: '用户更新成功' };
  },
  delete: async (ctx) => {
    ctx.body = { message: '用户删除成功' };
  }
};

// 注册 RESTful 路由
restful(router, '/users', usersController);

// 导出路由
module.exports = router;
```

### 使用 RouterBuilder 的资源路由

```javascript
const { createRouterBuilder } = require('@carturns/common-lib').router;

// 创建路由构建器
const builder = createRouterBuilder({ prefix: '/api/v1' });

// 控制器对象
const productsController = {
  index: async (ctx) => {
    ctx.body = { products: [] };
  },
  create: async (ctx) => {
    ctx.body = { message: '产品创建成功' };
  },
  show: async (ctx) => {
    ctx.body = { id: ctx.params.id };
  },
  update: async (ctx) => {
    ctx.body = { message: '产品更新成功' };
  },
  destroy: async (ctx) => {
    ctx.body = { message: '产品删除成功' };
  }
};

// 注册资源路由
builder.resource('/products', productsController);

// 构建并导出路由
module.exports = builder.build();
```

### 自动加载路由文件

在应用启动文件中：

```javascript
const { loadRoutes } = require('@carturns/common-lib').router;
const path = require('path');

// 创建应用实例
const app = createApp();

// 自动加载路由文件
loadRoutes(path.join(__dirname, 'routes'), app, { prefix: '/api/v1' });

// 启动应用
app.start();
```

## 高级功能

### 嵌套路由组

```javascript
const { createRouterBuilder } = require('@carturns/common-lib').router;

const builder = createRouterBuilder({ prefix: '/api/v1' });

// 认证中间件
const authMiddleware = async (ctx, next) => {
  // 验证逻辑
  await next();
};

// 管理员中间件
const adminMiddleware = async (ctx, next) => {
  // 管理员验证逻辑
  await next();
};

// 认证组
builder.group('/auth', (r) => {
  r.post('/login', async (ctx) => {
    ctx.body = { token: 'xxx' };
  });
  
  r.post('/register', async (ctx) => {
    ctx.body = { message: '注册成功' };
  });
});

// 受保护组
builder.group('/admin', (r) => {
  // 添加管理员中间件
  r.use(adminMiddleware);
  
  // 用户管理嵌套组
  r.group('/users', (users) => {
    users.get('/', async (ctx) => {
      ctx.body = { users: [] };
    });
    
    users.post('/', async (ctx) => {
      ctx.body = { message: '用户创建成功' };
    });
  });
  
  // 系统管理
  r.group('/system', (system) => {
    system.get('/stats', async (ctx) => {
      ctx.body = { stats: {} };
    });
  });
}, authMiddleware);

module.exports = builder.build();
```

## 最佳实践

1. 按功能或资源类型组织路由文件
2. 使用中间件处理通用逻辑，如认证、日志记录等
3. 使用路由组将相关路由分组
4. 对于标准 CRUD 操作，使用 RESTful 资源路由
5. 对于大型应用，使用自动加载机制加载路由文件 