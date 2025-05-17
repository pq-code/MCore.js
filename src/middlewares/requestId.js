/**
 * 请求ID中间件
 * 为每个请求生成唯一ID，便于追踪和调试
 * 
 * @module middlewares/requestId
 */

const { v4: uuidv4 } = require('uuid');

/**
 * 创建请求ID中间件
 * 
 * @param {Object} options - 中间件选项
 * @param {string} options.header - 请求ID的HTTP头名称
 * @param {Function} options.generator - 自定义ID生成函数
 * @param {boolean} options.exposeHeader - 是否在响应头中包含请求ID
 * @returns {Function} Koa中间件
 */
function requestId(options = {}) {
  // 默认选项
  const defaultOptions = {
    header: 'X-Request-ID',
    generator: uuidv4,
    exposeHeader: true
  };
  
  // 合并选项
  const opts = Object.assign({}, defaultOptions, options);
  
  return async function requestIdMiddleware(ctx, next) {
    // 从请求头获取请求ID，如果没有则生成新的
    const id = ctx.request.get(opts.header) || opts.generator();
    
    // 将请求ID保存到上下文状态中
    ctx.state.requestId = id;
    
    // 设置响应头
    if (opts.exposeHeader) {
      ctx.set(opts.header, id);
    }
    
    // 调用下一个中间件
    await next();
  };
}

module.exports = requestId; 