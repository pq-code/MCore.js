/**
 * HTTP日志中间件
 * 记录HTTP请求和响应的日志
 * 
 * @module middlewares/httpLogger
 */

/**
 * 创建HTTP日志中间件
 * 
 * @param {Object} options - 中间件选项
 * @param {Object} options.logger - 日志记录器
 * @param {Array} options.excludePaths - 排除的路径
 * @param {boolean} options.logRequestBody - 是否记录请求体
 * @param {boolean} options.logResponseBody - 是否记录响应体
 * @returns {Function} Koa中间件
 */
function httpLogger(options = {}) {
  // 默认选项
  const defaultOptions = {
    logger: console,
    excludePaths: ['/health', '/metrics'],
    logRequestBody: false,
    logResponseBody: false,
    logResponseTime: true
  };
  
  // 合并选项
  const opts = Object.assign({}, defaultOptions, options);
  
  // 日志记录器
  const logger = opts.logger || console;
  
  return async function httpLoggerMiddleware(ctx, next) {
    // 检查是否需要跳过日志记录
    if (shouldSkip(ctx, opts.excludePaths)) {
      return await next();
    }
    
    // 记录请求开始时间
    const start = Date.now();
    
    // 提取请求信息
    const reqInfo = {
      method: ctx.method,
      url: ctx.url,
      query: ctx.query,
      ip: ctx.ip,
      headers: filterHeaders(ctx.headers),
      userAgent: ctx.headers['user-agent'],
      requestId: ctx.state.requestId || 'unknown'
    };
    
    // 如果需要记录请求体
    if (opts.logRequestBody && ['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
      reqInfo.body = sanitizeBody(ctx.request.body);
    }
    
    // 记录请求日志
    logger.info(`HTTP ${ctx.method} ${ctx.url}`, {
      request: reqInfo,
      type: 'http-request'
    });
    
    let error = null;
    
    try {
      // 调用下一个中间件
      await next();
    } catch (err) {
      error = err;
      throw err;
    } finally {
      // 计算响应时间
      const ms = Date.now() - start;
      
      // 提取响应信息
      const resInfo = {
        status: ctx.status,
        message: ctx.message,
        length: ctx.response.length,
        type: ctx.type,
        headers: filterHeaders(ctx.response.headers),
        time: ms
      };
      
      // 如果需要记录响应体并且不是二进制
      if (opts.logResponseBody && 
          ctx.body && 
          typeof ctx.body === 'object' && 
          !Buffer.isBuffer(ctx.body)) {
        resInfo.body = sanitizeBody(ctx.body);
      }
      
      // 处理错误情况
      if (error) {
        logger.error(`HTTP ${ctx.method} ${ctx.url} 错误响应 ${ctx.status} (${ms}ms)`, {
          request: reqInfo,
          response: resInfo,
          error: {
            message: error.message,
            stack: error.stack,
            status: error.status,
            code: error.code
          },
          type: 'http-error'
        });
      } else if (ctx.status >= 400) {
        // 记录失败响应
        logger.warn(`HTTP ${ctx.method} ${ctx.url} 失败响应 ${ctx.status} (${ms}ms)`, {
          request: reqInfo,
          response: resInfo,
          type: 'http-failure'
        });
      } else {
        // 记录成功响应
        logger.info(`HTTP ${ctx.method} ${ctx.url} 成功响应 ${ctx.status} (${ms}ms)`, {
          request: reqInfo,
          response: resInfo,
          type: 'http-success'
        });
      }
    }
  };
}

/**
 * 检查是否应该跳过日志记录
 * 
 * @param {Object} ctx - Koa上下文
 * @param {Array} excludePaths - 排除的路径
 * @returns {boolean} 是否跳过
 */
function shouldSkip(ctx, excludePaths) {
  return excludePaths.some(path => {
    if (typeof path === 'string') {
      return ctx.path.startsWith(path);
    } else if (path instanceof RegExp) {
      return path.test(ctx.path);
    }
    return false;
  });
}

/**
 * 过滤敏感的HTTP头
 * 
 * @param {Object} headers - HTTP头
 * @returns {Object} 过滤后的HTTP头
 */
function filterHeaders(headers) {
  const filtered = { ...headers };
  
  // 删除敏感头部
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-forwarded-for',
    'x-real-ip'
  ];
  
  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[FILTERED]';
    }
  });
  
  return filtered;
}

/**
 * 清理请求/响应体中的敏感信息
 * 
 * @param {Object} body - 请求体或响应体
 * @returns {Object} 清理后的内容
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  // 创建副本避免修改原始对象
  const sanitized = JSON.parse(JSON.stringify(body));
  
  // 敏感字段列表
  const sensitiveFields = [
    'password',
    'passwordConfirmation',
    'oldPassword',
    'newPassword',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'credit_card',
    'cardNumber',
    'cvv',
    'ssn'
  ];
  
  // 递归清理
  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    for (const key in obj) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '[FILTERED]';
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
  }
  
  sanitizeObject(sanitized);
  return sanitized;
}

module.exports = httpLogger; 