/**
 * 弹性模块 - 提供限流、熔断和降级功能
 * 
 * @module resilience
 */

const RateLimiter = require('./RateLimiter');
const CircuitBreaker = require('./CircuitBreaker');
const BulkheadPattern = require('./BulkheadPattern');
const Retry = require('./Retry');
const Timeout = require('./Timeout');
const Fallback = require('./Fallback');
const ResilienceRegistry = require('./ResilienceRegistry');
const middleware = require('./middleware');
const metrics = require('./metrics');

/**
 * 创建限流器实例
 * 
 * @param {Object} options - 限流器配置选项
 * @returns {RateLimiter} 限流器实例
 */
function createRateLimiter(options = {}) {
  return new RateLimiter(options);
}

/**
 * 创建熔断器实例
 * 
 * @param {Function|string} serviceFunction - 被保护的服务函数或名称
 * @param {Object} options - 熔断器配置选项
 * @returns {CircuitBreaker} 熔断器实例
 */
function createCircuitBreaker(serviceFunction, options = {}) {
  return new CircuitBreaker(serviceFunction, options);
}

/**
 * 创建并发限制实例
 * 
 * @param {Object} options - 并发限制配置选项
 * @returns {BulkheadPattern} 并发限制实例
 */
function createBulkhead(options = {}) {
  return new BulkheadPattern(options);
}

/**
 * 创建重试策略实例
 * 
 * @param {Object} options - 重试策略配置选项
 * @returns {Retry} 重试策略实例
 */
function createRetry(options = {}) {
  return new Retry(options);
}

/**
 * 创建超时控制实例
 * 
 * @param {Object} options - 超时控制配置选项
 * @returns {Timeout} 超时控制实例
 */
function createTimeout(options = {}) {
  return new Timeout(options);
}

/**
 * 创建降级策略实例
 * 
 * @param {Object} options - 降级策略配置选项
 * @returns {Fallback} 降级策略实例
 */
function createFallback(options = {}) {
  return new Fallback(options);
}

/**
 * 获取或创建弹性注册表实例（单例）
 * 
 * @param {Object} options - 配置选项
 * @returns {ResilienceRegistry} 弹性注册表实例
 */
function getRegistry(options = {}) {
  return ResilienceRegistry.getInstance(options);
}

module.exports = {
  createRateLimiter,
  createCircuitBreaker,
  createBulkhead,
  createRetry,
  createTimeout,
  createFallback,
  getRegistry,
  middleware,
  metrics,
  RateLimiter,
  CircuitBreaker,
  BulkheadPattern,
  Retry,
  Timeout,
  Fallback,
  ResilienceRegistry
}; 