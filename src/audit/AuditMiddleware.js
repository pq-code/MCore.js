/**
 * 审计中间件
 * 自动记录API访问和操作日志
 * 
 * @module audit/AuditMiddleware
 */

const AuditLogger = require('./AuditLogger');
const { AUDIT_EVENT_TYPES } = AuditLogger;
const logger = require('../logging').logger;

/**
 * 审计中间件类
 */
class AuditMiddleware {
  /**
   * 创建审计中间件
   * 
   * @static
   * @param {Object} options - 配置选项
   * @param {AuditLogger} options.logger - 审计日志记录器
   * @param {boolean} options.logAll - 是否记录所有请求
   * @param {Array<string>} options.excludePaths - 排除的路径
   * @param {Array<string>} options.includePaths - 包含的路径
   * @param {Function} options.getUserInfo - 获取用户信息的函数
   * @param {Object} options.sensitiveHeaders - 敏感请求头（不记录）
   * @param {boolean} options.maskSensitiveData - 是否掩码敏感数据
   * @returns {Function} Koa中间件函数
   */
  static create(options = {}) {
    // 创建审计日志记录器
    const auditLogger = options.logger || new AuditLogger(options);
    
    // 路径过滤
    const excludePaths = options.excludePaths || ['/api/v1/health', '/health', '/metrics', '/favicon.ico'];
    const includePaths = options.includePaths || [];
    
    // 敏感请求头
    const sensitiveHeaders = options.sensitiveHeaders || ['authorization', 'cookie', 'set-cookie', 'x-auth-token'];
    
    // 是否掩码敏感数据
    const maskSensitiveData = options.maskSensitiveData !== false;
    
    // 掩码敏感字段
    const sensitiveFields = options.sensitiveFields || ['password', 'token', 'secret', 'key', 'credit_card', 'ssn'];
    
    // 获取用户信息的函数
    const getUserInfo = options.getUserInfo || (ctx => {
      return {
        userId: ctx.state.user?.id,
        username: ctx.state.user?.username
      };
    });
    
    /**
     * 判断路径是否应该被审计
     * 
     * @param {string} path - 请求路径
     * @returns {boolean} 是否应该被审计
     */
    const shouldAudit = path => {
      // 如果路径在排除列表中，不记录
      if (excludePaths.some(p => path.startsWith(p))) {
        return false;
      }
      
      // 如果包含列表不为空，且路径不在包含列表中，不记录
      if (includePaths.length > 0 && !includePaths.some(p => path.startsWith(p))) {
        return false;
      }
      
      return options.logAll !== false;
    };
    
    /**
     * 掩码敏感数据
     * 
     * @param {Object} data - 数据对象
     * @returns {Object} 处理后的对象
     */
    const maskSensitive = data => {
      if (!data || typeof data !== 'object') {
        return data;
      }
      
      const result = Array.isArray(data) ? [] : {};
      
      for (const [key, value] of Object.entries(data)) {
        // 检查是否是敏感字段
        const isSensitive = sensitiveFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase()));
        
        if (isSensitive && typeof value === 'string') {
          // 掩码敏感字符串
          result[key] = '********';
        } else if (typeof value === 'object' && value !== null) {
          // 递归处理对象
          result[key] = maskSensitive(value);
        } else {
          // 其他值直接复制
          result[key] = value;
        }
      }
      
      return result;
    };
    
    /**
     * 过滤敏感请求头
     * 
     * @param {Object} headers - 请求头对象
     * @returns {Object} 过滤后的请求头
     */
    const filterSensitiveHeaders = headers => {
      const filtered = { ...headers };
      
      for (const header of sensitiveHeaders) {
        if (filtered[header]) {
          filtered[header] = '********';
        }
      }
      
      return filtered;
    };
    
    /**
     * Koa中间件函数
     */
    return async (ctx, next) => {
      // 检查路径是否应该被审计
      if (!shouldAudit(ctx.path)) {
        return await next();
      }
      
      // 记录请求开始时间
      const startTime = Date.now();
      
      try {
        // 继续处理请求
        await next();
        
        // 计算请求处理时间
        const duration = Date.now() - startTime;
        
        // 获取用户信息
        const { userId, username } = getUserInfo(ctx);
        
        // 构建请求信息
        const requestInfo = {
          path: ctx.path,
          method: ctx.method,
          query: ctx.query,
          headers: filterSensitiveHeaders(ctx.request.headers),
          body: maskSensitiveData ? maskSensitive(ctx.request.body) : ctx.request.body
        };
        
        // 构建响应信息
        const responseInfo = {
          status: ctx.status,
          duration,
          headers: filterSensitiveHeaders(ctx.response.headers)
        };
        
        // 记录审计日志
        auditLogger.logApiAccess({
          userId,
          username,
          resourceType: 'API',
          resourceId: ctx.path,
          details: {
            request: requestInfo,
            response: responseInfo
          },
          metadata: {
            ip: ctx.ip,
            userAgent: ctx.headers['user-agent'],
            requestId: ctx.state.requestId
          }
        });
      } catch (err) {
        // 计算请求处理时间
        const duration = Date.now() - startTime;
        
        // 获取用户信息
        const { userId, username } = getUserInfo(ctx);
        
        // 记录错误日志
        auditLogger.log({
          type: AUDIT_EVENT_TYPES.API_ERROR,
          action: 'API错误',
          userId,
          username,
          resourceType: 'API',
          resourceId: ctx.path,
          details: {
            request: {
              path: ctx.path,
              method: ctx.method,
              query: ctx.query,
              headers: filterSensitiveHeaders(ctx.request.headers),
              body: maskSensitiveData ? maskSensitive(ctx.request.body) : ctx.request.body
            },
            error: {
              message: err.message,
              stack: err.stack,
              status: err.status || 500,
              duration
            }
          },
          metadata: {
            ip: ctx.ip,
            userAgent: ctx.headers['user-agent'],
            requestId: ctx.state.requestId
          }
        });
        
        // 继续抛出错误，让错误处理中间件处理
        throw err;
      }
    };
  }
}

module.exports = AuditMiddleware; 