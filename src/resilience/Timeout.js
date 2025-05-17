/**
 * 超时控制组件
 * 提供对操作的超时控制，避免长时间执行的操作阻塞系统
 * 
 * @module resilience/Timeout
 */

/**
 * 超时错误类
 */
class TimeoutError extends Error {
  /**
   * 创建超时错误实例
   * 
   * @param {string} message - 错误信息
   * @param {Object} options - 错误选项
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'TimeoutError';
    this.functionName = options.functionName || 'unknown';
    this.timeoutDuration = options.timeoutDuration || 0;
  }
}

/**
 * 超时控制类
 */
class Timeout {
  /**
   * 创建超时控制实例
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.timeout - 超时时间（毫秒）
   * @param {string} options.name - 超时控制名称，用于日志和指标
   * @param {boolean} options.enableMetrics - 是否启用指标收集
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 5000; // 默认5秒
    this.name = options.name || `timeout-${Date.now()}`;
    this.enableMetrics = options.enableMetrics !== false;
    
    // 如果启用指标，创建计数器
    if (this.enableMetrics && typeof window === 'undefined') {
      // 仅在服务端环境执行
      try {
        const promClient = require('prom-client');
        this.timeoutCounter = new promClient.Counter({
          name: 'resilience_timeout_executions_total',
          help: '超时控制执行计数',
          labelNames: ['name', 'result']
        });
      } catch (err) {
        console.warn('无法初始化指标收集:', err.message);
        this.enableMetrics = false;
      }
    }
  }

  /**
   * 使用超时控制执行函数
   * 
   * @param {Function} fn - 要执行的函数
   * @param {Array} args - 传递给函数的参数
   * @returns {Promise<*>} 函数执行结果
   * @throws {TimeoutError} 如果函数执行超时
   */
  async execute(fn, ...args) {
    let timerID;
    let metrics = { result: 'success' };
    
    try {
      // 创建超时Promise
      const timeoutPromise = new Promise((_, reject) => {
        timerID = setTimeout(() => {
          const error = new TimeoutError(
            `操作超时: 超过${this.timeout}ms`,
            { 
              functionName: fn.name || this.name,
              timeoutDuration: this.timeout
            }
          );
          reject(error);
        }, this.timeout);
      });
      
      // 创建执行Promise
      const executionPromise = Promise.resolve().then(() => fn(...args));
      
      // 竞争执行，谁先完成返回谁
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // 清除超时定时器
      clearTimeout(timerID);
      
      return result;
    } catch (error) {
      // 清除超时定时器
      if (timerID) {
        clearTimeout(timerID);
      }
      
      // 设置指标标签
      if (error instanceof TimeoutError) {
        metrics.result = 'timeout';
      } else {
        metrics.result = 'error';
      }
      
      throw error;
    } finally {
      // 更新指标
      if (this.enableMetrics && this.timeoutCounter) {
        this.timeoutCounter.inc({ name: this.name, result: metrics.result });
      }
    }
  }

  /**
   * 创建带有超时控制的函数包装器
   * 
   * @param {Function} fn - 要包装的函数
   * @returns {Function} 包装后的函数
   */
  wrap(fn) {
    return async (...args) => {
      return this.execute(fn, ...args);
    };
  }
}

module.exports = Timeout; 