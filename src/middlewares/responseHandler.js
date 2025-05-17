/**
 * 响应处理中间件
 * 统一处理API响应格式
 * 
 * @module middlewares/responseHandler
 */

const { RESPONSE_CODES } = require('../constants');

/**
 * 创建响应处理中间件
 * 
 * @param {Object} options - 中间件选项
 * @param {Object} options.format - 响应格式配置
 * @param {number} options.successCode - 成功响应代码
 * @returns {Function} Koa中间件
 */
function responseHandler(options = {}) {
  // 默认选项
  const defaultOptions = {
    format: {
      code: 'code',
      message: 'message',
      data: 'data'
    },
    successCode: RESPONSE_CODES.SUCCESS
  };
  
  // 合并选项
  const opts = Object.assign({}, defaultOptions, options);
  
  return async function responseMiddleware(ctx, next) {
    // 增加成功响应函数
    ctx.success = (data = null, message = '操作成功') => {
      const response = {
        [opts.format.code]: opts.successCode,
        [opts.format.message]: message,
        [opts.format.data]: data
      };
      ctx.body = response;
    };
    
    // 增加失败响应函数
    ctx.fail = (code = RESPONSE_CODES.SERVER_ERROR, message = '操作失败', data = null) => {
      const response = {
        [opts.format.code]: code,
        [opts.format.message]: message,
        [opts.format.data]: data
      };
      ctx.body = response;
    };
    
    // 增加自定义状态响应函数
    ctx.response.sendStatus = (statusCode) => {
      ctx.status = statusCode;
      ctx.body = {
        [opts.format.code]: statusCode,
        [opts.format.message]: ctx.message || '未知状态',
        [opts.format.data]: null
      };
    };
    
    // 常用状态码快捷函数
    ctx.notFound = (message = '资源不存在', data = null) => {
      ctx.status = 404;
      ctx.fail(RESPONSE_CODES.NOT_FOUND, message, data);
    };
    
    ctx.badRequest = (message = '请求参数错误', data = null) => {
      ctx.status = 400;
      ctx.fail(RESPONSE_CODES.VALIDATION_ERROR, message, data);
    };
    
    ctx.unauthorized = (message = '未授权访问', data = null) => {
      ctx.status = 401;
      ctx.fail(RESPONSE_CODES.UNAUTHORIZED, message, data);
    };
    
    ctx.forbidden = (message = '禁止访问', data = null) => {
      ctx.status = 403;
      ctx.fail(RESPONSE_CODES.FORBIDDEN, message, data);
    };
    
    ctx.serverError = (message = '服务器内部错误', data = null) => {
      ctx.status = 500;
      ctx.fail(RESPONSE_CODES.SERVER_ERROR, message, data);
    };
    
    try {
      // 调用下一个中间件
      await next();
      
      // 如果是404状态且没有主动设置响应体，则返回标准格式
      if (ctx.status === 404 && !ctx.body) {
        ctx.notFound(`接口不存在: ${ctx.path}`);
      }
    } catch (err) {
      // 记录错误
      ctx.app.emit('error', err, ctx);
      
      // 设置状态码
      ctx.status = err.status || 500;
      
      // 构造错误响应
      const code = err.code || (ctx.status === 500 ? RESPONSE_CODES.SERVER_ERROR : ctx.status);
      const message = err.message || '服务器内部错误';
      const data = process.env.NODE_ENV === 'production' ? null : {
        stack: err.stack,
        details: err.details || null
      };
      
      ctx.fail(code, message, data);
    }
  };
}

module.exports = responseHandler; 