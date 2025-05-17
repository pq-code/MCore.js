/**
 * 错误处理中间件
 * 统一处理应用中的错误
 * 
 * @module middlewares/errorHandler
 */

const { RESPONSE_CODES } = require('../constants');

/**
 * 创建错误处理中间件
 * 
 * @param {Object} options - 中间件选项
 * @param {boolean} options.logErrors - 是否记录错误日志
 * @param {Function} options.formatError - 自定义错误格式化函数
 * @returns {Function} Koa中间件
 */
function errorHandler(options = {}) {
  // 默认选项
  const defaultOptions = {
    logErrors: true,
    formatError: (err, ctx) => ({
      code: err.code || (ctx.status === 500 ? RESPONSE_CODES.SERVER_ERROR : ctx.status),
      message: err.message || '服务器内部错误',
      details: process.env.NODE_ENV === 'production' ? undefined : {
        stack: err.stack,
        details: err.details || null
      }
    })
  };
  
  // 合并选项
  const opts = Object.assign({}, defaultOptions, options);
  
  return async function errorMiddleware(ctx, next) {
    try {
      await next();
    } catch (err) {
      // 记录错误
      if (opts.logErrors) {
        ctx.app.emit('error', err, ctx);
      }
      
      // 设置状态码
      ctx.status = err.status || 500;
      
      // 使用自定义格式化函数处理错误
      const formattedError = opts.formatError(err, ctx);
      
      // 设置响应体
      ctx.body = formattedError;
      
      // 如果响应已发送，则无法修改
      if (ctx.res.headersSent) {
        return;
      }
      
      // 设置内容类型
      ctx.set('Content-Type', 'application/json');
    }
  };
}

module.exports = errorHandler; 