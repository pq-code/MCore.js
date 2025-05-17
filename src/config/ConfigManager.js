/**
 * 配置管理器类
 * 提供统一的配置管理和多数据源支持
 * 
 * @module config/ConfigManager
 */

const EventEmitter = require('events');
const logger = require('../logging').logger;
const EnvProvider = require('./providers/EnvProvider');

/**
 * 配置管理器类
 */
class ConfigManager extends EventEmitter {
  /**
   * 创建配置管理器实例
   * 
   * @param {Object} options - 配置选项
   * @param {Array<Object>} options.providers - 配置提供者列表
   * @param {boolean} options.autoRefresh - 是否自动刷新配置
   * @param {number} options.refreshInterval - 自动刷新间隔（毫秒）
   * @param {Function} options.onError - 错误处理回调
   */
  constructor(options = {}) {
    super();
    this.providers = [];
    this.cache = {};
    this.refreshing = false;
    this.refreshInterval = options.refreshInterval || 60000; // 默认1分钟
    this.autoRefresh = options.autoRefresh !== false;
    this.onError = options.onError || (err => logger.error(`配置加载错误: ${err.message}`, { stack: err.stack }));
    
    // 添加环境变量提供者（最低优先级）
    this.addProvider(new EnvProvider());
    
    // 添加用户配置的提供者
    if (Array.isArray(options.providers)) {
      options.providers.forEach(provider => {
        this.addProvider(provider);
      });
    }
    
    // 初始化配置
    this._init();
  }
  
  /**
   * 添加配置提供者
   * 
   * @param {Object} provider - 配置提供者实例，必须实现load方法
   * @param {number} priority - 优先级，数字越大优先级越高
   * @returns {ConfigManager} 当前实例，支持链式调用
   */
  addProvider(provider, priority = 0) {
    if (typeof provider.load !== 'function') {
      throw new Error('配置提供者必须实现load方法');
    }
    
    // 设置提供者优先级
    provider.priority = priority;
    
    // 将提供者添加到列表并按优先级排序
    this.providers.push(provider);
    this.providers.sort((a, b) => b.priority - a.priority);
    
    // 如果提供者支持变更监听，绑定事件
    if (typeof provider.watch === 'function') {
      provider.on('change', (key, value) => {
        this._handleConfigChange(key, value, provider);
      });
    }
    
    return this;
  }
  
  /**
   * 获取配置值
   * 
   * @param {string} key - 配置键名
   * @param {*} defaultValue - 默认值，如果配置不存在则返回默认值
   * @returns {*} 配置值或默认值
   */
  get(key, defaultValue) {
    return key in this.cache ? this.cache[key] : defaultValue;
  }
  
  /**
   * 设置配置值（仅在内存中修改，不影响配置源）
   * 
   * @param {string} key - 配置键名
   * @param {*} value - 配置值
   * @returns {ConfigManager} 当前实例，支持链式调用
   */
  set(key, value) {
    const oldValue = this.cache[key];
    this.cache[key] = value;
    
    // 触发变更事件
    if (oldValue !== value) {
      this.emit('change', key, value, oldValue);
      this.emit(`change:${key}`, value, oldValue);
    }
    
    return this;
  }
  
  /**
   * 检查配置是否存在
   * 
   * @param {string} key - 配置键名
   * @returns {boolean} 是否存在
   */
  has(key) {
    return key in this.cache;
  }
  
  /**
   * 获取指定命名空间下的所有配置
   * 
   * @param {string} namespace - 命名空间
   * @returns {Object} 配置对象
   */
  getNamespace(namespace) {
    const result = {};
    const prefix = namespace ? `${namespace}.` : '';
    
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(prefix)) {
        const shortKey = key.substring(prefix.length);
        result[shortKey] = this.cache[key];
      }
    });
    
    return result;
  }
  
  /**
   * 刷新所有配置
   * 
   * @async
   * @returns {Promise<void>}
   */
  async refresh() {
    if (this.refreshing) {
      return;
    }
    
    this.refreshing = true;
    
    try {
      const oldCache = { ...this.cache };
      const newCache = {};
      
      // 按优先级顺序加载配置
      for (const provider of this.providers) {
        try {
          const config = await provider.load();
          
          // 合并配置，高优先级覆盖低优先级
          Object.assign(newCache, config);
        } catch (err) {
          this.onError(err);
        }
      }
      
      // 更新缓存并触发变更事件
      this.cache = newCache;
      
      // 对比新旧配置，触发变更事件
      this._emitChangeEvents(oldCache, newCache);
    } finally {
      this.refreshing = false;
    }
  }
  
  /**
   * 停止自动刷新
   * 
   * @returns {ConfigManager} 当前实例，支持链式调用
   */
  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // 停止所有提供者的监听
    this.providers.forEach(provider => {
      if (typeof provider.unwatch === 'function') {
        provider.unwatch();
      }
    });
    
    return this;
  }
  
  /**
   * 初始化配置管理器
   * 
   * @private
   */
  async _init() {
    // 首次加载配置
    await this.refresh();
    
    // 启动自动刷新
    if (this.autoRefresh && this.refreshInterval > 0) {
      this.refreshTimer = setInterval(() => {
        this.refresh().catch(this.onError);
      }, this.refreshInterval);
    }
    
    // 启动所有支持监听的提供者
    this.providers.forEach(provider => {
      if (typeof provider.watch === 'function') {
        provider.watch().catch(err => {
          this.onError(new Error(`配置监听启动错误: ${err.message}`));
        });
      }
    });
  }
  
  /**
   * 处理配置变更
   * 
   * @private
   * @param {string} key - 变更的配置键
   * @param {*} value - 新的配置值
   * @param {Object} provider - 触发变更的提供者
   */
  _handleConfigChange(key, value, provider) {
    // 检查触发变更的提供者优先级是否高于当前配置的来源
    let shouldUpdate = true;
    
    // 只有高优先级的提供者才能覆盖低优先级的配置
    for (const p of this.providers) {
      // 如果存在更高优先级的提供者，且它提供了该配置，则不更新
      if (p !== provider && p.priority > provider.priority && p.has && p.has(key)) {
        shouldUpdate = false;
        break;
      }
    }
    
    if (shouldUpdate) {
      const oldValue = this.cache[key];
      
      // 更新缓存
      this.cache[key] = value;
      
      // 触发变更事件
      if (oldValue !== value) {
        this.emit('change', key, value, oldValue);
        this.emit(`change:${key}`, value, oldValue);
      }
    }
  }
  
  /**
   * 触发配置变更事件
   * 
   * @private
   * @param {Object} oldCache - 旧的配置缓存
   * @param {Object} newCache - 新的配置缓存
   */
  _emitChangeEvents(oldCache, newCache) {
    // 查找新增和修改的配置
    Object.keys(newCache).forEach(key => {
      const newValue = newCache[key];
      const oldValue = oldCache[key];
      
      if (oldValue !== newValue) {
        this.emit('change', key, newValue, oldValue);
        this.emit(`change:${key}`, newValue, oldValue);
      }
    });
    
    // 查找删除的配置
    Object.keys(oldCache).forEach(key => {
      if (!(key in newCache)) {
        this.emit('change', key, undefined, oldCache[key]);
        this.emit(`change:${key}`, undefined, oldCache[key]);
      }
    });
  }
}

module.exports = ConfigManager; 