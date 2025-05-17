/**
 * 指标收集器
 * 收集系统和应用性能指标
 * 
 * @module monitor/MetricsCollector
 */

const EventEmitter = require('events');
const os = require('os');
const logger = require('../logging').logger;

/**
 * 指标收集器类
 */
class MetricsCollector extends EventEmitter {
  /**
   * 创建指标收集器实例
   * 
   * @param {Object} options - 配置选项
   * @param {boolean} options.enableDefaultMetrics - 是否启用默认指标
   * @param {number} options.interval - 指标收集间隔（毫秒）
   * @param {Array<string>} options.disabledMetrics - 禁用的指标列表
   * @param {string} options.prefix - 指标名称前缀
   */
  constructor(options = {}) {
    super();
    this.enableDefaultMetrics = options.enableDefaultMetrics !== false;
    this.interval = options.interval || 15000; // 默认15秒
    this.disabledMetrics = Array.isArray(options.disabledMetrics) ? options.disabledMetrics : [];
    this.prefix = options.prefix || '';
    this.registry = null;
    this.metrics = {};
    this.timer = null;
    this.lastCollectTime = 0;
    
    // 初始化Prometheus客户端
    this._initPromClient();
    
    // 初始化默认指标
    if (this.enableDefaultMetrics) {
      this._setupDefaultMetrics();
    }
  }
  
  /**
   * 开始收集指标
   * 
   * @returns {MetricsCollector} 当前实例，支持链式调用
   */
  start() {
    if (this.timer) {
      return this;
    }
    
    // 立即收集一次
    this._collectMetrics();
    
    // 设置定时器
    this.timer = setInterval(() => {
      this._collectMetrics();
    }, this.interval);
    
    // 确保不会阻止进程退出
    if (this.timer.unref) {
      this.timer.unref();
    }
    
    logger.info(`指标收集器已启动，间隔: ${this.interval}ms`);
    return this;
  }
  
  /**
   * 停止收集指标
   * 
   * @returns {MetricsCollector} 当前实例，支持链式调用
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('指标收集器已停止');
    }
    
    return this;
  }
  
  /**
   * 注册自定义指标
   * 
   * @param {string} name - 指标名称
   * @param {string} type - 指标类型：counter, gauge, histogram, summary
   * @param {string} help - 指标描述
   * @param {Array<string>} labelNames - 标签名称列表
   * @param {Object} options - 指标选项
   * @returns {Object} 创建的指标对象
   */
  registerMetric(name, type, help, labelNames = [], options = {}) {
    if (!this.registry) {
      throw new Error('指标收集器未初始化');
    }
    
    const fullName = this.prefix + name;
    
    // 检查指标是否已存在
    if (this.metrics[fullName]) {
      return this.metrics[fullName];
    }
    
    // 基础配置
    const config = {
      name: fullName,
      help: help || `指标 ${fullName}`,
      labelNames,
      registers: [this.registry]
    };
    
    // 合并自定义选项
    Object.assign(config, options);
    
    // 根据类型创建指标
    let metric;
    switch (type.toLowerCase()) {
      case 'counter':
        metric = new this.promClient.Counter(config);
        break;
      case 'gauge':
        metric = new this.promClient.Gauge(config);
        break;
      case 'histogram':
        metric = new this.promClient.Histogram(config);
        break;
      case 'summary':
        metric = new this.promClient.Summary(config);
        break;
      default:
        throw new Error(`不支持的指标类型: ${type}`);
    }
    
    // 保存指标
    this.metrics[fullName] = metric;
    
    return metric;
  }
  
  /**
   * 获取指标
   * 
   * @param {string} name - 指标名称
   * @returns {Object|null} 指标对象或null
   */
  getMetric(name) {
    const fullName = this.prefix + name;
    return this.metrics[fullName] || null;
  }
  
  /**
   * 获取所有指标的Prometheus格式字符串
   * 
   * @returns {Promise<string>} Prometheus格式的指标字符串
   */
  async getMetricsAsString() {
    if (!this.registry) {
      return '';
    }
    
    return this.registry.metrics();
  }
  
  /**
   * 获取指标的内容类型
   * 
   * @returns {string} 内容类型
   */
  getContentType() {
    if (!this.registry) {
      return 'text/plain';
    }
    
    return this.registry.contentType;
  }
  
  /**
   * 初始化Prometheus客户端
   * 
   * @private
   */
  _initPromClient() {
    try {
      this.promClient = require('prom-client');
      this.registry = new this.promClient.Registry();
      
      logger.info('已初始化Prometheus客户端');
    } catch (err) {
      logger.error('prom-client模块未安装，指标收集功能将不可用');
      
      // 创建空的实现
      this.promClient = {
        Counter: class MockCounter {},
        Gauge: class MockGauge {},
        Histogram: class MockHistogram {},
        Summary: class MockSummary {},
        Registry: class MockRegistry {
          metrics() { return ''; }
          get contentType() { return 'text/plain'; }
        }
      };
      
      this.registry = new this.promClient.Registry();
    }
  }
  
  /**
   * 设置默认指标
   * 
   * @private
   */
  _setupDefaultMetrics() {
    if (!this.registry || !this.promClient) {
      return;
    }
    
    // 设置默认指标收集
    this.promClient.collectDefaultMetrics({
      prefix: this.prefix,
      register: this.registry,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });
    
    // 应用指标
    this._setupAppMetrics();
    
    // 请求指标
    this._setupHttpMetrics();
    
    // 数据库指标
    this._setupDatabaseMetrics();
    
    // 错误指标
    this._setupErrorMetrics();
    
    logger.info('已启用默认指标收集');
  }
  
  /**
   * 设置应用指标
   * 
   * @private
   */
  _setupAppMetrics() {
    if (this.disabledMetrics.includes('app')) {
      return;
    }
    
    // 启动时间
    this.registerMetric('app_uptime_seconds', 'gauge', '应用运行时间（秒）');
    
    // 内存使用
    this.registerMetric('app_memory_rss_bytes', 'gauge', '应用RSS内存使用（字节）');
    this.registerMetric('app_memory_heap_total_bytes', 'gauge', '应用堆内存总量（字节）');
    this.registerMetric('app_memory_heap_used_bytes', 'gauge', '应用已用堆内存（字节）');
    this.registerMetric('app_memory_external_bytes', 'gauge', '应用外部内存使用（字节）');
    
    // 事件循环延迟
    this.registerMetric('app_event_loop_delay_seconds', 'gauge', '事件循环延迟（秒）');
    
    // 当前活跃连接数
    this.registerMetric('app_active_connections', 'gauge', '当前活跃连接数');
    
    // 当前活跃请求数
    this.registerMetric('app_active_requests', 'gauge', '当前活跃请求数');
    
    // CPU使用率
    this.registerMetric('app_cpu_usage_percent', 'gauge', '应用CPU使用率（百分比）');
    
    logger.debug('已设置应用指标');
  }
  
  /**
   * 设置HTTP请求指标
   * 
   * @private
   */
  _setupHttpMetrics() {
    if (this.disabledMetrics.includes('http')) {
      return;
    }
    
    // HTTP请求总数
    this.registerMetric('http_requests_total', 'counter', 'HTTP请求总数', ['method', 'path', 'status']);
    
    // HTTP请求持续时间
    this.registerMetric('http_request_duration_seconds', 'histogram', 'HTTP请求持续时间（秒）', 
      ['method', 'path', 'status'], {
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
      }
    );
    
    // HTTP请求大小
    this.registerMetric('http_request_size_bytes', 'histogram', 'HTTP请求大小（字节）', 
      ['method', 'path'], {
        buckets: [100, 1000, 10000, 100000, 1000000]
      }
    );
    
    // HTTP响应大小
    this.registerMetric('http_response_size_bytes', 'histogram', 'HTTP响应大小（字节）', 
      ['method', 'path', 'status'], {
        buckets: [100, 1000, 10000, 100000, 1000000]
      }
    );
    
    logger.debug('已设置HTTP指标');
  }
  
  /**
   * 设置数据库指标
   * 
   * @private
   */
  _setupDatabaseMetrics() {
    if (this.disabledMetrics.includes('database')) {
      return;
    }
    
    // 数据库操作总数
    this.registerMetric('db_operations_total', 'counter', '数据库操作总数', ['operation', 'success']);
    
    // 数据库操作持续时间
    this.registerMetric('db_operation_duration_seconds', 'histogram', '数据库操作持续时间（秒）', 
      ['operation'], {
        buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5]
      }
    );
    
    // 数据库连接池大小
    this.registerMetric('db_pool_size', 'gauge', '数据库连接池大小', ['pool']);
    
    // 数据库活跃连接数
    this.registerMetric('db_active_connections', 'gauge', '数据库活跃连接数', ['pool']);
    
    // 数据库等待连接数
    this.registerMetric('db_waiting_connections', 'gauge', '数据库等待连接数', ['pool']);
    
    logger.debug('已设置数据库指标');
  }
  
  /**
   * 设置错误指标
   * 
   * @private
   */
  _setupErrorMetrics() {
    if (this.disabledMetrics.includes('errors')) {
      return;
    }
    
    // 错误总数
    this.registerMetric('errors_total', 'counter', '错误总数', ['type']);
    
    // 未捕获的异常总数
    this.registerMetric('uncaught_exceptions_total', 'counter', '未捕获的异常总数');
    
    // 未处理的Promise拒绝总数
    this.registerMetric('unhandled_rejections_total', 'counter', '未处理的Promise拒绝总数');
    
    // 监听未捕获的异常
    process.on('uncaughtException', (err) => {
      logger.error(`未捕获的异常: ${err.message}`, { stack: err.stack });
      
      const errorsMetric = this.getMetric('errors_total');
      const uncaughtMetric = this.getMetric('uncaught_exceptions_total');
      
      if (errorsMetric) {
        errorsMetric.inc({ type: 'uncaught_exception' });
      }
      
      if (uncaughtMetric) {
        uncaughtMetric.inc();
      }
    });
    
    // 监听未处理的Promise拒绝
    process.on('unhandledRejection', (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      
      logger.error(`未处理的Promise拒绝: ${message}`, { stack });
      
      const errorsMetric = this.getMetric('errors_total');
      const rejectionMetric = this.getMetric('unhandled_rejections_total');
      
      if (errorsMetric) {
        errorsMetric.inc({ type: 'unhandled_rejection' });
      }
      
      if (rejectionMetric) {
        rejectionMetric.inc();
      }
    });
    
    logger.debug('已设置错误指标');
  }
  
  /**
   * 收集指标
   * 
   * @private
   */
  _collectMetrics() {
    const now = Date.now();
    this.lastCollectTime = now;
    
    try {
      // 收集应用指标
      this._collectAppMetrics();
      
      // 触发指标收集事件
      this.emit('collect', this.metrics);
    } catch (err) {
      logger.error(`指标收集失败: ${err.message}`, { stack: err.stack });
    }
  }
  
  /**
   * 收集应用指标
   * 
   * @private
   */
  _collectAppMetrics() {
    if (this.disabledMetrics.includes('app')) {
      return;
    }
    
    // 应用运行时间
    const uptimeMetric = this.getMetric('app_uptime_seconds');
    if (uptimeMetric) {
      uptimeMetric.set(process.uptime());
    }
    
    // 内存使用
    const memoryUsage = process.memoryUsage();
    
    const rssMetric = this.getMetric('app_memory_rss_bytes');
    if (rssMetric) {
      rssMetric.set(memoryUsage.rss);
    }
    
    const heapTotalMetric = this.getMetric('app_memory_heap_total_bytes');
    if (heapTotalMetric) {
      heapTotalMetric.set(memoryUsage.heapTotal);
    }
    
    const heapUsedMetric = this.getMetric('app_memory_heap_used_bytes');
    if (heapUsedMetric) {
      heapUsedMetric.set(memoryUsage.heapUsed);
    }
    
    const externalMetric = this.getMetric('app_memory_external_bytes');
    if (externalMetric) {
      externalMetric.set(memoryUsage.external || 0);
    }
    
    // CPU使用率
    this._collectCpuUsage();
  }
  
  /**
   * 收集CPU使用率指标
   * 
   * @private
   */
  _collectCpuUsage() {
    const cpuMetric = this.getMetric('app_cpu_usage_percent');
    if (!cpuMetric) {
      return;
    }
    
    try {
      // 获取CPU使用情况
      const cpus = os.cpus();
      if (!cpus || !cpus.length) {
        return;
      }
      
      // 计算CPU使用率
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      // 设置CPU使用率
      const usagePercent = ((totalTick - totalIdle) / totalTick) * 100;
      cpuMetric.set(usagePercent);
    } catch (err) {
      logger.error(`收集CPU使用率指标失败: ${err.message}`);
    }
  }
}

module.exports = MetricsCollector; 