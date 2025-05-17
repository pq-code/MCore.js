/**
 * 降级策略组件
 * 提供服务降级功能，当主操作失败时执行备选操作
 * 
 * @module resilience/Fallback
 */

/**
 * 降级策略类
 */
class Fallback {
  /**
   * 创建降级策略实例
   * 
   * @param {Object} options - 配置选项
   * @param {Function} options.fallbackFunction - 降级函数，当主操作失败时执行
   * @param {Array<Function>} options.predicates - 判断是否应该降级的断言函数数组
   * @param {string} options.name - 降级策略名称，用于日志和指标
   * @param {boolean} options.enableMetrics - 是否启用指标收集
   */
  constructor(options = {}) {
    this.fallbackFunction = options.fallbackFunction;
    this.predicates = Array.isArray(options.predicates) ? options.predicates : [];
    this.name = options.name || `fallback-${Date.now()}`;
    this.enableMetrics = options.enableMetrics !== false;
    
    // 验证降级函数
    if (this.fallbackFunction && typeof this.fallbackFunction !== 'function') {
      throw new Error('降级函数必须是一个函数');
    }
    
    // 如果启用指标，创建计数器
    if (this.enableMetrics && typeof window === 'undefined') {
      // 仅在服务端环境执行
      try {
        const promClient = require('prom-client');
        this.fallbackCounter = new promClient.Counter({
          name: 'resilience_fallback_executions_total',
          help: '降级策略执行计数',
          labelNames: ['name', 'result']
        });
      } catch (err) {
        console.warn('无法初始化指标收集:', err.message);
        this.enableMetrics = false;
      }
    }
  }

  /**
   * 判断是否应该对特定错误进行降级处理
   * 
   * @param {Error} error - 发生的错误
   * @returns {boolean} 是否应该降级
   */
  shouldApplyFallback(error) {
    // 如果没有断言函数，则对所有错误都应用降级
    if (!this.predicates.length) {
      return true;
    }
    
    // 如果任一断言为真，则应用降级
    return this.predicates.some(predicate => {
      try {
        return predicate(error);
      } catch (e) {
        console.warn(`降级判断函数执行失败: ${e.message}`);
        return false;
      }
    });
  }

  /**
   * 使用降级策略执行函数
   * 
   * @param {Function} fn - 要执行的主函数
   * @param {Array} args - 传递给函数的参数
   * @returns {Promise<*>} 函数执行结果，如果主函数失败并符合降级条件，则返回降级函数结果
   */
  async execute(fn, ...args) {
    let metrics = { result: 'success' };
    
    try {
      // 执行主函数
      return await fn(...args);
    } catch (error) {
      // 判断是否应该降级
      if (this.shouldApplyFallback(error) && this.fallbackFunction) {
        metrics.result = 'fallback';
        
        try {
          // 执行降级函数
          return await this.fallbackFunction(error, ...args);
        } catch (fallbackError) {
          // 降级函数也失败
          metrics.result = 'fallback_error';
          throw fallbackError;
        }
      }
      
      // 不应该降级或没有降级函数
      metrics.result = 'error';
      throw error;
    } finally {
      // 更新指标
      if (this.enableMetrics && this.fallbackCounter) {
        this.fallbackCounter.inc({ name: this.name, result: metrics.result });
      }
    }
  }

  /**
   * 创建带有降级策略的函数包装器
   * 
   * @param {Function} fn - 要包装的函数
   * @returns {Function} 包装后的函数
   */
  wrap(fn) {
    return async (...args) => {
      return this.execute(fn, ...args);
    };
  }

  /**
   * 设置降级函数
   * 
   * @param {Function} fallbackFunction - 降级函数
   * @returns {Fallback} 当前实例，支持链式调用
   */
  withFallback(fallbackFunction) {
    if (typeof fallbackFunction !== 'function') {
      throw new Error('降级函数必须是一个函数');
    }
    this.fallbackFunction = fallbackFunction;
    return this;
  }

  /**
   * 添加断言函数，用于判断何时应用降级
   * 
   * @param {Function} predicate - 判断是否应该降级的函数，接收错误对象，返回布尔值
   * @returns {Fallback} 当前实例，支持链式调用
   */
  withPredicate(predicate) {
    if (typeof predicate !== 'function') {
      throw new Error('断言必须是一个函数');
    }
    this.predicates.push(predicate);
    return this;
  }
}

module.exports = Fallback; 