/**
 * 缓存工厂类
 * 创建不同类型的缓存实例
 * 
 * @module cache/CacheFactory
 */

const MemoryCache = require('./MemoryCache');
const RedisCache = require('./RedisCache');
const logger = require('../logging').logger;

/**
 * 缓存类型枚举
 */
const CACHE_TYPES = {
  MEMORY: 'memory',
  REDIS: 'redis',
  NONE: 'none'
};

/**
 * 缓存工厂类
 */
class CacheFactory {
  /**
   * 创建缓存实例
   * 
   * @static
   * @param {Object} options - 配置选项
   * @param {string} options.type - 缓存类型，可选值：memory, redis, none
   * @returns {Object} 缓存实例
   */
  static create(options = {}) {
    // 默认使用内存缓存
    const type = (options.type || process.env.CACHE_TYPE || CACHE_TYPES.MEMORY).toLowerCase();
    
    switch (type) {
      case CACHE_TYPES.MEMORY:
        return new MemoryCache(options);
      case CACHE_TYPES.REDIS:
        return new RedisCache(options);
      case CACHE_TYPES.NONE:
        return CacheFactory.createNoneCache();
      default:
        logger.warn(`未知的缓存类型: ${type}，将使用内存缓存`);
        return new MemoryCache(options);
    }
  }
  
  /**
   * 创建空缓存实例
   * 
   * @static
   * @returns {Object} 空缓存实例
   */
  static createNoneCache() {
    return {
      get: async () => null,
      set: async () => true,
      del: async () => true,
      has: async () => false,
      clear: async () => true,
      keys: async () => [],
      size: async () => 0
    };
  }
}

module.exports = CacheFactory; 