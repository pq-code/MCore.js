/**
 * Consul配置提供者
 * 从Consul KV存储中加载配置
 * 
 * @module config/providers/ConsulProvider
 */

const EventEmitter = require('events');
const logger = require('../../logging').logger;

/**
 * Consul配置提供者类
 */
class ConsulProvider extends EventEmitter {
  /**
   * 创建Consul配置提供者实例
   * 
   * @param {Object} options - 配置选项
   * @param {Object} options.consul - Consul客户端实例
   * @param {string} options.host - Consul服务器主机名
   * @param {number} options.port - Consul服务器端口
   * @param {boolean} options.secure - 是否使用HTTPS
   * @param {string} options.prefix - 配置键前缀
   * @param {boolean} options.watch - 是否监听配置变化
   * @param {Function} options.parser - 自定义解析函数，用于解析值
   */
  constructor(options = {}) {
    super();
    
    // 配置项
    this.host = options.host || process.env.CONSUL_HOST || 'localhost';
    this.port = options.port || process.env.CONSUL_PORT || 8500;
    this.secure = options.secure || process.env.CONSUL_SECURE === 'true';
    this.prefix = options.prefix || process.env.CONSUL_PREFIX || 'config/';
    this.watching = options.watch !== false;
    this.parser = options.parser || this._defaultParser;
    
    // 确保前缀以/结尾
    if (!this.prefix.endsWith('/')) {
      this.prefix += '/';
    }
    
    // Consul客户端
    this.consul = options.consul || this._createConsulClient();
    
    // 监听器
    this.watchers = new Map();
    
    // 缓存
    this.cache = {};
  }
  
  /**
   * 加载配置
   * 
   * @returns {Promise<Object>} 加载的配置对象
   */
  async load() {
    try {
      // 获取前缀下的所有配置
      const result = await this._getAllKV();
      
      // 更新缓存
      this.cache = result;
      
      return result;
    } catch (err) {
      logger.error(`从Consul加载配置失败: ${err.message}`, {
        stack: err.stack
      });
      
      return {};
    }
  }
  
  /**
   * 开始监听配置变化
   * 
   * @returns {Promise<void>}
   */
  async watch() {
    if (!this.watching) {
      return;
    }
    
    try {
      // 获取所有键
      const keys = await this._getKeys();
      
      // 为每个键创建监听器
      for (const key of keys) {
        await this._watchKey(key);
      }
      
      logger.info('已开始监听Consul配置变更');
      
      // 监听键变化
      this._watchKeys();
    } catch (err) {
      logger.error(`监听Consul配置失败: ${err.message}`, {
        stack: err.stack
      });
    }
  }
  
  /**
   * 停止监听配置变化
   * 
   * @returns {void}
   */
  unwatch() {
    // 停止所有监听器
    for (const [key, watcher] of this.watchers.entries()) {
      if (watcher && watcher.end) {
        watcher.end();
      }
      this.watchers.delete(key);
    }
    
    logger.info('已停止监听Consul配置变更');
  }
  
  /**
   * 检查该提供者是否包含指定配置
   * 
   * @param {string} key - 配置键名
   * @returns {boolean} 是否包含
   */
  has(key) {
    return key in this.cache;
  }
  
  /**
   * 创建Consul客户端
   * 
   * @private
   * @returns {Object} Consul客户端实例
   */
  _createConsulClient() {
    // 检查是否安装了consul模块
    try {
      const Consul = require('consul');
      
      // 创建客户端
      return new Consul({
        host: this.host,
        port: this.port,
        secure: this.secure,
        promisify: true
      });
    } catch (err) {
      logger.error('consul模块未安装，无法连接到Consul');
      
      // 返回一个空对象，但实现了必要的方法以避免错误
      return {
        kv: {
          get: () => Promise.resolve(null),
          keys: () => Promise.resolve([])
        }
      };
    }
  }
  
  /**
   * 获取指定前缀下的所有键
   * 
   * @private
   * @returns {Promise<Array<string>>} 键列表
   */
  async _getKeys() {
    try {
      const keys = await this.consul.kv.keys(this.prefix);
      return Array.isArray(keys) ? keys : [];
    } catch (err) {
      logger.error(`获取Consul键列表失败: ${err.message}`);
      return [];
    }
  }
  
  /**
   * 获取指定前缀下的所有配置
   * 
   * @private
   * @returns {Promise<Object>} 配置对象
   */
  async _getAllKV() {
    const config = {};
    
    // 获取所有键
    const keys = await this._getKeys();
    
    // 获取每个键的值
    for (const key of keys) {
      try {
        const result = await this.consul.kv.get(key);
        
        if (result && result.Value) {
          // 解析值
          const value = this.parser(result.Value);
          
          // 移除前缀并转换为配置键
          const configKey = this._keyToConfigKey(key);
          
          // 设置配置
          config[configKey] = value;
        }
      } catch (err) {
        logger.error(`获取Consul键值失败: ${key}, ${err.message}`);
      }
    }
    
    return config;
  }
  
  /**
   * 监听特定键的变化
   * 
   * @private
   * @param {string} key - 键名
   * @returns {Promise<void>}
   */
  async _watchKey(key) {
    // 如果已经在监听，则跳过
    if (this.watchers.has(key)) {
      return;
    }
    
    try {
      // 为该键创建监听器
      const watcher = this.consul.watch({
        method: this.consul.kv.get,
        options: { key }
      });
      
      // 保存监听器
      this.watchers.set(key, watcher);
      
      // 处理变更
      watcher.on('change', data => {
        try {
          // 计算配置键
          const configKey = this._keyToConfigKey(key);
          
          // 获取旧值
          const oldValue = this.cache[configKey];
          
          // 解析新值
          const newValue = data && data.Value ? this.parser(data.Value) : undefined;
          
          // 更新缓存
          if (newValue === undefined) {
            delete this.cache[configKey];
          } else {
            this.cache[configKey] = newValue;
          }
          
          // 触发变更事件
          if (oldValue !== newValue) {
            this.emit('change', configKey, newValue, oldValue);
          }
        } catch (err) {
          logger.error(`处理Consul配置变更失败: ${key}, ${err.message}`);
        }
      });
      
      // 处理错误
      watcher.on('error', err => {
        logger.error(`Consul配置监听器错误: ${key}, ${err.message}`);
      });
    } catch (err) {
      logger.error(`创建Consul配置监听器失败: ${key}, ${err.message}`);
    }
  }
  
  /**
   * 监听键列表变化
   * 
   * @private
   */
  _watchKeys() {
    try {
      // 创建监听器，监听键的添加和删除
      const watcher = this.consul.watch({
        method: this.consul.kv.keys,
        options: { prefix: this.prefix }
      });
      
      // 处理变更
      watcher.on('change', async keys => {
        try {
          const currentKeys = Array.isArray(keys) ? keys : [];
          const watchedKeys = Array.from(this.watchers.keys());
          
          // 查找新增的键
          const addedKeys = currentKeys.filter(key => !watchedKeys.includes(key));
          
          // 查找删除的键
          const removedKeys = watchedKeys.filter(key => !currentKeys.includes(key) && key !== this.prefix);
          
          // 为新增的键创建监听器
          for (const key of addedKeys) {
            await this._watchKey(key);
          }
          
          // 为删除的键停止监听
          for (const key of removedKeys) {
            if (this.watchers.has(key)) {
              const watcher = this.watchers.get(key);
              if (watcher && watcher.end) {
                watcher.end();
              }
              this.watchers.delete(key);
              
              // 从缓存中删除
              const configKey = this._keyToConfigKey(key);
              const oldValue = this.cache[configKey];
              
              delete this.cache[configKey];
              
              // 触发变更事件
              this.emit('change', configKey, undefined, oldValue);
            }
          }
        } catch (err) {
          logger.error(`处理Consul键列表变更失败: ${err.message}`);
        }
      });
      
      // 处理错误
      watcher.on('error', err => {
        logger.error(`Consul键列表监听器错误: ${err.message}`);
      });
    } catch (err) {
      logger.error(`创建Consul键列表监听器失败: ${err.message}`);
    }
  }
  
  /**
   * 将Consul键转换为配置键
   * 
   * @private
   * @param {string} key - Consul键
   * @returns {string} 配置键
   */
  _keyToConfigKey(key) {
    // 移除前缀
    let configKey = key;
    if (configKey.startsWith(this.prefix)) {
      configKey = configKey.substring(this.prefix.length);
    }
    
    // 将/转换为.
    configKey = configKey.replace(/\//g, '.');
    
    return configKey;
  }
  
  /**
   * 默认的解析函数
   * 
   * @private
   * @param {string} value - 原始值
   * @returns {*} 解析后的值
   */
  _defaultParser(value) {
    // Consul的值是Base64编码的字符串
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    
    // 尝试解析为JSON
    try {
      return JSON.parse(decoded);
    } catch (err) {
      // 如果不是有效的JSON，则作为原始值返回
      return decoded;
    }
  }
}

module.exports = ConsulProvider; 