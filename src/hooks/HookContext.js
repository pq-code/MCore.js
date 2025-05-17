/**
 * 钩子上下文类
 * 用于传递钩子执行的上下文信息
 * 
 * @class HookContext
 */
class HookContext {
  /**
   * 创建钩子上下文
   * 
   * @param {string} name - 钩子名称
   * @param {Object} data - 上下文数据
   * @param {Object} options - 钩子选项
   */
  constructor(name, data = {}, options = {}) {
    /**
     * 钩子名称
     * @type {string}
     */
    this.name = name;
    
    /**
     * 上下文数据
     * @type {Object}
     */
    this.data = data;
    
    /**
     * 钩子执行选项
     * @type {Object}
     */
    this.options = options;
    
    /**
     * 执行结果
     * @type {*}
     */
    this.result = undefined;
    
    /**
     * 是否停止钩子链执行
     * @type {boolean}
     */
    this._stopped = false;
    
    /**
     * 执行过程中的错误
     * @type {Error|null}
     */
    this.error = null;
    
    /**
     * 元数据
     * @type {Object}
     */
    this.meta = {
      startTime: Date.now(),
      handlers: [],
      endTime: null,
      duration: null
    };
  }
  
  /**
   * 停止钩子链的执行
   * 
   * @returns {HookContext} 当前上下文实例
   */
  stop() {
    this._stopped = true;
    return this;
  }
  
  /**
   * 设置结果并继续执行
   * 
   * @param {*} result - 执行结果
   * @returns {HookContext} 当前上下文实例
   */
  setResult(result) {
    this.result = result;
    return this;
  }
  
  /**
   * 设置错误并停止执行
   * 
   * @param {Error} error - 错误对象
   * @returns {HookContext} 当前上下文实例
   */
  setError(error) {
    this.error = error;
    this._stopped = true;
    return this;
  }
  
  /**
   * 添加处理器执行记录
   * 
   * @param {string} handlerId - 处理器ID
   * @param {number} duration - 执行时间(毫秒)
   * @param {boolean} success - 是否成功执行
   * @returns {HookContext} 当前上下文实例
   */
  addHandler(handlerId, duration, success = true) {
    this.meta.handlers.push({
      id: handlerId,
      duration,
      success,
      timestamp: Date.now()
    });
    return this;
  }
  
  /**
   * 完成钩子执行
   * 
   * @returns {HookContext} 当前上下文实例
   */
  complete() {
    this.meta.endTime = Date.now();
    this.meta.duration = this.meta.endTime - this.meta.startTime;
    return this;
  }
  
  /**
   * 创建钩子上下文的快照
   * 
   * @returns {Object} 上下文快照
   */
  toJSON() {
    return {
      name: this.name,
      data: this.data,
      result: this.result,
      stopped: this._stopped,
      error: this.error ? {
        message: this.error.message,
        stack: this.error.stack,
        name: this.error.name
      } : null,
      meta: this.meta
    };
  }
}

module.exports = HookContext; 