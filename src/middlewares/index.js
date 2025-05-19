/**
 * 中间件模块
 * 导出所有中间件
 * 
 * 设计理念:
 * 1. 渐进式采用: 用户可以选择使用单个中间件或组合使用
 * 2. 原生兼容: 保持与原生框架中间件用法一致
 * 3. 低学习成本: 统一的接口和命名约定
 * 4. 松耦合: 每个中间件独立工作，不强制依赖框架其他部分
 * 
 * @module middlewares
 */

const responseHandler = require('./responseHandler');
const errorHandler = require('./errorHandler');
const requestId = require('./requestId');
const httpLogger = require('./httpLogger');
const security = require('../security');

// 导出内部中间件函数，确保调用方式一致
module.exports = {
  // 内部中间件 - 提供工厂函数和直接访问两种方式
  responseHandler: () => responseHandler(),
  errorHandler: () => errorHandler(),
  requestId: (options) => requestId(options),
  httpLogger: (options) => httpLogger(options),
  
  // 安全中间件 - 保持与原生中间件兼容的接口
  cors: (options) => security.cors.createCorsMiddleware(options),
  rateLimit: (options) => security.rateLimit.createRateLimitMiddleware(options),
  helmet: (options) => security.helmet.createHelmetMiddleware(options),
  
  // 获取完整的安全模块，支持高级用法
  security,
  
  // 提供原始中间件模块供高级自定义使用
  raw: {
    responseHandler,
    errorHandler,
    requestId,
    httpLogger,
    security
  },
  
  // 辅助方法 - 将所有默认中间件组合成一个数组，方便批量应用
  getDefaultMiddlewares: (options = {}) => {
    return [
      module.exports.requestId(options.requestId),
      module.exports.responseHandler(),
      module.exports.httpLogger(options.httpLogger),
      module.exports.errorHandler()
    ];
  },
  
  // 提供原生框架特定的集成方式
  // 例如: app.use(middlewares.koa.all()) 或 app.use(middlewares.express.errorHandler())
  koa: {
    all: (options = {}) => module.exports.getDefaultMiddlewares(options),
    responseHandler: () => responseHandler(),
    errorHandler: () => errorHandler(),
    requestId: (options) => requestId(options),
    httpLogger: (options) => httpLogger(options)
  },
  
  express: {
    all: (options = {}) => module.exports.getDefaultMiddlewares(options),
    responseHandler: () => responseHandler(),
    errorHandler: () => errorHandler(),
    requestId: (options) => requestId(options),
    httpLogger: (options) => httpLogger(options)
  }
}; 