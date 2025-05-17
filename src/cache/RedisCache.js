/**
 * Redis缓存类
 * 提供基于Redis的缓存实现
 * 
 * @module cache/RedisCache
 */

const Redis = require('ioredis');
const logger = require('../logging').logger;

/**
 * Redis缓存类
 */
class RedisCache {
  /**
   * 创建Redis缓存实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.host - Redis主机
   * @param {number} options.port - Redis端口
   * @param {string} options.password - Redis密码
   * @param {number} options.db - Redis数据库
   * @param {string} options.keyPrefix - 键前缀
   * @param {number} options.defaultTTL - 默认过期时间（秒）
   */
  constructor(options = {}) {
    // Redis配置
    this.config = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || process.env.REDIS_PORT || 6379,
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db || process.env.REDIS_DB || 0,
      keyPrefix: options.keyPrefix || process.env.REDIS_KEY_PREFIX || 'cache:'
    };
    
    // 默认TTL（秒）
    this.defaultTTL = options.defaultTTL || parseInt(process.env.REDIS_CACHE_DEFAULT_TTL, 10) || 60;
    
    // 指标统计
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    // 创建Redis客户端
    try {
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password || undefined,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: times => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        }
      });
      
      this.redis.on('connect', () => {
        logger.info(`Redis缓存已连接: ${this.config.host}:${this.config.port} db=${this.config.db}`);
      });
      
      this.redis.on('error', err => {
        logger.error(`Redis缓存错误: ${err.message}`, {
          stack: err.stack
        });
      });
    } catch (err) {
      logger.error(`创建Redis客户端失败: ${err.message}`, {
        stack: err.stack,
        config: {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db
        }
      });
      throw err;
    }
  }
  
  /**
   * 获取缓存项
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存值或null
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      // 尝试解析JSON
      try {
        const parsed = JSON.parse(value);
        this.stats.hits++;
        return parsed;
      } catch (e) {
        this.stats.hits++;
        return value;
      }
    } catch (err) {
      logger.error(`Redis获取缓存出错: ${err.message}`, {
        stack: err.stack,
        key
      });
      return null;
    }
  }
  
  /**
   * 设置缓存项
   * 
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {Object} options - 选项
   * @param {number} options.ttl - 过期时间（秒）
   * @returns {Promise<boolean>} 是否设置成功
   */
  async set(key, value, options = {}) {
    try {
      const ttl = options.ttl !== undefined ? options.ttl : this.defaultTTL;
      
      // 序列化值
      const serialized = typeof value === 'string' ? 
        value : 
        JSON.stringify(value);
      
      // 设置值
      if (ttl > 0) {
        await this.redis.set(key, serialized, 'EX', ttl);
      } else {
        await this.redis.set(key, serialized);
      }
      
      this.stats.sets++;
      return true;
    } catch (err) {
      logger.error(`Redis设置缓存出错: ${err.message}`, {
        stack: err.stack,
        key
      });
      return false;
    }
  }
  
  /**
   * 删除缓存项
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async del(key) {
    try {
      const result = await this.redis.del(key);
      
      if (result > 0) {
        this.stats.deletes++;
      }
      
      return result > 0;
    } catch (err) {
      logger.error(`Redis删除缓存出错: ${err.message}`, {
        stack: err.stack,
        key
      });
      return false;
    }
  }
  
  /**
   * 检查缓存项是否存在
   * 
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否存在
   */
  async has(key) {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (err) {
      logger.error(`Redis检查缓存存在出错: ${err.message}`, {
        stack: err.stack,
        key
      });
      return false;
    }
  }
  
  /**
   * 清空所有缓存
   * 
   * @returns {Promise<boolean>} 是否清空成功
   */
  async clear() {
    try {
      if (this.config.keyPrefix) {
        // 如果有前缀，只清除匹配前缀的键
        const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
        
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
        
        return true;
      } else {
        // 如果没有前缀，使用flushdb（谨慎使用）
        await this.redis.flushdb();
        return true;
      }
    } catch (err) {
      logger.error(`Redis清空缓存出错: ${err.message}`, {
        stack: err.stack
      });
      return false;
    }
  }
  
  /**
   * 获取所有缓存键
   * 
   * @returns {Promise<Array<string>>} 缓存键数组
   */
  async keys() {
    try {
      const keys = await this.redis.keys('*');
      
      // 如果有前缀，移除前缀
      if (this.config.keyPrefix) {
        return keys.map(key => key.replace(this.config.keyPrefix, ''));
      }
      
      return keys;
    } catch (err) {
      logger.error(`Redis获取所有键出错: ${err.message}`, {
        stack: err.stack
      });
      return [];
    }
  }
  
  /**
   * 获取缓存项数量
   * 
   * @returns {Promise<number>} 缓存项数量
   */
  async size() {
    try {
      if (this.config.keyPrefix) {
        const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
        return keys.length;
      } else {
        return await this.redis.dbsize();
      }
    } catch (err) {
      logger.error(`Redis获取大小出错: ${err.message}`, {
        stack: err.stack
      });
      return 0;
    }
  }
  
  /**
   * 获取缓存统计信息
   * 
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
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
   * 获取Redis信息
   * 
   * @returns {Promise<Object>} Redis信息
   */
  async getRedisInfo() {
    try {
      const info = await this.redis.info();
      return info;
    } catch (err) {
      logger.error(`获取Redis信息出错: ${err.message}`, {
        stack: err.stack
      });
      return null;
    }
  }
  
  /**
   * 关闭缓存
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

module.exports = RedisCache; 