/**
 * 审计模块
 * 提供操作日志记录和用户行为跟踪功能
 * 
 * @module audit
 */

const AuditLogger = require('./AuditLogger');
const AuditMiddleware = require('./AuditMiddleware');
const AuditService = require('./AuditService');

/**
 * 创建审计日志记录器
 * 
 * @param {Object} options - 配置选项
 * @returns {AuditLogger} 审计日志记录器实例
 */
function createLogger(options = {}) {
  return new AuditLogger(options);
}

/**
 * 创建审计中间件
 * 
 * @param {Object} options - 配置选项
 * @returns {Function} Koa中间件函数
 */
function createMiddleware(options = {}) {
  return AuditMiddleware.create(options);
}

/**
 * 创建审计服务
 * 
 * @param {Object} options - 配置选项
 * @returns {AuditService} 审计服务实例
 */
function createService(options = {}) {
  return new AuditService(options);
}

module.exports = {
  createLogger,
  createMiddleware,
  createService,
  AuditLogger,
  AuditMiddleware,
  AuditService
}; 