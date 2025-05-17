/**
 * 中间件模块
 * 导出所有中间件
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
  // 内部中间件
  responseHandler: () => responseHandler(),
  errorHandler: () => errorHandler(),
  requestId: (options) => requestId(options),
  httpLogger: (options) => httpLogger(options),
  
  // 安全中间件
  cors: (options) => security.cors.createCorsMiddleware(options),
  rateLimit: (options) => security.rateLimit.createRateLimitMiddleware(options),
  helmet: (options) => security.helmet.createHelmetMiddleware(options),
  
  // 提供原始中间件模块供高级自定义使用
  raw: {
    responseHandler,
    errorHandler,
    requestId,
    httpLogger
  }
}; 