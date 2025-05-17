/**
 * 熔断器类
 * 提供服务调用的熔断保护功能
 * 
 * @module resilience/CircuitBreaker
 */

const CircuitBreakerLib = require('opossum');
const { EventEmitter } = require('events');
const logger = require('../logging').logger;

/**
 * 熔断器状态
 */
const CIRCUIT_STATE = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half-open'
};

/**
 * 熔断器类
 */
class CircuitBreaker extends EventEmitter {
  /**
   * 创建熔断器实例
   * 
   * @param {Function|string} serviceFunction - 被保护的服务函数或名称
   * @param {Object} options - 熔断器配置
   * @param {number} options.failureThreshold - 触发熔断的错误率阈值（百分比，0-100）
   * @param {number} options.resetTimeout - 从开路到半开路的恢复时间（毫秒）
   * @param {number} options.rollingCountTimeout - 滚动窗口大小（毫秒）
   * @param {number} options.rollingCountBuckets - 滚动窗口内的桶数
   * @param {number} options.capacity - 最大并发请求数
   * @param {number} options.errorThresholdPercentage - 触发熔断的错误率阈值（百分比，0-100）
   * @param {Function} options.fallback - 熔断时的回退函数
   * @param {Function} options.isErrorHandler - 自定义错误判断函数
   */
  constructor(serviceFunction, options = {}) {
    super();
    
    this.serviceName = typeof serviceFunction === 'string' 
      ? serviceFunction 
      : (serviceFunction.name || 'anonymous');
    
    this.serviceFunction = typeof serviceFunction === 'function'
      ? serviceFunction
      : async (...args) => {
          throw new Error(`服务函数未定义: ${this.serviceName}`);
        };
    
    // 默认配置
    this.options = {
      failureThreshold: options.failureThreshold || parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 10) || 50,
      resetTimeout: options.resetTimeout || parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 10000,
      rollingCountTimeout: options.rollingCountTimeout || parseInt(process.env.CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT, 10) || 10000,
      rollingCountBuckets: options.rollingCountBuckets || parseInt(process.env.CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS, 10) || 10,
      capacity: options.capacity || parseInt(process.env.CIRCUIT_BREAKER_CAPACITY, 10) || 10,
      errorThresholdPercentage: options.errorThresholdPercentage || options.failureThreshold || parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD, 10) || 50,
      timeout: options.timeout || parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 10) || 3000,
      name: options.name || this.serviceName,
      fallback: options.fallback,
      isErrorHandler: options.isErrorHandler
    };
    
    // 创建熔断器实例
    this.circuit = this._createCircuit();
    
    // 绑定事件处理
    this._bindEvents();
    
    logger.info(`已创建熔断器: ${this.options.name}, 失败阈值=${this.options.errorThresholdPercentage}%, 恢复超时=${this.options.resetTimeout}ms`);
  }
  
  /**
   * 执行受保护的服务调用
   * 
   * @async
   * @param {...any} args - 传递给服务函数的参数
   * @returns {Promise<any>} 服务函数的返回值
   * @throws {Error} 如果服务调用失败并且没有回退函数，或者熔断器处于开路状态
   */
  async exec(...args) {
    try {
      return await this.circuit.fire(...args);
    } catch (err) {
      logger.error(`熔断器执行失败: ${this.options.name}, ${err.message}`, {
        stack: err.stack,
        circuit: this.options.name,
        state: this.getState()
      });
      
      if (err.type === 'open') {
        // 熔断器开路错误
        const error = new Error(`服务暂时不可用: ${this.options.name}`);
        error.statusCode = 503; // Service Unavailable
        error.circuitState = CIRCUIT_STATE.OPEN;
        error.originalError = err;
        throw error;
      } else if (err.type === 'timeout') {
        // 超时错误
        const error = new Error(`服务调用超时: ${this.options.name}`);
        error.statusCode = 504; // Gateway Timeout
        error.circuitState = this.getState();
        error.originalError = err;
        throw error;
      }
      
      // 其他类型的错误，直接抛出
      throw err;
    }
  }
  
  /**
   * 获取熔断器当前状态
   * 
   * @returns {string} 熔断器状态：closed, open, half-open
   */
  getState() {
    return this.circuit.status.state;
  }
  
  /**
   * 获取熔断器统计信息
   * 
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = this.circuit.stats;
    return {
      state: this.getState(),
      successes: stats.successes,
      failures: stats.failures,
      fallbacks: stats.fallbacks,
      rejects: stats.rejects,
      fires: stats.fires,
      timeouts: stats.timeouts,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      semaphoreRejections: stats.semaphoreRejections,
      percentiles: stats.percentiles,
      latencyMean: stats.latencyMean,
      latencyTotalMean: stats.latencyTotalMean
    };
  }
  
  /**
   * 强制打开熔断器
   * 
   * @returns {CircuitBreaker} 熔断器实例，支持链式调用
   */
  forceOpen() {
    this.circuit.open();
    return this;
  }
  
  /**
   * 强制关闭熔断器
   * 
   * @returns {CircuitBreaker} 熔断器实例，支持链式调用
   */
  forceClose() {
    this.circuit.close();
    return this;
  }
  
  /**
   * 重置熔断器状态
   * 
   * @returns {CircuitBreaker} 熔断器实例，支持链式调用
   */
  reset() {
    this.circuit.reset();
    return this;
  }
  
  /**
   * 创建底层熔断器实例
   * 
   * @private
   * @returns {Object} 熔断器库实例
   */
  _createCircuit() {
    return new CircuitBreakerLib(this.serviceFunction, {
      failureThreshold: this.options.errorThresholdPercentage,
      resetTimeout: this.options.resetTimeout,
      timeout: this.options.timeout,
      rollingCountTimeout: this.options.rollingCountTimeout,
      rollingCountBuckets: this.options.rollingCountBuckets,
      capacity: this.options.capacity,
      name: this.options.name,
      fallback: this.options.fallback,
      errorThresholdPercentage: this.options.errorThresholdPercentage,
      enabled: true,
      allowWarmUp: true,
      volumeThreshold: 5, // 最小请求量，低于此值不会触发熔断
      cache: false,
      isPromise: true,
      isFunction: typeof this.serviceFunction === 'function',
      healthCheck: undefined, // 自定义健康检查函数
    });
  }
  
  /**
   * 绑定熔断器事件处理
   * 
   * @private
   */
  _bindEvents() {
    this.circuit.on('open', () => {
      logger.warn(`熔断器打开: ${this.options.name}`);
      this.emit('open', { name: this.options.name, timestamp: Date.now() });
    });
    
    this.circuit.on('close', () => {
      logger.info(`熔断器关闭: ${this.options.name}`);
      this.emit('close', { name: this.options.name, timestamp: Date.now() });
    });
    
    this.circuit.on('halfOpen', () => {
      logger.info(`熔断器半开: ${this.options.name}`);
      this.emit('halfOpen', { name: this.options.name, timestamp: Date.now() });
    });
    
    this.circuit.on('fallback', (result, err) => {
      logger.info(`熔断器回退: ${this.options.name}, 错误: ${err ? err.message : 'Unknown'}`);
      this.emit('fallback', { 
        name: this.options.name, 
        error: err ? err.message : 'Unknown',
        timestamp: Date.now()
      });
    });
    
    this.circuit.on('timeout', (err) => {
      logger.warn(`熔断器超时: ${this.options.name}, ${err.message}`);
      this.emit('timeout', {
        name: this.options.name,
        error: err.message,
        timestamp: Date.now()
      });
    });
    
    this.circuit.on('reject', () => {
      logger.warn(`熔断器拒绝请求: ${this.options.name}`);
      this.emit('reject', { name: this.options.name, timestamp: Date.now() });
    });
    
    this.circuit.on('success', (result) => {
      if (this.getState() !== CIRCUIT_STATE.CLOSED) {
        logger.info(`熔断器成功调用: ${this.options.name}`);
      }
      this.emit('success', { name: this.options.name, timestamp: Date.now() });
    });
    
    this.circuit.on('failure', (err) => {
      logger.error(`熔断器调用失败: ${this.options.name}, ${err.message}`, {
        stack: err.stack,
        state: this.getState()
      });
      
      this.emit('failure', {
        name: this.options.name,
        error: err.message,
        timestamp: Date.now()
      });
    });
  }
}

// 导出熔断器状态常量
CircuitBreaker.STATE = CIRCUIT_STATE;

module.exports = CircuitBreaker; 