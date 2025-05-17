/**
 * 文件配置提供者
 * 从配置文件中加载配置
 * 
 * @module config/providers/FileProvider
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const logger = require('../../logging').logger;

/**
 * 文件配置提供者类
 */
class FileProvider extends EventEmitter {
  /**
   * 创建文件配置提供者实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.path - 配置文件路径
   * @param {string} options.format - 配置文件格式，支持json, js, yaml, yml
   * @param {boolean} options.watch - 是否监听文件变化
   * @param {Function} options.parser - 自定义解析函数
   */
  constructor(options = {}) {
    super();
    
    if (!options.path) {
      throw new Error('配置文件路径不能为空');
    }
    
    this.filePath = options.path;
    this.format = options.format || this._detectFormat(this.filePath);
    this.watching = options.watch !== false;
    this.parser = options.parser || this._getDefaultParser();
    this.watcher = null;
    this.cache = {};
  }
  
  /**
   * 加载配置
   * 
   * @returns {Promise<Object>} 加载的配置对象
   */
  async load() {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(this.filePath)) {
        logger.warn(`配置文件不存在: ${this.filePath}`);
        return {};
      }
      
      // 读取文件内容
      const content = await fs.promises.readFile(this.filePath, 'utf8');
      
      // 解析配置
      const config = await this.parser(content);
      
      // 更新缓存
      this.cache = config;
      
      return config;
    } catch (err) {
      logger.error(`加载配置文件失败: ${this.filePath}, ${err.message}`, {
        stack: err.stack
      });
      
      // 出错时返回空配置
      return {};
    }
  }
  
  /**
   * 开始监听配置文件变化
   * 
   * @returns {Promise<void>}
   */
  async watch() {
    if (!this.watching || this.watcher) {
      return;
    }
    
    try {
      // 确保文件存在
      if (!fs.existsSync(this.filePath)) {
        logger.warn(`配置文件不存在，无法监听: ${this.filePath}`);
        return;
      }
      
      // 开始监听
      this.watcher = fs.watch(this.filePath, async eventType => {
        if (eventType === 'change') {
          logger.info(`配置文件已变更: ${this.filePath}`);
          
          try {
            const oldCache = { ...this.cache };
            const newConfig = await this.load();
            
            // 对比新旧配置，触发变更事件
            this._emitChangeEvents(oldCache, newConfig);
          } catch (err) {
            logger.error(`处理配置文件变更失败: ${err.message}`, {
              stack: err.stack
            });
          }
        }
      });
      
      logger.info(`已开始监听配置文件: ${this.filePath}`);
    } catch (err) {
      logger.error(`监听配置文件失败: ${this.filePath}, ${err.message}`, {
        stack: err.stack
      });
    }
  }
  
  /**
   * 停止监听配置文件变化
   * 
   * @returns {void}
   */
  unwatch() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info(`已停止监听配置文件: ${this.filePath}`);
    }
  }
  
  /**
   * 检查该提供者是否包含指定配置
   * 
   * @param {string} key - 配置键名
   * @returns {boolean} 是否包含
   */
  has(key) {
    // 支持嵌套键名，如 'database.host'
    const keys = key.split('.');
    let current = this.cache;
    
    for (const k of keys) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return false;
      }
      
      current = current[k];
    }
    
    return current !== undefined;
  }
  
  /**
   * 根据文件路径检测配置文件格式
   * 
   * @private
   * @param {string} filePath - 文件路径
   * @returns {string} 文件格式
   */
  _detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
    case '.json':
      return 'json';
    case '.js':
      return 'js';
    case '.yaml':
    case '.yml':
      return 'yaml';
    default:
      return 'json'; // 默认使用JSON格式
    }
  }
  
  /**
   * 获取默认的解析器
   * 
   * @private
   * @returns {Function} 解析函数
   */
  _getDefaultParser() {
    switch (this.format) {
    case 'json':
      return content => JSON.parse(content);
        
    case 'js':
      return content => {
        // 使用临时文件路径
        const tmpFile = path.join(
          path.dirname(this.filePath),
          `._tmp_${path.basename(this.filePath)}_${Date.now()}`
        );
          
        // 写入临时文件
        fs.writeFileSync(tmpFile, content);
          
        try {
          // 清除缓存
          if (require.cache[tmpFile]) {
            delete require.cache[tmpFile];
          }
            
          // 加载配置
          const config = require(tmpFile);
            
          // 删除临时文件
          fs.unlinkSync(tmpFile);
            
          return config;
        } catch (err) {
          // 删除临时文件
          if (fs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
          }
            
          throw err;
        }
      };
        
    case 'yaml':
    case 'yml':
      try {
        const yaml = require('js-yaml');
        return content => yaml.load(content);
      } catch (err) {
        logger.error('js-yaml 模块未安装，无法解析YAML文件');
        return () => ({});
      }
        
    default:
      return content => JSON.parse(content);
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
    this._compareObjects(oldCache, newCache, '');
  }
  
  /**
   * 比较两个对象的差异并触发变更事件
   * 
   * @private
   * @param {Object} oldObj - 旧对象
   * @param {Object} newObj - 新对象
   * @param {string} prefix - 键名前缀
   */
  _compareObjects(oldObj, newObj, prefix) {
    // 获取所有唯一键
    const allKeys = new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ]);
    
    // 检查每个键的变化
    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const oldValue = oldObj?.[key];
      const newValue = newObj?.[key];
      
      // 如果两边都是对象，递归比较
      if (
        oldValue && newValue &&
        typeof oldValue === 'object' && typeof newValue === 'object' &&
        !Array.isArray(oldValue) && !Array.isArray(newValue)
      ) {
        this._compareObjects(oldValue, newValue, fullKey);
      }
      // 否则直接比较值
      else if (oldValue !== newValue) {
        this.emit('change', fullKey, newValue, oldValue);
      }
    }
  }
}

module.exports = FileProvider; 