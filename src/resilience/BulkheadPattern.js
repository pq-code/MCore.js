/**
 * 并发限制模式 (Bulkhead Pattern)
 * 限制并发请求数量，防止服务过载
 * 
 * @module resilience/BulkheadPattern
 */

const logger = require('../logging').logger;

/**
 * 并发限制实现类
 */
class BulkheadPattern {
  /**
   * 创建并发限制实例
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.maxConcurrent - 最大并发请求数
   * @param {number} options.maxQueueSize - 最大等待队列长度
   * @param {number} options.queueTimeout - 队列等待超时时间（毫秒）
   * @param {string} options.name - 并发限制器名称
   */
  constructor(options = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent || parseInt(process.env.BULKHEAD_MAX_CONCURRENT, 10) || 10,
      maxQueueSize: options.maxQueueSize || parseInt(process.env.BULKHEAD_MAX_QUEUE_SIZE, 10) || 100,
      queueTimeout: options.queueTimeout || parseInt(process.env.BULKHEAD_QUEUE_TIMEOUT, 10) || 2000,
      name: options.name || 'bulkhead'
    };
    
    // 当前执行的请求数
    this.activeCount = 0;
    
    // 等待队列
    this.queue = [];
    
    // 统计信息
    this.stats = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      timeoutCalls: 0,
      activeRequests: 0,
      queueSize: 0,
      maxConcurrent: this.options.maxConcurrent,
      maxQueueSize: this.options.maxQueueSize
    };
    
    logger.info(`已创建并发限制器: ${this.options.name}, 最大并发=${this.options.maxConcurrent}, 最大队列=${this.options.maxQueueSize}`);
  }
  
  /**
   * 执行受保护的异步函数
   * 
   * @async
   * @param {Function} fn - 要执行的函数
   * @param {...any} args - 传递给函数的参数
   * @returns {Promise<any>} 函数执行结果
   * @throws {Error} 如果请求被拒绝或超时
   */
  async execute(fn, ...args) {
    // 更新统计信息
    this.stats.totalCalls++;
    
    // 检查是否可以直接执行
    if (this.activeCount < this.options.maxConcurrent) {
      return this._executeFunction(fn, args);
    }
    
    // 检查队列是否已满
    if (this.queue.length >= this.options.maxQueueSize) {
      this.stats.rejectedCalls++;
      
      const error = new Error(`请求被拒绝: ${this.options.name} - 并发限制队列已满`);
      error.statusCode = 429; // Too Many Requests
      error.bulkheadRejected = true;
      
      logger.warn(`并发限制器拒绝请求: ${this.options.name} - 队列已满 (${this.queue.length}/${this.options.maxQueueSize})`);
      throw error;
    }
    
    // 添加到等待队列
    return new Promise((resolve, reject) => {
      const queuedRequest = {
        fn,
        args,
        resolve,
        reject,
        queuedAt: Date.now(),
        timer: setTimeout(() => {
          // 从队列中移除
          const index = this.queue.indexOf(queuedRequest);
          if (index !== -1) {
            this.queue.splice(index, 1);
            this.stats.queueSize = this.queue.length;
            this.stats.timeoutCalls++;
            
            const error = new Error(`请求在队列中等待超时: ${this.options.name} - 超过${this.options.queueTimeout}ms`);
            error.statusCode = 504; // Gateway Timeout
            error.bulkheadTimeout = true;
            
            logger.warn(`并发限制器队列等待超时: ${this.options.name} - 超过${this.options.queueTimeout}ms`);
            reject(error);
          }
        }, this.options.queueTimeout)
      };
      
      this.queue.push(queuedRequest);
      this.stats.queueSize = this.queue.length;
      
      logger.debug(`请求已加入并发限制队列: ${this.options.name} - 队列大小(${this.queue.length}/${this.options.maxQueueSize})`);
    });
  }
  
  /**
   * 执行并发限制包装函数
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
   * 获取统计信息
   * 
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeRequests: this.activeCount,
      queueSize: this.queue.length
    };
  }
  
  /**
   * 内部使用的函数执行方法
   * 
   * @private
   * @async
   * @param {Function} fn - 要执行的函数
   * @param {Array} args - 函数参数
   * @returns {Promise<any>} 函数执行结果
   */
  async _executeFunction(fn, args) {
    this.activeCount++;
    this.stats.activeRequests = this.activeCount;
    
    try {
      const result = await fn(...args);
      this.stats.successCalls++;
      return result;
    } catch (err) {
      this.stats.failedCalls++;
      throw err;
    } finally {
      this.activeCount--;
      this.stats.activeRequests = this.activeCount;
      
      // 尝试从队列中处理下一个请求
      this._processNextQueuedRequest();
    }
  }
  
  /**
   * 处理队列中的下一个请求
   * 
   * @private
   */
  _processNextQueuedRequest() {
    if (this.queue.length > 0 && this.activeCount < this.options.maxConcurrent) {
      const nextRequest = this.queue.shift();
      this.stats.queueSize = this.queue.length;
      
      // 清除超时定时器
      clearTimeout(nextRequest.timer);
      
      // 执行请求
      this._executeFunction(nextRequest.fn, nextRequest.args)
        .then(result => nextRequest.resolve(result))
        .catch(err => nextRequest.reject(err));
      
      logger.debug(`从并发限制队列中取出请求: ${this.options.name} - 剩余队列(${this.queue.length}/${this.options.maxQueueSize})`);
    }
  }
}

module.exports = BulkheadPattern; 