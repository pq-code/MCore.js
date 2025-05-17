/**
 * 钩子管理器
 * 实现钩子的注册、执行和管理
 * 
 * @class HookManager
 */

const { v4: uuidv4 } = require('uuid');
const HookContext = require('./HookContext');

class HookManager {
  /**
   * 创建钩子管理器实例
   */
  constructor() {
    /**
     * 钩子集合
     * @type {Map<string, Array<Object>>}
     * @private
     */
    this._hooks = new Map();
    
    /**
     * 钩子处理器集合
     * @type {Map<string, Function>}
     * @private
     */
    this._handlers = new Map();
  }
  
  /**
   * 注册钩子处理器
   * 
   * @param {string} name - 钩子名称
   * @param {Function} handler - 钩子处理函数
   * @param {Object} options - 注册选项
   * @param {number} options.priority - 优先级(越高越先执行)
   * @param {string} options.id - 处理器ID，不提供则自动生成
   * @param {boolean} options.async - 是否异步执行
   * @returns {string} 处理器ID
   */
  register(name, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new Error('处理器必须是函数');
    }
    
    // 确保钩子集合存在
    if (!this._hooks.has(name)) {
      this._hooks.set(name, []);
    }
    
    // 处理器ID
    const id = options.id || `${name}-${uuidv4()}`;
    
    // 添加处理器
    this._handlers.set(id, handler);
    
    // 添加到钩子集合
    this._hooks.get(name).push({
      id,
      priority: options.priority || 10,
      async: !!options.async
    });
    
    // 按优先级排序
    this._hooks.get(name).sort((a, b) => b.priority - a.priority);
    
    return id;
  }
  
  /**
   * 注销钩子处理器
   * 
   * @param {string} id - 处理器ID
   * @returns {boolean} 是否成功注销
   */
  unregister(id) {
    // 删除处理器
    const removed = this._handlers.delete(id);
    
    if (removed) {
      // 从所有钩子集合中删除
      for (const [name, handlers] of this._hooks.entries()) {
        const filteredHandlers = handlers.filter(h => h.id !== id);
        if (filteredHandlers.length !== handlers.length) {
          this._hooks.set(name, filteredHandlers);
        }
      }
    }
    
    return removed;
  }
  
  /**
   * 判断钩子是否存在处理器
   * 
   * @param {string} name - 钩子名称
   * @returns {boolean} 是否存在处理器
   */
  has(name) {
    return this._hooks.has(name) && this._hooks.get(name).length > 0;
  }
  
  /**
   * 获取钩子的处理器数量
   * 
   * @param {string} name - 钩子名称
   * @returns {number} 处理器数量
   */
  count(name) {
    if (!this._hooks.has(name)) return 0;
    return this._hooks.get(name).length;
  }
  
  /**
   * 获取所有已注册的钩子名称
   * 
   * @returns {Array<string>} 钩子名称列表
   */
  getHookNames() {
    return Array.from(this._hooks.keys());
  }
  
  /**
   * 执行钩子
   * 
   * @param {string} name - 钩子名称
   * @param {Object} data - 上下文数据
   * @param {Object} options - 执行选项
   * @returns {Promise<HookContext>} 钩子上下文
   */
  async execute(name, data = {}, options = {}) {
    // 没有处理器则直接返回
    if (!this.has(name)) {
      const context = new HookContext(name, data, options);
      context.setResult(data);
      context.complete();
      return context;
    }
    
    // 创建钩子上下文
    const context = new HookContext(name, data, options);
    
    // 获取处理器
    const handlers = this._hooks.get(name);
    
    // 执行处理器
    try {
      for (const { id, async } of handlers) {
        // 如果已停止执行，则直接跳出
        if (context._stopped) break;
        
        const handler = this._handlers.get(id);
        const startTime = Date.now();
        
        try {
          // 执行处理器
          if (async) {
            context.setResult(await handler(context));
          } else {
            context.setResult(handler(context));
          }
          
          // 记录执行信息
          context.addHandler(id, Date.now() - startTime, true);
        } catch (error) {
          // 记录错误
          context.addHandler(id, Date.now() - startTime, false);
          context.setError(error);
          break;
        }
      }
    } finally {
      // 完成执行
      context.complete();
    }
    
    return context;
  }
  
  /**
   * 并行执行钩子
   * 
   * @param {string} name - 钩子名称
   * @param {Object} data - 上下文数据
   * @param {Object} options - 执行选项
   * @returns {Promise<HookContext>} 钩子上下文
   */
  async executeParallel(name, data = {}, options = {}) {
    // 没有处理器则直接返回
    if (!this.has(name)) {
      const context = new HookContext(name, data, options);
      context.setResult(data);
      context.complete();
      return context;
    }
    
    // 创建钩子上下文
    const context = new HookContext(name, data, options);
    
    // 获取处理器
    const handlers = this._hooks.get(name);
    
    // 并行执行处理器
    try {
      const promises = handlers.map(async ({ id }) => {
        const handler = this._handlers.get(id);
        const startTime = Date.now();
        
        try {
          // 执行处理器
          const result = await handler(context);
          
          // 记录执行信息
          context.addHandler(id, Date.now() - startTime, true);
          
          return { id, result, success: true };
        } catch (error) {
          // 记录错误
          context.addHandler(id, Date.now() - startTime, false);
          
          return { id, error, success: false };
        }
      });
      
      // 等待所有处理器执行完成
      const results = await Promise.all(promises);
      
      // 处理结果
      const errors = results.filter(r => !r.success).map(r => r.error);
      const successResults = results.filter(r => r.success).map(r => r.result);
      
      // 如果有错误，则设置第一个错误
      if (errors.length > 0) {
        context.setError(errors[0]);
      } else {
        // 设置结果为数组
        context.setResult(successResults);
      }
    } catch (error) {
      // 记录错误
      context.setError(error);
    } finally {
      // 完成执行
      context.complete();
    }
    
    return context;
  }
  
  /**
   * 注册钩子简写方法
   * 
   * @param {string} name - 钩子名称
   * @param {Function} handler - 钩子处理函数
   * @param {Object} options - 注册选项
   * @returns {string} 处理器ID
   */
  on(name, handler, options = {}) {
    return this.register(name, handler, options);
  }
  
  /**
   * 清除所有钩子
   */
  clear() {
    this._hooks.clear();
    this._handlers.clear();
  }
  
  /**
   * 清除指定名称的钩子
   * 
   * @param {string} name - 钩子名称
   * @returns {boolean} 是否成功清除
   */
  clearHook(name) {
    if (!this._hooks.has(name)) return false;
    
    // 获取所有处理器ID
    const handlerIds = this._hooks.get(name).map(h => h.id);
    
    // 删除处理器
    handlerIds.forEach(id => this._handlers.delete(id));
    
    // 删除钩子集合
    this._hooks.delete(name);
    
    return true;
  }
}

module.exports = HookManager; 