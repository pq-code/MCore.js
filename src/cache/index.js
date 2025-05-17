/**
 * 缓存模块
 * 提供各种缓存策略和管理功能
 * 
 * @module cache
 */

const CacheManager = require('./CacheManager');
const MemoryCache = require('./MemoryCache');
const RedisCache = require('./RedisCache');
const CacheFactory = require('./CacheFactory');

/**
 * 创建缓存管理器
 * 
 * @param {Object} options - 配置选项
 * @returns {CacheManager} 缓存管理器实例
 */
function createCacheManager(options = {}) {
  return new CacheManager(options);
}

/**
 * 创建缓存实例
 * 
 * @param {Object} options - 配置选项
 * @returns {Object} 缓存实例
 */
function createCache(options = {}) {
  return CacheFactory.create(options);
}

module.exports = {
  createCacheManager,
  createCache,
  CacheManager,
  MemoryCache,
  RedisCache
}; 