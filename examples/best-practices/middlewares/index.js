/**
 * 中间件管理模块
 */

const { AppError } = require('../utils/errors');

// 请求ID中间件
const requestId = (options = {}) => {
  const headerName = options.headerName || 'X-Request-ID';
  
  return async (ctx, next) => {
    const id = ctx.request.headers[headerName.toLowerCase()] || 
               `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    ctx.state.requestId = id;
    ctx.set(headerName, id);
    await next();
  };
};

// 响应时间中间件
const responseTime = () => {
  return async (ctx, next) => {
    const start = process.hrtime();
    await next();
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    ctx.set('X-Response-Time', `${duration.toFixed(2)}ms`);
  };
};

// 错误处理中间件
const errorHandler = (options = {}) => {
  const showStack = options.showStack || process.env.NODE_ENV === 'development';
  
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      // 如果是应用错误，直接使用其状态码和消息
      if (err instanceof AppError) {
        const error = err.toJSON();
        if (!showStack) {
          delete error.stack;
        }
        ctx.status = error.status;
        ctx.body = error;
        return;
      }
      
      // 其他错误统一处理
      const error = {
        code: 'SERVER_ERROR',
        message: '服务器内部错误',
        status: 500
      };
      
      if (showStack) {
        error.stack = err.stack;
      }
      
      ctx.status = 500;
      ctx.body = error;
    }
  };
};

// 认证中间件
const auth = (options = {}) => {
  const { required = true } = options;
  
  return async (ctx, next) => {
    try {
      const token = ctx.request.headers.authorization?.split(' ')[1];
      
      if (!token) {
        if (required) {
          throw AppError.unauthorized('未提供认证令牌');
        }
        return await next();
      }
      
      ctx.state.user = await ctx.app.services.auth.verifyToken(token);
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw AppError.unauthorized('无效的认证令牌');
    }
  };
};

// 角色验证中间件
const role = (roles) => {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      throw AppError.unauthorized('未认证');
    }
    
    if (!roles.includes(ctx.state.user.role)) {
      throw AppError.forbidden('权限不足');
    }
    
    await next();
  };
};

// 请求验证中间件
const validate = (schema) => {
  return async (ctx, next) => {
    const { validateBody, validateQuery, validateParams } = require('../utils/validator');
    
    if (schema.body) {
      ctx.request.body = validateBody(ctx.request.body, schema.body);
    }
    
    if (schema.query) {
      ctx.query = validateQuery(ctx.query, schema.query);
    }
    
    if (schema.params) {
      ctx.params = validateParams(ctx.params, schema.params);
    }
    
    await next();
  };
};

// 导出中间件
module.exports = {
  requestId,
  responseTime,
  errorHandler,
  auth,
  role,
  validate
}; 