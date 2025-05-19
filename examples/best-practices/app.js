/**
 * 最佳实践示例应用
 * 展示如何使用MCore.js框架构建一个完整的应用
 */

const { createApp } = require('../../src');
const config = require('./config');
const middlewares = require('./middlewares');
const services = require('./services');

// 创建应用实例
const app = createApp({
  name: 'best-practices-demo',
  port: config.port,
  
  // 中间件配置
  middleware: {
    // 错误处理中间件
    errorHandler: {
      enabled: true,
      options: {
        showStack: process.env.NODE_ENV === 'development',
        includeRequestInfo: true
      }
    },
    
    // 请求日志中间件
    requestLogger: {
      enabled: true,
      options: {
        level: 'info',
        format: 'combined'
      }
    },
    
    // 安全中间件
    security: {
      enabled: true,
      options: {
        cors: {
          origin: config.cors.origin,
          allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
        },
        helmet: true,
        xss: true
      }
    }
  },
  
  // 生命周期配置
  lifecycle: {
    shutdownTimeout: 5000,
    gracefulShutdown: true
  }
});

// 注册自定义中间件
app.registerMiddleware('requestId', middlewares.requestId);
app.registerMiddleware('responseTime', middlewares.responseTime);

// 注册生命周期钩子
app.on('beforeStart', async ({ app }) => {
  // 初始化数据库连接
  await services.database.connect();
  app.logger.info('数据库连接已建立');
  
  // 初始化缓存
  await services.cache.connect();
  app.logger.info('缓存服务已连接');
});

app.on('afterStart', async ({ app }) => {
  // 注册服务
  await services.registry.register({
    name: app.options.name,
    port: app.options.port
  });
  app.logger.info('服务已注册');
  
  // 启动定时任务
  services.scheduler.start();
  app.logger.info('定时任务已启动');
});

app.on('beforeStop', async ({ app }) => {
  // 停止定时任务
  services.scheduler.stop();
  app.logger.info('定时任务已停止');
  
  // 注销服务
  await services.registry.deregister(app.options.name);
  app.logger.info('服务已注销');
});

app.on('afterStop', async ({ app }) => {
  // 关闭缓存连接
  await services.cache.disconnect();
  app.logger.info('缓存服务已断开');
  
  // 关闭数据库连接
  await services.database.disconnect();
  app.logger.info('数据库连接已关闭');
});

// 注册路由
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes(app.router));

// 启动应用
app.start().catch(err => {
  console.error('应用启动失败:', err);
  process.exit(1);
}); 