/**
 * 监控中间件
 * 提供健康检查和指标暴露的HTTP中间件
 * 
 * @module monitor/middleware
 */

const logger = require('../logging').logger;

/**
 * 创建健康检查中间件（Koa）
 * 
 * @param {Object} healthChecker - 健康检查器实例
 * @param {Object} options - 中间件选项
 * @param {string} options.path - 健康检查路径
 * @param {string} options.infoPath - 信息路径
 * @param {boolean} options.includeDetails - 是否包含详细信息
 * @returns {Function} Koa中间件
 */
function createKoaHealthMiddleware(healthChecker, options = {}) {
  const path = options.path || '/health';
  const infoPath = options.infoPath || '/info';
  const includeDetails = options.includeDetails;

  return async (ctx, next) => {
    // 健康检查路径
    if (ctx.path === path) {
      try {
        const health = await healthChecker.getHealth({ includeDetails });
        ctx.status = health.status === 'UP' ? 200 : (health.status === 'DEGRADED' ? 200 : 503);
        ctx.body = health;
      } catch (err) {
        logger.error(`健康检查处理错误: ${err.message}`, { stack: err.stack });
        ctx.status = 500;
        ctx.body = {
          status: 'DOWN',
          error: err.message
        };
      }
      return;
    }
    
    // 信息路径
    if (ctx.path === infoPath) {
      try {
        ctx.body = healthChecker.getInfo();
      } catch (err) {
        logger.error(`信息路径处理错误: ${err.message}`, { stack: err.stack });
        ctx.status = 500;
        ctx.body = {
          error: '获取系统信息失败'
        };
      }
      return;
    }
    
    // 其他路径
    await next();
  };
}

/**
 * 创建健康检查中间件（Express）
 * 
 * @param {Object} healthChecker - 健康检查器实例
 * @param {Object} options - 中间件选项
 * @param {string} options.path - 健康检查路径
 * @param {string} options.infoPath - 信息路径
 * @param {boolean} options.includeDetails - 是否包含详细信息
 * @returns {Function} Express中间件
 */
function createExpressHealthMiddleware(healthChecker, options = {}) {
  const path = options.path || '/health';
  const infoPath = options.infoPath || '/info';
  const includeDetails = options.includeDetails;
  
  return async (req, res, next) => {
    // 健康检查路径
    if (req.path === path) {
      try {
        const health = await healthChecker.getHealth({ includeDetails });
        res.status(health.status === 'UP' ? 200 : (health.status === 'DEGRADED' ? 200 : 503));
        res.json(health);
      } catch (err) {
        logger.error(`健康检查处理错误: ${err.message}`, { stack: err.stack });
        res.status(500).json({
          status: 'DOWN',
          error: err.message
        });
      }
      return;
    }
    
    // 信息路径
    if (req.path === infoPath) {
      try {
        res.json(healthChecker.getInfo());
      } catch (err) {
        logger.error(`信息路径处理错误: ${err.message}`, { stack: err.stack });
        res.status(500).json({
          error: '获取系统信息失败'
        });
      }
      return;
    }
    
    // 其他路径
    next();
  };
}

/**
 * 创建指标中间件（Koa）
 * 
 * @param {Object} metricsCollector - 指标收集器实例
 * @param {Object} options - 中间件选项
 * @param {string} options.path - 指标路径
 * @returns {Function} Koa中间件
 */
function createKoaMetricsMiddleware(metricsCollector, options = {}) {
  const path = options.path || '/metrics';
  
  return async (ctx, next) => {
    if (ctx.path === path) {
      try {
        // 获取指标
        const metrics = await metricsCollector.getMetricsAsString();
        
        // 设置响应头
        ctx.set('Content-Type', metricsCollector.getContentType());
        ctx.body = metrics;
      } catch (err) {
        logger.error(`指标路径处理错误: ${err.message}`, { stack: err.stack });
        ctx.status = 500;
        ctx.body = '获取指标失败';
      }
      return;
    }
    
    // 其他路径
    await next();
  };
}

/**
 * 创建指标中间件（Express）
 * 
 * @param {Object} metricsCollector - 指标收集器实例
 * @param {Object} options - 中间件选项
 * @param {string} options.path - 指标路径
 * @returns {Function} Express中间件
 */
function createExpressMetricsMiddleware(metricsCollector, options = {}) {
  const path = options.path || '/metrics';
  
  return async (req, res, next) => {
    if (req.path === path) {
      try {
        // 获取指标
        const metrics = await metricsCollector.getMetricsAsString();
        
        // 设置响应头
        res.set('Content-Type', metricsCollector.getContentType());
        res.send(metrics);
      } catch (err) {
        logger.error(`指标路径处理错误: ${err.message}`, { stack: err.stack });
        res.status(500).send('获取指标失败');
      }
      return;
    }
    
    // 其他路径
    next();
  };
}

/**
 * 创建HTTP请求指标中间件（Koa）
 * 
 * @param {Object} metricsCollector - 指标收集器实例
 * @param {Object} options - 中间件选项
 * @param {Object} options.ignorePaths - 忽略的路径列表
 * @returns {Function} Koa中间件
 */
function createKoaHttpMetricsMiddleware(metricsCollector, options = {}) {
  const ignorePaths = options.ignorePaths || [];
  
  return async (ctx, next) => {
    // 对于被忽略的路径，直接跳过
    if (ignorePaths.some(path => ctx.path.startsWith(path))) {
      return next();
    }
    
    // 记录请求开始时间
    const startTime = process.hrtime();
    
    try {
      // 执行下一个中间件
      await next();
      
      // 计算请求处理时间
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      
      // 记录请求信息
      recordHttpMetrics(metricsCollector, {
        method: ctx.method,
        path: ctx.path,
        status: ctx.status,
        duration,
        requestSize: ctx.request.length || 0,
        responseSize: ctx.response.length || 0
      });
    } catch (err) {
      // 计算请求处理时间
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      
      // 记录请求信息
      recordHttpMetrics(metricsCollector, {
        method: ctx.method,
        path: ctx.path,
        status: ctx.status || 500,
        duration,
        requestSize: ctx.request.length || 0,
        responseSize: 0,
        error: err
      });
      
      throw err;
    }
  };
}

/**
 * 创建HTTP请求指标中间件（Express）
 * 
 * @param {Object} metricsCollector - 指标收集器实例
 * @param {Object} options - 中间件选项
 * @param {Object} options.ignorePaths - 忽略的路径列表
 * @returns {Function} Express中间件
 */
function createExpressHttpMetricsMiddleware(metricsCollector, options = {}) {
  const ignorePaths = options.ignorePaths || [];
  
  return (req, res, next) => {
    // 对于被忽略的路径，直接跳过
    if (ignorePaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // 记录请求开始时间
    const startTime = process.hrtime();
    
    // 保存原始end方法
    const originalEnd = res.end;
    
    // 重写end方法
    res.end = function(...args) {
      // 调用原始end方法
      originalEnd.apply(res, args);
      
      // 计算请求处理时间
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      
      // 记录请求信息
      recordHttpMetrics(metricsCollector, {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        requestSize: req.headers['content-length'] || 0,
        responseSize: res.getHeader('content-length') || 0
      });
    };
    
    // 继续处理请求
    next();
  };
}

/**
 * 记录HTTP请求指标
 * 
 * @private
 * @param {Object} metricsCollector - 指标收集器实例
 * @param {Object} data - 请求数据
 */
function recordHttpMetrics(metricsCollector, data) {
  try {
    // 请求总数
    const requestsTotal = metricsCollector.getMetric('http_requests_total');
    if (requestsTotal) {
      requestsTotal.inc({
        method: data.method,
        path: normalizePath(data.path),
        status: data.status
      });
    }
    
    // 请求持续时间
    const requestDuration = metricsCollector.getMetric('http_request_duration_seconds');
    if (requestDuration) {
      requestDuration.observe(
        {
          method: data.method,
          path: normalizePath(data.path),
          status: data.status
        },
        data.duration
      );
    }
    
    // 请求大小
    const requestSize = metricsCollector.getMetric('http_request_size_bytes');
    if (requestSize && data.requestSize) {
      requestSize.observe(
        {
          method: data.method,
          path: normalizePath(data.path)
        },
        parseInt(data.requestSize, 10)
      );
    }
    
    // 响应大小
    const responseSize = metricsCollector.getMetric('http_response_size_bytes');
    if (responseSize && data.responseSize) {
      responseSize.observe(
        {
          method: data.method,
          path: normalizePath(data.path),
          status: data.status
        },
        parseInt(data.responseSize, 10)
      );
    }
    
    // 错误总数
    if (data.error) {
      const errorsTotal = metricsCollector.getMetric('errors_total');
      if (errorsTotal) {
        errorsTotal.inc({ type: 'http' });
      }
    }
  } catch (err) {
    logger.error(`记录HTTP指标失败: ${err.message}`, { stack: err.stack });
  }
}

/**
 * 标准化路径
 * 将动态路径参数替换为占位符，以减少基数爆炸
 * 
 * @private
 * @param {string} path - 原始路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(path) {
  // UUID正则表达式
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  
  // 数字ID正则表达式
  const numberIdRegex = /\/\d+(?=\/|$)/g;
  
  // 替换UUID
  let normalized = path.replace(uuidRegex, ':id');
  
  // 替换数字ID
  normalized = normalized.replace(numberIdRegex, '/:id');
  
  return normalized;
}

// 导出中间件
module.exports = {
  health: {
    koa: createKoaHealthMiddleware,
    express: createExpressHealthMiddleware
  },
  metrics: {
    koa: createKoaMetricsMiddleware,
    express: createExpressMetricsMiddleware
  },
  httpMetrics: {
    koa: createKoaHttpMetricsMiddleware,
    express: createExpressHttpMetricsMiddleware
  }
}; 