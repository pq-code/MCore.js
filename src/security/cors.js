/**
 * 跨域资源共享(CORS)模块
 * 提供CORS中间件和配置功能
 */

/**
 * 创建CORS中间件
 * @param {Object} options - CORS配置选项
 * @returns {Function} Koa中间件函数
 */
function createCorsMiddleware(options = {}) {
  const defaultOptions = {
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposeHeaders: [],
    maxAge: 86400, // 24小时
    credentials: false
  };

  const corsOptions = { ...defaultOptions, ...options };

  return async (ctx, next) => {
    let origin;
    
    // 设置允许的源
    if (typeof corsOptions.origin === 'function') {
      origin = corsOptions.origin(ctx);
    } else if (corsOptions.origin === '*') {
      origin = ctx.get('Origin') || '*';
    } else {
      origin = corsOptions.origin;
    }
    
    // 设置CORS响应头
    if (origin) {
      ctx.set('Access-Control-Allow-Origin', origin);
    }
    
    // 处理预检请求
    if (ctx.method === 'OPTIONS') {
      // 设置允许的HTTP方法
      if (corsOptions.allowMethods && corsOptions.allowMethods.length > 0) {
        ctx.set('Access-Control-Allow-Methods', corsOptions.allowMethods.join(', '));
      }
      
      // 设置允许的头部
      if (corsOptions.allowHeaders && corsOptions.allowHeaders.length > 0) {
        ctx.set('Access-Control-Allow-Headers', corsOptions.allowHeaders.join(', '));
      }
      
      // 设置预检请求缓存时间
      if (corsOptions.maxAge) {
        ctx.set('Access-Control-Max-Age', String(corsOptions.maxAge));
      }
      
      // 设置是否允许发送凭证
      if (corsOptions.credentials) {
        ctx.set('Access-Control-Allow-Credentials', 'true');
      }
      
      // 对于预检请求，直接返回200
      ctx.status = 204;
      return;
    }
    
    // 设置暴露的头部
    if (corsOptions.exposeHeaders && corsOptions.exposeHeaders.length > 0) {
      ctx.set('Access-Control-Expose-Headers', corsOptions.exposeHeaders.join(', '));
    }
    
    // 设置是否允许发送凭证（非预检请求也需要）
    if (corsOptions.credentials) {
      ctx.set('Access-Control-Allow-Credentials', 'true');
    }
    
    await next();
  };
}

/**
 * CORS配置验证
 * @param {Object} options - CORS配置选项
 * @returns {Object} 验证后的CORS配置
 */
function validateCorsOptions(options) {
  if (!options) {
    return {
      enabled: false
    };
  }
  
  if (typeof options === 'boolean') {
    return {
      enabled: options
    };
  }
  
  return {
    enabled: options.enabled !== false,
    ...options
  };
}

module.exports = {
  createCorsMiddleware,
  validateCorsOptions
}; 