/**
 * 弹性组件注册表
 * 管理和注册所有弹性组件的中心
 * 
 * @module resilience/ResilienceRegistry
 */

const RateLimiter = require('./RateLimiter');
const CircuitBreaker = require('./CircuitBreaker');
const BulkheadPattern = require('./BulkheadPattern');
const Retry = require('./Retry');
const Timeout = require('./Timeout');
const Fallback = require('./Fallback');

/**
 * 弹性组件注册表类
 */
class ResilienceRegistry {
  /**
   * 创建弹性注册表实例
   * 
   * @param {Object} options - 配置选项
   * @param {boolean} options.enableMetrics - 是否启用指标收集
   */
  constructor(options = {}) {
    this.enableMetrics = options.enableMetrics !== false;
    this.rateLimiters = new Map();
    this.circuitBreakers = new Map();
    this.bulkheads = new Map();
    this.retries = new Map();
    this.timeouts = new Map();
    this.fallbacks = new Map();
  }

  /**
   * 获取弹性注册表单例
   * 
   * @param {Object} options - 配置选项
   * @returns {ResilienceRegistry} 弹性注册表实例
   */
  static getInstance(options = {}) {
    if (!ResilienceRegistry.instance) {
      ResilienceRegistry.instance = new ResilienceRegistry(options);
    }
    return ResilienceRegistry.instance;
  }

  /**
   * 获取或创建限流器
   * 
   * @param {string} name - 限流器名称
   * @param {Object} options - 限流器配置选项
   * @returns {RateLimiter} 限流器实例
   */
  getRateLimiter(name, options = {}) {
    if (!this.rateLimiters.has(name)) {
      const rateLimiter = new RateLimiter({
        ...options,
        name,
        enableMetrics: this.enableMetrics
      });
      this.rateLimiters.set(name, rateLimiter);
    }
    return this.rateLimiters.get(name);
  }

  /**
   * 获取或创建熔断器
   * 
   * @param {string} name - 熔断器名称
   * @param {Function} serviceFunction - 被保护的服务函数
   * @param {Object} options - 熔断器配置选项
   * @returns {CircuitBreaker} 熔断器实例
   */
  getCircuitBreaker(name, serviceFunction, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker(serviceFunction, {
        ...options,
        name,
        enableMetrics: this.enableMetrics
      });
      this.circuitBreakers.set(name, circuitBreaker);
    }
    return this.circuitBreakers.get(name);
  }

  /**
   * 获取或创建并发限制
   * 
   * @param {string} name - 并发限制名称
   * @param {Object} options - 并发限制配置选项
   * @returns {BulkheadPattern} 并发限制实例
   */
  getBulkhead(name, options = {}) {
    if (!this.bulkheads.has(name)) {
      const bulkhead = new BulkheadPattern({
        ...options,
        name,
        enableMetrics: this.enableMetrics
      });
      this.bulkheads.set(name, bulkhead);
    }
    return this.bulkheads.get(name);
  }

  /**
   * 获取或创建重试策略
   * 
   * @param {string} name - 重试策略名称
   * @param {Object} options - 重试策略配置选项
   * @returns {Retry} 重试策略实例
   */
  getRetry(name, options = {}) {
    if (!this.retries.has(name)) {
      const retry = new Retry({
        ...options,
        name,
        enableMetrics: this.enableMetrics
      });
      this.retries.set(name, retry);
    }
    return this.retries.get(name);
  }

  /**
   * 获取或创建超时控制
   * 
   * @param {string} name - 超时控制名称
   * @param {Object} options - 超时控制配置选项
   * @returns {Timeout} 超时控制实例
   */
  getTimeout(name, options = {}) {
    if (!this.timeouts.has(name)) {
      const timeout = new Timeout({
        ...options,
        name,
        enableMetrics: this.enableMetrics
      });
      this.timeouts.set(name, timeout);
    }
    return this.timeouts.get(name);
  }

  /**
   * 获取或创建降级策略
   * 
   * @param {string} name - 降级策略名称
   * @param {Object} options - 降级策略配置选项
   * @returns {Fallback} 降级策略实例
   */
  getFallback(name, options = {}) {
    if (!this.fallbacks.has(name)) {
      const fallback = new Fallback({
        ...options,
        name,
        enableMetrics: this.enableMetrics
      });
      this.fallbacks.set(name, fallback);
    }
    return this.fallbacks.get(name);
  }

  /**
   * 清除所有注册的组件
   */
  clear() {
    this.rateLimiters.clear();
    this.circuitBreakers.clear();
    this.bulkheads.clear();
    this.retries.clear();
    this.timeouts.clear();
    this.fallbacks.clear();
  }

  /**
   * 获取注册表中所有组件的统计信息
   * 
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      rateLimiters: this.rateLimiters.size,
      circuitBreakers: this.circuitBreakers.size,
      bulkheads: this.bulkheads.size,
      retries: this.retries.size,
      timeouts: this.timeouts.size,
      fallbacks: this.fallbacks.size
    };
  }
}

module.exports = ResilienceRegistry; 