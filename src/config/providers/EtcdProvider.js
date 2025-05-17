/**
 * Etcd配置提供者
 * 从Etcd KV存储中加载配置
 * 
 * @module config/providers/EtcdProvider
 */

const EventEmitter = require('events');
const logger = require('../../logging').logger;

/**
 * Etcd配置提供者类
 */
class EtcdProvider extends EventEmitter {
  /**
   * 创建Etcd配置提供者实例
   * 
   * @param {Object} options - 配置选项
   * @param {Object} options.client - Etcd客户端实例
   * @param {Array<string>} options.hosts - Etcd服务器地址列表
   * @param {string} options.prefix - 配置键前缀
   * @param {boolean} options.watch - 是否监听配置变化
   * @param {Function} options.parser - 自定义解析函数，用于解析值
   */
  constructor(options = {}) {
    super();
    
    // 配置项
    this.hosts = options.hosts || (process.env.ETCD_HOSTS ? process.env.ETCD_HOSTS.split(',') : ['localhost:2379']);
    this.prefix = options.prefix || process.env.ETCD_PREFIX || '/config/';
    this.watching = options.watch !== false;
    this.parser = options.parser || this._defaultParser;
    
    // 确保前缀以/开头和结尾
    if (!this.prefix.startsWith('/')) {
      this.prefix = '/' + this.prefix;
    }
    if (!this.prefix.endsWith('/')) {
      this.prefix += '/';
    }
    
    // Etcd客户端
    this.client = options.client || this._createEtcdClient();
    
    // 监听器
    this.watcher = null;
    
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
      logger.error(`从Etcd加载配置失败: ${err.message}`, {
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
    if (!this.watching || this.watcher) {
      return;
    }
    
    try {
      // 检查client是否具有watch方法
      if (!this.client || !this.client.watch) {
        logger.warn('Etcd客户端不支持监听功能');
        return;
      }
      
      // 监听前缀下的所有键
      this.watcher = this.client.watch()
        .prefix(this.prefix)
        .create();
      
      // 处理变更
      this.watcher.on('put', kv => {
        try {
          // 计算配置键
          const configKey = this._keyToConfigKey(kv.key.toString());
          
          // 获取旧值
          const oldValue = this.cache[configKey];
          
          // 解析新值
          const newValue = this.parser(kv.value.toString());
          
          // 更新缓存
          this.cache[configKey] = newValue;
          
          // 触发变更事件
          if (oldValue !== newValue) {
            this.emit('change', configKey, newValue, oldValue);
          }
        } catch (err) {
          logger.error(`处理Etcd配置变更失败: ${kv.key.toString()}, ${err.message}`);
        }
      });
      
      // 处理删除
      this.watcher.on('delete', kv => {
        try {
          // 计算配置键
          const configKey = this._keyToConfigKey(kv.key.toString());
          
          // 获取旧值
          const oldValue = this.cache[configKey];
          
          // 从缓存中删除
          delete this.cache[configKey];
          
          // 触发变更事件
          this.emit('change', configKey, undefined, oldValue);
        } catch (err) {
          logger.error(`处理Etcd配置删除失败: ${kv.key.toString()}, ${err.message}`);
        }
      });
      
      // 处理错误
      this.watcher.on('error', err => {
        logger.error(`Etcd配置监听器错误: ${err.message}`);
      });
      
      logger.info('已开始监听Etcd配置变更');
    } catch (err) {
      logger.error(`监听Etcd配置失败: ${err.message}`, {
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
    if (this.watcher) {
      this.watcher.cancel();
      this.watcher = null;
      logger.info('已停止监听Etcd配置变更');
    }
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
   * 创建Etcd客户端
   * 
   * @private
   * @returns {Object} Etcd客户端实例
   */
  _createEtcdClient() {
    // 检查是否安装了etcd3模块
    try {
      const { Etcd3 } = require('etcd3');
      
      // 创建客户端
      return new Etcd3({
        hosts: this.hosts
      });
    } catch (err) {
      logger.error('etcd3模块未安装，无法连接到Etcd');
      
      // 返回一个空对象，但实现了必要的方法以避免错误
      return {
        getAll: () => Promise.resolve(new Map()),
        get: () => Promise.resolve(null)
      };
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
    
    try {
      // 检查client是否具有getAll方法
      if (!this.client || !this.client.getAll) {
        return config;
      }
      
      // 获取所有键值对
      const result = await this.client.getAll().prefix(this.prefix).strings();
      
      // 转换为配置对象
      for (const [key, value] of Object.entries(result)) {
        try {
          // 移除前缀并转换为配置键
          const configKey = this._keyToConfigKey(key);
          
          // 解析值
          const parsedValue = this.parser(value);
          
          // 设置配置
          config[configKey] = parsedValue;
        } catch (err) {
          logger.error(`解析Etcd配置失败: ${key}, ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`获取Etcd配置失败: ${err.message}`);
    }
    
    return config;
  }
  
  /**
   * 将Etcd键转换为配置键
   * 
   * @private
   * @param {string} key - Etcd键
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
    // 尝试解析为JSON
    try {
      return JSON.parse(value);
    } catch (err) {
      // 如果不是有效的JSON，则作为原始值返回
      return value;
    }
  }
}

module.exports = EtcdProvider; 