/**
 * 缓存管理器类
 * 管理多个缓存实例
 * 
 * @module cache/CacheManager
 */

const CacheFactory = require('./CacheFactory');
const logger = require('../logging').logger;

/**
 * 缓存管理器类
 */
class CacheManager {
  /**
   * 创建缓存管理器实例
   * 
   * @param {Object} options - 配置选项
   * @param {Object} options.caches - 缓存实例配置
   */
  constructor(options = {}) {
    // 缓存实例映射
    this.caches = new Map();
    
    // 默认缓存名称
    this.defaultCacheName = options.defaultCacheName || 'default';
    
    // 初始化配置的缓存
    if (options.caches && typeof options.caches === 'object') {
      for (const [name, config] of Object.entries(options.caches)) {
        this.createCache(name, config);
      }
    }
    
    // 如果没有默认缓存，创建一个
    if (!this.caches.has(this.defaultCacheName)) {
      this.createCache(this.defaultCacheName, {
        type: 'memory'
      });
    }
    
    logger.info(`缓存管理器已创建，已配置${this.caches.size}个缓存实例`);
  }
  
  /**
   * 创建缓存实例
   * 
   * @param {string} name - 缓存名称
   * @param {Object} options - 缓存配置
   * @returns {Object} 缓存实例
   */
  createCache(name, options = {}) {
    try {
      const cache = CacheFactory.create(options);
      this.caches.set(name, cache);
      logger.info(`已创建缓存实例: ${name} (${options.type || 'memory'})`);
      return cache;
    } catch (err) {
      logger.error(`创建缓存实例失败: ${err.message}`, {
        stack: err.stack,
        name,
        options
      });
      throw err;
    }
  }
  
  /**
   * 获取缓存实例
   * 
   * @param {string} name - 缓存名称，不提供则返回默认缓存
   * @returns {Object} 缓存实例
   */
  getCache(name) {
    const cacheName = name || this.defaultCacheName;
    
    // 获取缓存实例
    const cache = this.caches.get(cacheName);
    
    if (!cache) {
      logger.warn(`缓存实例不存在: ${cacheName}，将使用默认缓存`);
      return this.caches.get(this.defaultCacheName);
    }
    
    return cache;
  }
  
  /**
   * 删除缓存实例
   * 
   * @param {string} name - 缓存名称
   * @returns {boolean} 是否删除成功
   */
  removeCache(name) {
    if (name === this.defaultCacheName) {
      logger.warn('不能删除默认缓存实例');
      return false;
    }
    
    const cache = this.caches.get(name);
    
    if (!cache) {
      return false;
    }
    
    // 关闭缓存
    if (typeof cache.close === 'function') {
      cache.close();
    }
    
    this.caches.delete(name);
    logger.info(`已删除缓存实例: ${name}`);
    
    return true;
  }
  
  /**
   * 获取缓存项
   * 
   * @param {string} key - 缓存键
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<any>} 缓存值或null
   */
  async get(key, cacheName) {
    const cache = this.getCache(cacheName);
    return cache.get(key);
  }
  
  /**
   * 设置缓存项
   * 
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @param {number} options.ttl - 过期时间
   * @param {string} options.cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<boolean>} 是否设置成功
   */
  async set(key, value, options = {}) {
    const { cacheName, ...otherOptions } = options;
    const cache = this.getCache(cacheName);
    return cache.set(key, value, otherOptions);
  }
  
  /**
   * 删除缓存项
   * 
   * @param {string} key - 缓存键
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<boolean>} 是否删除成功
   */
  async del(key, cacheName) {
    const cache = this.getCache(cacheName);
    return cache.del(key);
  }
  
  /**
   * 检查缓存项是否存在
   * 
   * @param {string} key - 缓存键
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<boolean>} 是否存在
   */
  async has(key, cacheName) {
    const cache = this.getCache(cacheName);
    return cache.has(key);
  }
  
  /**
   * 清空缓存
   * 
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear(cacheName) {
    const cache = this.getCache(cacheName);
    return cache.clear();
  }
  
  /**
   * 获取缓存键
   * 
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<Array<string>>} 缓存键数组
   */
  async keys(cacheName) {
    const cache = this.getCache(cacheName);
    return cache.keys();
  }
  
  /**
   * 获取缓存大小
   * 
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Promise<number>} 缓存大小
   */
  async size(cacheName) {
    const cache = this.getCache(cacheName);
    return cache.size();
  }
  
  /**
   * 获取缓存统计信息
   * 
   * @param {string} cacheName - 缓存名称，不提供则使用默认缓存
   * @returns {Object} 统计信息
   */
  getStats(cacheName) {
    const cache = this.getCache(cacheName);
    return cache.getStats ? cache.getStats() : {};
  }
  
  /**
   * 获取所有缓存名称
   * 
   * @returns {Array<string>} 缓存名称数组
   */
  getCacheNames() {
    return [...this.caches.keys()];
  }
  
  /**
   * 关闭所有缓存
   */
  async close() {
    for (const [name, cache] of this.caches.entries()) {
      try {
        if (typeof cache.close === 'function') {
          await cache.close();
        }
        
        logger.info(`已关闭缓存实例: ${name}`);
      } catch (err) {
        logger.error(`关闭缓存实例出错: ${err.message}`, {
          stack: err.stack,
          name
        });
      }
    }
    
    this.caches.clear();
    logger.info('缓存管理器已关闭');
  }
}

module.exports = CacheManager; 