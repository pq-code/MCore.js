/**
 * 弹性中间件模块
 * 提供与Koa和Express框架的集成中间件
 * 
 * @module resilience/middleware
 */

const RateLimiter = require('./RateLimiter');
const CircuitBreaker = require('./CircuitBreaker');
const BulkheadPattern = require('./BulkheadPattern');
const Timeout = require('./Timeout');

/**
 * Koa框架的限流中间件
 * 
 * @param {RateLimiter|Object} options - 限流器实例或配置选项
 * @returns {Function} Koa中间件函数
 */
function koaRateLimiter(options = {}) {
  const rateLimiter = options instanceof RateLimiter
    ? options
    : new RateLimiter(options);

  return async (ctx, next) => {
    try {
      // 获取请求标识，默认使用IP地址
      const key = options.keyGenerator
        ? options.keyGenerator(ctx)
        : ctx.ip;

      // 检查是否被限流
      await rateLimiter.acquire(key);

      // 继续处理请求
      await next();
    } catch (error) {
      if (error.name === 'RateLimitExceededError') {
        ctx.status = 429;
        ctx.body = {
          error: '请求过于频繁，请稍后再试',
          retryAfter: error.retryAfter
        };
        if (error.retryAfter) {
          ctx.set('Retry-After', String(Math.ceil(error.retryAfter / 1000)));
        }
      } else {
        throw error;
      }
    }
  };
}

/**
 * Express框架的限流中间件
 * 
 * @param {RateLimiter|Object} options - 限流器实例或配置选项
 * @returns {Function} Express中间件函数
 */
function expressRateLimiter(options = {}) {
  const rateLimiter = options instanceof RateLimiter
    ? options
    : new RateLimiter(options);

  return async (req, res, next) => {
    try {
      // 获取请求标识，默认使用IP地址
      const key = options.keyGenerator
        ? options.keyGenerator(req)
        : req.ip;

      // 检查是否被限流
      await rateLimiter.acquire(key);

      // 继续处理请求
      next();
    } catch (error) {
      if (error.name === 'RateLimitExceededError') {
        res.status(429).json({
          error: '请求过于频繁，请稍后再试',
          retryAfter: error.retryAfter
        });
        if (error.retryAfter) {
          res.set('Retry-After', String(Math.ceil(error.retryAfter / 1000)));
        }
      } else {
        next(error);
      }
    }
  };
}

/**
 * Koa框架的熔断中间件
 * 
 * @param {CircuitBreaker|Object} options - 熔断器实例或配置选项
 * @returns {Function} Koa中间件函数
 */
function koaCircuitBreaker(options = {}) {
  let circuitBreaker;
  
  if (options instanceof CircuitBreaker) {
    circuitBreaker = options;
  } else {
    // 创建一个异步函数作为默认的服务函数
    const defaultServiceFn = async () => {};
    circuitBreaker = new CircuitBreaker(defaultServiceFn, options);
  }

  return async (ctx, next) => {
    try {
      await circuitBreaker.fire(async () => {
        await next();
      });
    } catch (error) {
      if (error.name === 'CircuitBreakerOpenError') {
        ctx.status = 503;
        ctx.body = {
          error: '服务暂时不可用，请稍后再试',
          retryAfter: error.retryAfter
        };
        if (error.retryAfter) {
          ctx.set('Retry-After', String(Math.ceil(error.retryAfter / 1000)));
        }
      } else {
        throw error;
      }
    }
  };
}

/**
 * Express框架的熔断中间件
 * 
 * @param {CircuitBreaker|Object} options - 熔断器实例或配置选项
 * @returns {Function} Express中间件函数
 */
function expressCircuitBreaker(options = {}) {
  let circuitBreaker;
  
  if (options instanceof CircuitBreaker) {
    circuitBreaker = options;
  } else {
    // 创建一个异步函数作为默认的服务函数
    const defaultServiceFn = async () => {};
    circuitBreaker = new CircuitBreaker(defaultServiceFn, options);
  }

  return async (req, res, next) => {
    try {
      await circuitBreaker.fire(async () => {
        await new Promise((resolve, reject) => {
          // 保存原始的end方法
          const originalEnd = res.end;
          
          // 重写end方法以在请求完成时解析Promise
          res.end = function (...args) {
            originalEnd.apply(res, args);
            resolve();
          };
          
          // 继续处理请求
          next();
        });
      });
    } catch (error) {
      if (error.name === 'CircuitBreakerOpenError') {
        res.status(503).json({
          error: '服务暂时不可用，请稍后再试',
          retryAfter: error.retryAfter
        });
        if (error.retryAfter) {
          res.set('Retry-After', String(Math.ceil(error.retryAfter / 1000)));
        }
      } else {
        next(error);
      }
    }
  };
}

/**
 * Koa框架的并发限制中间件
 * 
 * @param {BulkheadPattern|Object} options - 并发限制实例或配置选项
 * @returns {Function} Koa中间件函数
 */
function koaBulkhead(options = {}) {
  const bulkhead = options instanceof BulkheadPattern
    ? options
    : new BulkheadPattern(options);

  return async (ctx, next) => {
    try {
      await bulkhead.execute(next);
    } catch (error) {
      if (error.name === 'BulkheadRejectedError') {
        ctx.status = 503;
        ctx.body = {
          error: '服务繁忙，请稍后再试'
        };
      } else {
        throw error;
      }
    }
  };
}

/**
 * Express框架的并发限制中间件
 * 
 * @param {BulkheadPattern|Object} options - 并发限制实例或配置选项
 * @returns {Function} Express中间件函数
 */
function expressBulkhead(options = {}) {
  const bulkhead = options instanceof BulkheadPattern
    ? options
    : new BulkheadPattern(options);

  return async (req, res, next) => {
    try {
      await bulkhead.execute(async () => {
        await new Promise((resolve, reject) => {
          // 保存原始的end方法
          const originalEnd = res.end;
          
          // 重写end方法以在请求完成时解析Promise
          res.end = function (...args) {
            originalEnd.apply(res, args);
            resolve();
          };
          
          // 继续处理请求
          next();
        });
      });
    } catch (error) {
      if (error.name === 'BulkheadRejectedError') {
        res.status(503).json({
          error: '服务繁忙，请稍后再试'
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Koa框架的超时中间件
 * 
 * @param {Timeout|Object} options - 超时控制实例或配置选项
 * @returns {Function} Koa中间件函数
 */
function koaTimeout(options = {}) {
  const timeout = options instanceof Timeout
    ? options
    : new Timeout(options);

  return async (ctx, next) => {
    try {
      await timeout.execute(next);
    } catch (error) {
      if (error.name === 'TimeoutError') {
        ctx.status = 504;
        ctx.body = {
          error: '请求处理超时，请稍后再试'
        };
      } else {
        throw error;
      }
    }
  };
}

/**
 * Express框架的超时中间件
 * 
 * @param {Timeout|Object} options - 超时控制实例或配置选项
 * @returns {Function} Express中间件函数
 */
function expressTimeout(options = {}) {
  const timeout = options instanceof Timeout
    ? options
    : new Timeout(options);

  return async (req, res, next) => {
    try {
      await timeout.execute(async () => {
        await new Promise((resolve, reject) => {
          // 保存原始的end方法
          const originalEnd = res.end;
          
          // 重写end方法以在请求完成时解析Promise
          res.end = function (...args) {
            originalEnd.apply(res, args);
            resolve();
          };
          
          // 处理错误情况
          next(err => {
            if (err) {
              reject(err);
            }
          });
        });
      });
    } catch (error) {
      if (error.name === 'TimeoutError') {
        res.status(504).json({
          error: '请求处理超时，请稍后再试'
        });
      } else {
        next(error);
      }
    }
  };
}

// 导出中间件
module.exports = {
  koa: {
    rateLimiter: koaRateLimiter,
    circuitBreaker: koaCircuitBreaker,
    bulkhead: koaBulkhead,
    timeout: koaTimeout
  },
  express: {
    rateLimiter: expressRateLimiter,
    circuitBreaker: expressCircuitBreaker,
    bulkhead: expressBulkhead,
    timeout: expressTimeout
  }
}; 