/**
 * 内存缓存类
 * 提供基于内存的缓存实现
 * 
 * @module cache/MemoryCache
 */

const logger = require('../logging').logger;

/**
 * 内存缓存类
 */
class MemoryCache {
  /**
   * 创建内存缓存实例
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.maxSize - 最大缓存项数，默认为1000
   * @param {number} options.defaultTTL - 默认过期时间（毫秒），默认为60000（1分钟）
   * @param {boolean} options.checkPeriod - 定期检查过期项的间隔（毫秒），默认为60000（1分钟）
   */
  constructor(options = {}) {
    // 缓存存储对象
    this.cache = new Map();
    
    // 最大缓存项数
    this.maxSize = options.maxSize || parseInt(process.env.MEMORY_CACHE_MAX_SIZE, 10) || 1000;
    
    // 默认TTL（毫秒）
    this.defaultTTL = options.defaultTTL || parseInt(process.env.MEMORY_CACHE_DEFAULT_TTL, 10) || 60000;
    
    // 定期清理间隔（毫秒）
    this.checkPeriod = options.checkPeriod || parseInt(process.env.MEMORY_CACHE_CHECK_PERIOD, 10) || 60000;
    
    // 指标统计
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    // 启动定期清理
    if (this.checkPeriod > 0) {
      this.cleanupInterval = setInterval(() => {
        this._cleanup();
      }, this.checkPeriod);
    }
    
    logger.info(`内存缓存已创建: maxSize=${this.maxSize}, defaultTTL=${this.defaultTTL}ms`);
  }
  
  /**
   * 获取缓存项
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存值或null
   */
  async get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // 检查是否过期
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return item.value;
  }
  
  /**
   * 设置缓存项
   * 
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @param {number} options.ttl - 过期时间（毫秒）
   * @returns {Promise<boolean>} 是否设置成功
   */
  async set(key, value, options = {}) {
    // 计算过期时间
    const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL;
    const expires = ttl > 0 ? Date.now() + ttl : null;
    
    // 设置缓存项
    this.cache.set(key, {
      value,
      expires,
      created: Date.now()
    });
    
    // 如果超过最大大小，删除最旧的项
    if (this.maxSize > 0 && this.cache.size > this.maxSize) {
      this._evictOldest();
    }
    
    this.stats.sets++;
    return true;
  }
  
  /**
   * 删除缓存项
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async del(key) {
    const result = this.cache.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }
  
  /**
   * 检查缓存项是否存在
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否存在
   */
  async has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // 检查是否过期
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 清空所有缓存
   * 
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear() {
    this.cache.clear();
    return true;
  }
  
  /**
   * 获取所有缓存键
   * 
   * @returns {Promise<Array<string>>} 缓存键数组
   */
  async keys() {
    // 清理过期项
    this._cleanup();
    
    // 返回所有键
    return [...this.cache.keys()];
  }
  
  /**
   * 获取缓存项数量
   * 
   * @returns {Promise<number>} 缓存项数量
   */
  async size() {
    // 清理过期项
    this._cleanup();
    
    return this.cache.size;
  }
  
  /**
   * 获取缓存统计信息
   * 
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0 ? 
        this.stats.hits / (this.stats.hits + this.stats.misses) : 0
    };
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }
  
  /**
   * 清理过期项
   * 
   * @private
   */
  _cleanup() {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expires && item.expires < now) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * 驱逐最旧的缓存项
   * 
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    // 查找最旧的项
    for (const [key, item] of this.cache.entries()) {
      if (item.created < oldestTime) {
        oldestKey = key;
        oldestTime = item.created;
      }
    }
    
    // 删除最旧的项
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * 关闭缓存
   */
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = MemoryCache; 