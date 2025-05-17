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

module.exports = {
  responseHandler,
  errorHandler,
  requestId,
  httpLogger
}; 