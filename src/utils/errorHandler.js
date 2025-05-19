/**
 * 错误处理工具类
 * 提供统一的错误分类和处理逻辑
 */

// 错误类型定义
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  INTERNAL: 'INTERNAL_ERROR'
};

// HTTP状态码映射
const StatusCodeMap = {
  [ErrorTypes.VALIDATION]: 400,
  [ErrorTypes.AUTHENTICATION]: 401,
  [ErrorTypes.AUTHORIZATION]: 403,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.CONFLICT]: 409,
  [ErrorTypes.INTERNAL]: 500
};

/**
 * 创建错误响应对象
 * @param {Error} err - 错误对象
 * @param {Object} ctx - Koa上下文
 * @param {Object} options - 配置选项
 * @returns {Object} 错误响应对象
 */
function createErrorResponse(err, ctx, options = {}) {
  const {
    showStack = process.env.NODE_ENV === 'development',
    includeRequestInfo = true
  } = options;

  // 获取错误类型和状态码
  const errorType = err.type || ErrorTypes.INTERNAL;
  const statusCode = err.status || StatusCodeMap[errorType] || 500;

  // 构建基础错误响应
  const errorResponse = {
    error: true,
    message: err.message || '服务器内部错误',
    code: err.code || errorType,
    timestamp: new Date().toISOString()
  };

  // 添加请求信息
  if (includeRequestInfo) {
    errorResponse.request = {
      path: ctx.path,
      method: ctx.method,
      query: ctx.query,
      headers: ctx.headers
    };
  }

  // 开发环境下添加堆栈信息
  if (showStack && err.stack) {
    errorResponse.stack = err.stack;
  }

  // 添加额外错误信息
  if (err.details) {
    errorResponse.details = err.details;
  }

  return {
    status: statusCode,
    body: errorResponse
  };
}

/**
 * 创建错误处理中间件
 * @param {Object} options - 配置选项
 * @returns {Function} Koa中间件
 */
function createErrorHandler(options = {}) {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      const { status, body } = createErrorResponse(err, ctx, options);
      
      ctx.status = status;
      ctx.body = body;
      
      // 触发错误事件
      ctx.app.emit('error', err, ctx);
    }
  };
}

module.exports = {
  ErrorTypes,
  StatusCodeMap,
  createErrorResponse,
  createErrorHandler
}; 