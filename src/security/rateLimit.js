/**
 * 速率限制模块
 * 提供请求速率限制功能，防止滥用和DDoS攻击
 */

/**
 * 创建速率限制中间件
 * 
 * @param {Object} options - 速率限制配置选项
 * @param {number} options.max - 时间窗口内最大请求数
 * @param {number} options.windowMs - 时间窗口大小（毫秒）
 * @param {function} options.keyGenerator - 生成标识客户端的键
 * @param {function} options.handler - 处理超出限制的请求
 * @param {boolean} options.skipSuccessfulRequests - 是否跳过成功的请求
 * @returns {Function} Koa中间件函数
 */
function createRateLimitMiddleware(options = {}) {
  const defaultOptions = {
    max: 100, // 默认每个窗口最多100个请求
    windowMs: 60 * 1000, // 默认窗口为1分钟
    keyGenerator: ctx => ctx.ip, // 默认使用IP作为键
    handler: ctx => {
      ctx.status = 429;
      ctx.body = {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: '请求太频繁，请稍后再试'
      };
    },
    skipSuccessfulRequests: false
  };

  const limitOptions = { ...defaultOptions, ...options };
  
  // 存储请求计数器
  const store = new Map();
  
  // 清理过期的计数器
  setInterval(() => {
    const now = Date.now();
    // 使用Array.from()转换Map.entries()为数组，提高兼容性
    const entries = Array.from(store);
    for (const [key, data] of entries) {
      if (now - data.startTime > limitOptions.windowMs) {
        store.delete(key);
      }
    }
  }, 5000); // 每5秒清理一次
  
  return async (ctx, next) => {
    const key = limitOptions.keyGenerator(ctx);
    
    let counter = store.get(key);
    const now = Date.now();
    
    if (!counter || now - counter.startTime > limitOptions.windowMs) {
      counter = {
        count: 0,
        startTime: now
      };
      store.set(key, counter);
    }
    
    // 检查是否超出限制
    if (counter.count >= limitOptions.max) {
      return limitOptions.handler(ctx);
    }
    
    // 增加计数
    counter.count++;
    
    // 添加速率限制相关的响应头
    ctx.set('X-RateLimit-Limit', String(limitOptions.max));
    ctx.set('X-RateLimit-Remaining', String(limitOptions.max - counter.count));
    ctx.set('X-RateLimit-Reset', String(Math.ceil((counter.startTime + limitOptions.windowMs) / 1000)));
    
    // 继续处理请求
    await next();
    
    // 若配置跳过成功请求且请求成功，则减少计数
    if (limitOptions.skipSuccessfulRequests && ctx.status < 400) {
      counter.count--;
    }
  };
}

/**
 * 验证速率限制配置
 * 
 * @param {Object} options - 速率限制配置
 * @returns {Object} 验证后的配置
 */
function validateRateLimitOptions(options) {
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
  createRateLimitMiddleware,
  validateRateLimitOptions
}; 