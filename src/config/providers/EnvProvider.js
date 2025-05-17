/**
 * 环境变量配置提供者
 * 从环境变量中加载配置
 * 
 * @module config/providers/EnvProvider
 */

const EventEmitter = require('events');

/**
 * 环境变量配置提供者类
 */
class EnvProvider extends EventEmitter {
  /**
   * 创建环境变量配置提供者实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.prefix - 环境变量前缀，只加载指定前缀的环境变量
   * @param {Function} options.transform - 转换函数，用于转换环境变量键名
   * @param {boolean} options.lowercase - 是否将键名转为小写
   */
  constructor(options = {}) {
    super();
    this.prefix = options.prefix || '';
    this.transform = options.transform || this._defaultTransform;
    this.lowercase = options.lowercase !== false;
  }
  
  /**
   * 加载配置
   * 
   * @returns {Promise<Object>} 加载的配置对象
   */
  async load() {
    const config = {};
    
    // 遍历环境变量
    Object.keys(process.env).forEach(key => {
      // 检查前缀
      if (this.prefix && !key.startsWith(this.prefix)) {
        return;
      }
      
      // 转换键名
      const configKey = this.transform(key);
      
      // 转换值
      let value = process.env[key];
      
      // 尝试自动判断类型
      if (value.toLowerCase() === 'true') {
        value = true;
      } else if (value.toLowerCase() === 'false') {
        value = false;
      } else if (value.toLowerCase() === 'null') {
        value = null;
      } else if (value.toLowerCase() === 'undefined') {
        value = undefined;
      } else if (!isNaN(value) && value.trim() !== '') {
        // 尝试转换为数字，但保留以0开头的字符串
        if (!/^0\d+/.test(value)) {
          value = Number(value);
        }
      }
      
      config[configKey] = value;
    });
    
    return config;
  }
  
  /**
   * 默认的键名转换函数
   * 
   * @private
   * @param {string} key - 环境变量键名
   * @returns {string} 转换后的键名
   */
  _defaultTransform(key) {
    // 移除前缀
    let configKey = key;
    if (this.prefix && configKey.startsWith(this.prefix)) {
      configKey = configKey.substring(this.prefix.length);
      
      // 如果前缀后跟着下划线或连字符，也一并移除
      if (configKey.startsWith('_') || configKey.startsWith('-')) {
        configKey = configKey.substring(1);
      }
    }
    
    // 转换为小写（如果配置了）
    if (this.lowercase) {
      configKey = configKey.toLowerCase();
    }
    
    // 将下划线或连字符转换为点号，用于支持嵌套配置
    configKey = configKey.replace(/[_-]+/g, '.');
    
    return configKey;
  }
  
  /**
   * 检查该提供者是否包含指定配置
   * 
   * @param {string} key - 配置键名
   * @returns {boolean} 是否包含
   */
  has(key) {
    // 反向查找环境变量
    for (const envKey of Object.keys(process.env)) {
      if (this.transform(envKey) === key) {
        return true;
      }
    }
    
    return false;
  }
}

module.exports = EnvProvider; 