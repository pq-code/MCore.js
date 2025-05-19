/**
 * 基础服务类
 * 提供通用的服务功能
 */

class BaseService {
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.logger = ctx.app.logger;
    this.config = ctx.app.config;
  }
  
  /**
   * 获取分页参数
   * @param {Object} query - 查询参数
   * @param {Object} options - 分页选项
   * @returns {Object} 分页参数
   */
  getPagination(query, options = {}) {
    const {
      defaultPage = 1,
      defaultLimit = 10,
      maxLimit = 100
    } = options;
    
    const page = Math.max(1, parseInt(query.page) || defaultPage);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
    
    return {
      page,
      limit,
      skip: (page - 1) * limit
    };
  }
  
  /**
   * 创建分页响应
   * @param {Array} data - 数据列表
   * @param {number} total - 总数
   * @param {Object} pagination - 分页参数
   * @returns {Object} 分页响应
   */
  createPaginationResponse(data, total, pagination) {
    return {
      data,
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        pages: Math.ceil(total / pagination.limit)
      }
    };
  }
  
  /**
   * 记录操作日志
   * @param {string} action - 操作类型
   * @param {Object} data - 操作数据
   * @param {Object} options - 日志选项
   */
  async logAction(action, data, options = {}) {
    const {
      level = 'info',
      userId = this.ctx.state.user?.id,
      requestId = this.ctx.state.requestId
    } = options;
    
    const logData = {
      action,
      data,
      userId,
      requestId,
      timestamp: new Date(),
      ip: this.ctx.ip,
      userAgent: this.ctx.request.headers['user-agent']
    };
    
    this.logger[level](`[${action}]`, logData);
  }
  
  /**
   * 处理事务
   * @param {Function} callback - 事务回调函数
   * @returns {Promise} 事务结果
   */
  async transaction(callback) {
    const session = await this.app.services.database.startSession();
    session.startTransaction();
    
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * 缓存数据
   * @param {string} key - 缓存键
   * @param {Function} getter - 数据获取函数
   * @param {Object} options - 缓存选项
   * @returns {Promise} 缓存数据
   */
  async cache(key, getter, options = {}) {
    const {
      ttl = 3600,
      prefix = this.constructor.name
    } = options;
    
    const cacheKey = `${prefix}:${key}`;
    
    // 尝试从缓存获取
    const cached = await this.app.services.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 获取新数据
    const data = await getter();
    
    // 设置缓存
    await this.app.services.cache.set(
      cacheKey,
      JSON.stringify(data),
      ttl
    );
    
    return data;
  }
  
  /**
   * 清除缓存
   * @param {string} key - 缓存键
   * @param {Object} options - 缓存选项
   */
  async clearCache(key, options = {}) {
    const { prefix = this.constructor.name } = options;
    const cacheKey = `${prefix}:${key}`;
    await this.app.services.cache.del(cacheKey);
  }
}

module.exports = BaseService; 