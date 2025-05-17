/**
 * 弹性组件指标监控模块
 * 提供弹性组件的指标收集和导出功能
 * 
 * @module resilience/metrics
 */

let promClient;
try {
  promClient = require('prom-client');
} catch (e) {
  // prom-client 是可选依赖，如果不存在则忽略
  promClient = null;
}

// 存储所有注册的指标
const metrics = {
  registry: null,
  initialized: false,
  counters: {},
  gauges: {},
  histograms: {},
  summaries: {}
};

/**
 * 初始化指标收集
 * 
 * @param {Object} options - 初始化选项
 * @param {Object} options.registry - 自定义的Prometheus注册表
 * @param {string} options.prefix - 指标名称前缀
 * @param {boolean} options.defaultMetrics - 是否收集默认指标
 * @param {number} options.defaultMetricsInterval - 默认指标收集间隔（毫秒）
 * @returns {Object|null} 指标注册表或null（如果不支持）
 */
function init(options = {}) {
  if (!promClient) {
    console.warn('prom-client未安装，无法初始化指标收集');
    return null;
  }

  if (metrics.initialized) {
    return metrics.registry;
  }

  // 使用提供的注册表或创建新的
  metrics.registry = options.registry || new promClient.Registry();
  const prefix = options.prefix || 'resilience_';

  // 为RateLimiter创建指标
  metrics.counters.rateLimiter = {
    total: new promClient.Counter({
      name: `${prefix}rate_limiter_requests_total`,
      help: '限流器处理的请求总数',
      labelNames: ['name', 'result'],
      registers: [metrics.registry]
    })
  };

  // 为CircuitBreaker创建指标
  metrics.counters.circuitBreaker = {
    total: new promClient.Counter({
      name: `${prefix}circuit_breaker_requests_total`,
      help: '熔断器处理的请求总数',
      labelNames: ['name', 'result'],
      registers: [metrics.registry]
    }),
    stateChange: new promClient.Counter({
      name: `${prefix}circuit_breaker_state_changes_total`,
      help: '熔断器状态变更次数',
      labelNames: ['name', 'from_state', 'to_state'],
      registers: [metrics.registry]
    })
  };
  
  metrics.gauges.circuitBreaker = {
    state: new promClient.Gauge({
      name: `${prefix}circuit_breaker_state`,
      help: '熔断器当前状态 (0: closed, 1: open, 2: half-open)',
      labelNames: ['name'],
      registers: [metrics.registry]
    })
  };

  // 为BulkheadPattern创建指标
  metrics.gauges.bulkhead = {
    concurrentCalls: new promClient.Gauge({
      name: `${prefix}bulkhead_concurrent_calls`,
      help: '并发限制器当前并发请求数',
      labelNames: ['name'],
      registers: [metrics.registry]
    }),
    queueSize: new promClient.Gauge({
      name: `${prefix}bulkhead_queue_size`,
      help: '并发限制器当前队列大小',
      labelNames: ['name'],
      registers: [metrics.registry]
    })
  };
  
  metrics.counters.bulkhead = {
    executionsTotal: new promClient.Counter({
      name: `${prefix}bulkhead_executions_total`,
      help: '并发限制器处理的请求总数',
      labelNames: ['name', 'result'],
      registers: [metrics.registry]
    })
  };

  // 为Retry创建指标
  metrics.counters.retry = {
    executionsTotal: new promClient.Counter({
      name: `${prefix}retry_executions_total`,
      help: '重试策略处理的请求总数',
      labelNames: ['name', 'result'],
      registers: [metrics.registry]
    }),
    retriesTotal: new promClient.Counter({
      name: `${prefix}retry_attempts_total`,
      help: '重试策略重试次数',
      labelNames: ['name'],
      registers: [metrics.registry]
    })
  };
  
  metrics.histograms.retry = {
    attemptDuration: new promClient.Histogram({
      name: `${prefix}retry_attempt_duration_seconds`,
      help: '重试策略每次尝试的持续时间',
      labelNames: ['name', 'attempt'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [metrics.registry]
    })
  };

  // 为Timeout创建指标
  metrics.counters.timeout = {
    executionsTotal: new promClient.Counter({
      name: `${prefix}timeout_executions_total`,
      help: '超时控制处理的请求总数',
      labelNames: ['name', 'result'],
      registers: [metrics.registry]
    })
  };

  // 为Fallback创建指标
  metrics.counters.fallback = {
    executionsTotal: new promClient.Counter({
      name: `${prefix}fallback_executions_total`,
      help: '降级策略处理的请求总数',
      labelNames: ['name', 'result'],
      registers: [metrics.registry]
    })
  };

  // 收集默认指标
  if (options.defaultMetrics !== false) {
    promClient.collectDefaultMetrics({
      register: metrics.registry,
      prefix: `${prefix}`,
      interval: options.defaultMetricsInterval || 10000
    });
  }

  metrics.initialized = true;
  return metrics.registry;
}

/**
 * 获取Prometheus指标注册表
 * 
 * @returns {Object|null} 指标注册表或null（如果未初始化）
 */
function getRegistry() {
  return metrics.registry;
}

/**
 * 获取所有指标的Prometheus格式内容
 * 
 * @returns {Promise<string>} Prometheus格式的指标内容
 */
async function getMetrics() {
  if (!metrics.initialized || !metrics.registry) {
    throw new Error('指标收集未初始化');
  }
  
  return metrics.registry.metrics();
}

/**
 * 获取Prometheus内容类型
 * 
 * @returns {string} Prometheus内容类型
 */
function getContentType() {
  if (!promClient) {
    return 'text/plain';
  }
  
  return promClient.register.contentType;
}

/**
 * 创建Koa指标中间件
 * 
 * @param {Object} options - 中间件配置选项
 * @param {string} options.path - 指标暴露的路径
 * @returns {Function} Koa中间件函数
 */
function createKoaMetricsMiddleware(options = {}) {
  const path = options.path || '/metrics';
  
  return async (ctx, next) => {
    if (ctx.path === path) {
      if (!metrics.initialized) {
        ctx.status = 503;
        ctx.body = '指标收集未初始化';
        return;
      }
      
      try {
        ctx.set('Content-Type', getContentType());
        ctx.body = await getMetrics();
      } catch (error) {
        ctx.status = 500;
        ctx.body = `获取指标失败: ${error.message}`;
      }
    } else {
      await next();
    }
  };
}

/**
 * 创建Express指标中间件
 * 
 * @param {Object} options - 中间件配置选项
 * @param {string} options.path - 指标暴露的路径
 * @returns {Function} Express中间件函数
 */
function createExpressMetricsMiddleware(options = {}) {
  const path = options.path || '/metrics';
  
  return async (req, res, next) => {
    if (req.path === path) {
      if (!metrics.initialized) {
        res.status(503).send('指标收集未初始化');
        return;
      }
      
      try {
        res.set('Content-Type', getContentType());
        const metricsData = await getMetrics();
        res.send(metricsData);
      } catch (error) {
        res.status(500).send(`获取指标失败: ${error.message}`);
      }
    } else {
      next();
    }
  };
}

// 导出模块
module.exports = {
  init,
  getRegistry,
  getMetrics,
  getContentType,
  metrics,
  middleware: {
    koa: createKoaMetricsMiddleware,
    express: createExpressMetricsMiddleware
  }
}; 