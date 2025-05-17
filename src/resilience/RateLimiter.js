/**
 * 限流器类
 * 提供基于令牌桶和固定窗口等算法的限流功能
 * 
 * @module resilience/RateLimiter
 */

const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const logger = require('../logging').logger;

/**
 * 限流算法类型
 */
const RATE_LIMITER_TYPES = {
  TOKEN_BUCKET: 'token_bucket',
  FIXED_WINDOW: 'fixed_window'
};

/**
 * 存储类型
 */
const STORAGE_TYPES = {
  MEMORY: 'memory',
  REDIS: 'redis'
};

/**
 * 限流器类
 */
class RateLimiter {
  /**
   * 创建限流器实例
   * 
   * @param {Object} options - 限流器配置
   * @param {string} options.type - 限流算法类型：token_bucket, fixed_window
   * @param {string} options.storage - 存储类型：memory, redis
   * @param {string} options.keyPrefix - 键前缀，用于区分不同的限流资源
   * @param {number} options.points - 令牌桶容量或窗口内最大请求数
   * @param {number} options.duration - 窗口时间或令牌填充周期（秒）
   * @param {number} options.blockDuration - 达到限制后阻塞时间（秒）
   * @param {Object} options.redis - Redis配置（当storage为redis时使用）
   */
  constructor(options = {}) {
    this.options = {
      type: options.type || process.env.RATE_LIMITER_TYPE || RATE_LIMITER_TYPES.TOKEN_BUCKET,
      storage: options.storage || process.env.RATE_LIMITER_STORAGE || STORAGE_TYPES.MEMORY,
      keyPrefix: options.keyPrefix || 'rate_limiter',
      points: options.points || parseInt(process.env.RATE_LIMITER_POINTS, 10) || 60,
      duration: options.duration || parseInt(process.env.RATE_LIMITER_DURATION, 10) || 60,
      blockDuration: options.blockDuration || parseInt(process.env.RATE_LIMITER_BLOCK_DURATION, 10) || 0
    };
    
    this.redisInstance = null;
    this.limiter = this._createLimiter();
    
    logger.info(`已创建${this.options.type}类型限流器: ${this.options.keyPrefix}，限制为${this.options.points}/${this.options.duration}秒`);
  }
  
  /**
   * 消耗指定数量的令牌
   * 
   * @async
   * @param {string} key - 限流标识键
   * @param {number} points - 消耗的令牌数，默认为1
   * @returns {Promise<Object>} 消耗结果，包含剩余令牌数和是否被限流
   * @throws {Error} 如果已达到限流阈值，抛出错误
   */
  async consume(key, points = 1) {
    try {
      const consumeKey = `${this.options.keyPrefix}:${key}`;
      const result = await this.limiter.consume(consumeKey, points);
      
      return {
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        consumedPoints: result.consumedPoints,
        isBlocked: false,
        key: consumeKey
      };
    } catch (err) {
      if (err instanceof Error && err.remainingPoints !== undefined) {
        // 这是一个RateLimiterRes实例，表示已达到限流阈值
        logger.warn(`请求被限流: ${key}，请在${err.msBeforeNext}ms后重试`);
        
        const error = new Error(`请求频率超出限制，请在${Math.ceil(err.msBeforeNext / 1000)}秒后重试`);
        error.statusCode = 429; // Too Many Requests
        error.remainingPoints = err.remainingPoints;
        error.msBeforeNext = err.msBeforeNext;
        error.isBlocked = true;
        error.key = `${this.options.keyPrefix}:${key}`;
        
        throw error;
      }
      
      // 其他错误
      logger.error(`限流器错误: ${err.message}`, { stack: err.stack });
      throw err;
    }
  }
  
  /**
   * 检查是否达到限流阈值，但不消耗令牌
   * 
   * @async
   * @param {string} key - 限流标识键
   * @param {number} points - 检查的令牌数，默认为1
   * @returns {Promise<Object>} 检查结果，包含剩余令牌数和是否被限流
   */
  async get(key) {
    try {
      const consumeKey = `${this.options.keyPrefix}:${key}`;
      const result = await this.limiter.get(consumeKey);
      
      if (result !== null) {
        return {
          remainingPoints: result.remainingPoints,
          msBeforeNext: result.msBeforeNext,
          consumedPoints: result.consumedPoints,
          isBlocked: false,
          key: consumeKey
        };
      }
      
      // 键不存在，表示未被限流
      return {
        remainingPoints: this.options.points,
        msBeforeNext: 0,
        consumedPoints: 0,
        isBlocked: false,
        key: consumeKey
      };
    } catch (err) {
      logger.error(`限流器检查错误: ${err.message}`, { stack: err.stack });
      throw err;
    }
  }
  
  /**
   * 重置指定键的限流计数
   * 
   * @async
   * @param {string} key - 限流标识键
   * @returns {Promise<boolean>} 是否重置成功
   */
  async reset(key) {
    try {
      const consumeKey = `${this.options.keyPrefix}:${key}`;
      await this.limiter.delete(consumeKey);
      return true;
    } catch (err) {
      logger.error(`重置限流器错误: ${err.message}`, { stack: err.stack });
      return false;
    }
  }
  
  /**
   * 阻塞指定键一段时间
   * 
   * @async
   * @param {string} key - 限流标识键
   * @param {number} duration - 阻塞时间（秒）
   * @returns {Promise<boolean>} 是否阻塞成功
   */
  async block(key, duration) {
    try {
      const consumeKey = `${this.options.keyPrefix}:${key}`;
      const blockDuration = duration || this.options.blockDuration;
      
      if (blockDuration <= 0) {
        return false;
      }
      
      await this.limiter.block(consumeKey, blockDuration);
      logger.info(`已阻塞请求: ${key}，持续${blockDuration}秒`);
      return true;
    } catch (err) {
      logger.error(`阻塞请求错误: ${err.message}`, { stack: err.stack });
      return false;
    }
  }
  
  /**
   * 创建适当类型的限流器
   * 
   * @private
   * @returns {Object} 限流器实例
   */
  _createLimiter() {
    const limiterOptions = {
      keyPrefix: this.options.keyPrefix,
      points: this.options.points,
      duration: this.options.duration,
      blockDuration: this.options.blockDuration
    };
    
    // 根据存储类型创建不同的限流器
    if (this.options.storage === STORAGE_TYPES.REDIS) {
      this.redisInstance = this._createRedisClient();
      return new RateLimiterRedis({
        ...limiterOptions,
        storeClient: this.redisInstance,
        inmemoryBlockOnConsumed: this.options.points,
        inmemoryBlockDuration: this.options.blockDuration
      });
    } else {
      return new RateLimiterMemory(limiterOptions);
    }
  }
  
  /**
   * 创建Redis客户端
   * 
   * @private
   * @returns {Redis} Redis客户端实例
   */
  _createRedisClient() {
    const redisOptions = this.options.redis || {};
    
    const config = {
      host: redisOptions.host || process.env.REDIS_HOST || 'localhost',
      port: redisOptions.port || process.env.REDIS_PORT || 6379,
      password: redisOptions.password || process.env.REDIS_PASSWORD,
      db: redisOptions.db || process.env.REDIS_DB || 0,
      enableAutoPipelining: true
    };
    
    return new Redis(config);
  }
}

// 导出限流器类型和存储类型常量
RateLimiter.TYPES = RATE_LIMITER_TYPES;
RateLimiter.STORAGE = STORAGE_TYPES;

module.exports = RateLimiter; 