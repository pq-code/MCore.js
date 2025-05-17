/**
 * 重试模式 
 * 自动重试失败的操作
 * 
 * @module resilience/Retry
 */

const logger = require('../logging').logger;

/**
 * 重试策略类型
 */
const RETRY_STRATEGIES = {
  FIXED: 'fixed',
  EXPONENTIAL: 'exponential',
  FIBONACCI: 'fibonacci',
  RANDOM: 'random'
};

/**
 * 重试类
 */
class Retry {
  /**
   * 创建重试实例
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.maxRetries - 最大重试次数
   * @param {string} options.strategy - 重试策略：fixed, exponential, fibonacci, random
   * @param {number} options.initialDelay - 初始延迟（毫秒）
   * @param {number} options.maxDelay - 最大延迟（毫秒）
   * @param {number} options.factor - 用于指数或斐波那契策略的因子
   * @param {number} options.jitter - 随机抖动比例（0-1）
   * @param {Function} options.retryCondition - 自定义重试条件函数
   * @param {Function} options.onRetry - 重试回调函数
   * @param {string} options.name - 重试器名称
   */
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || parseInt(process.env.RETRY_MAX_RETRIES, 10) || 3,
      strategy: options.strategy || process.env.RETRY_STRATEGY || RETRY_STRATEGIES.EXPONENTIAL,
      initialDelay: options.initialDelay || parseInt(process.env.RETRY_INITIAL_DELAY, 10) || 1000,
      maxDelay: options.maxDelay || parseInt(process.env.RETRY_MAX_DELAY, 10) || 30000,
      factor: options.factor || parseFloat(process.env.RETRY_FACTOR) || 2,
      jitter: options.jitter || parseFloat(process.env.RETRY_JITTER) || 0.2,
      retryCondition: options.retryCondition || this._defaultRetryCondition,
      onRetry: options.onRetry,
      name: options.name || 'retry'
    };
    
    // 确保策略有效
    if (!Object.values(RETRY_STRATEGIES).includes(this.options.strategy)) {
      this.options.strategy = RETRY_STRATEGIES.EXPONENTIAL;
    }
    
    logger.info(`已创建重试器: ${this.options.name}, 策略=${this.options.strategy}, 最大重试次数=${this.options.maxRetries}`);
  }
  
  /**
   * 执行带有重试的异步函数
   * 
   * @async
   * @param {Function} fn - 要执行的函数
   * @param {...any} args - 传递给函数的参数
   * @returns {Promise<any>} 函数执行结果
   * @throws {Error} 如果所有重试都失败，抛出最后一次错误
   */
  async execute(fn, ...args) {
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= this.options.maxRetries) {
      try {
        if (attempt > 0) {
          // 不是第一次尝试，等待一段时间后重试
          const delayMs = this._calculateDelay(attempt);
          await this._delay(delayMs);
          
          // 调用重试回调
          if (this.options.onRetry) {
            this.options.onRetry({
              attempt,
              error: lastError,
              delay: delayMs
            });
          }
        }
        
        // 执行函数
        return await fn(...args);
      } catch (err) {
        lastError = err;
        
        // 检查是否应该重试
        const shouldRetry = attempt < this.options.maxRetries &&
          await this._shouldRetry(err, attempt);
        
        if (!shouldRetry) {
          // 不再重试，抛出错误
          throw this._enhanceError(err, attempt);
        }
        
        // 记录重试信息
        logger.warn(`操作失败，准备重试 (${attempt + 1}/${this.options.maxRetries}): ${this.options.name}, 错误: ${err.message}`);
        
        // 继续下一次重试
        attempt++;
      }
    }
    
    // 所有重试都失败，抛出最后一次错误
    throw this._enhanceError(lastError, attempt);
  }
  
  /**
   * 创建包装函数
   * 
   * @param {Function} fn - 原始函数
   * @returns {Function} 包装后的函数
   */
  wrap(fn) {
    return async (...args) => {
      return this.execute(fn, ...args);
    };
  }
  
  /**
   * 计算重试延迟时间
   * 
   * @private
   * @param {number} attempt - 重试次数（从1开始）
   * @returns {number} 延迟时间（毫秒）
   */
  _calculateDelay(attempt) {
    let delay = 0;
    
    switch (this.options.strategy) {
    case RETRY_STRATEGIES.FIXED:
      delay = this.options.initialDelay;
      break;
        
    case RETRY_STRATEGIES.EXPONENTIAL:
      delay = this.options.initialDelay * Math.pow(this.options.factor, attempt - 1);
      break;
        
    case RETRY_STRATEGIES.FIBONACCI:
      delay = this._getFibonacciNumber(attempt) * this.options.initialDelay;
      break;
        
    case RETRY_STRATEGIES.RANDOM:
      delay = Math.random() * this.options.initialDelay * attempt;
      break;
        
    default:
      delay = this.options.initialDelay;
    }
    
    // 应用抖动
    if (this.options.jitter > 0) {
      const jitterAmount = delay * this.options.jitter;
      delay = delay - (jitterAmount / 2) + (Math.random() * jitterAmount);
    }
    
    // 限制最大延迟
    return Math.min(delay, this.options.maxDelay);
  }
  
  /**
   * 获取斐波那契数列的第n个数
   * 
   * @private
   * @param {number} n - 索引
   * @returns {number} 斐波那契数
   */
  _getFibonacciNumber(n) {
    let a = 1;
    let b = 1;
    
    for (let i = 3; i <= n; i++) {
      const c = a + b;
      a = b;
      b = c;
    }
    
    return b;
  }
  
  /**
   * 延迟指定时间
   * 
   * @private
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 默认的重试条件
   * 
   * @private
   * @param {Error} err - 错误对象
   * @returns {boolean} 是否应该重试
   */
  _defaultRetryCondition(err) {
    // 默认对网络错误、超时错误和5xx服务器错误进行重试
    if (!err) return false;
    
    // 网络错误
    if (err.code && [
      'ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT',
      'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH',
      'EPIPE', 'EAI_AGAIN'
    ].includes(err.code)) {
      return true;
    }
    
    // HTTP 状态码检查
    if (err.statusCode) {
      // 对服务器错误（5xx）进行重试
      return err.statusCode >= 500 && err.statusCode < 600;
    }
    
    return false;
  }
  
  /**
   * 检查是否应该重试
   * 
   * @private
   * @param {Error} err - 错误对象
   * @param {number} attempt - 当前尝试次数
   * @returns {boolean|Promise<boolean>} 是否应该重试
   */
  _shouldRetry(err, attempt) {
    if (attempt >= this.options.maxRetries) {
      return false;
    }
    
    // 使用自定义条件或默认条件
    return this.options.retryCondition(err, attempt);
  }
  
  /**
   * 增强错误信息
   * 
   * @private
   * @param {Error} err - 原始错误
   * @param {number} attempt - 尝试次数
   * @returns {Error} 增强后的错误
   */
  _enhanceError(err, attempt) {
    if (!err) {
      return new Error('Unknown error');
    }
    
    err.retriesAttempted = attempt;
    err.retriesExhausted = attempt >= this.options.maxRetries;
    
    return err;
  }
}

// 导出重试策略常量
Retry.STRATEGIES = RETRY_STRATEGIES;

module.exports = Retry; 