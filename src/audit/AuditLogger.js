/**
 * 审计日志记录器类
 * 记录用户操作和系统事件
 * 
 * @module audit/AuditLogger
 */

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const logger = require('../logging').logger;

/**
 * 审计事件类型枚举
 */
const AUDIT_EVENT_TYPES = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTER: 'USER_REGISTER',
  USER_PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_PROFILE_UPDATE: 'USER_PROFILE_UPDATE',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  
  RESOURCE_CREATE: 'RESOURCE_CREATE',
  RESOURCE_READ: 'RESOURCE_READ',
  RESOURCE_UPDATE: 'RESOURCE_UPDATE',
  RESOURCE_DELETE: 'RESOURCE_DELETE',
  
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_IMPORT: 'DATA_IMPORT',
  
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  PERMISSION_REVOKE: 'PERMISSION_REVOKE',
  
  SYSTEM_START: 'SYSTEM_START',
  SYSTEM_STOP: 'SYSTEM_STOP',
  
  API_ACCESS: 'API_ACCESS',
  API_ERROR: 'API_ERROR',
  
  CUSTOM: 'CUSTOM'
};

/**
 * 审计日志记录器类
 */
class AuditLogger {
  /**
   * 创建审计日志记录器
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.logDir - 日志目录
   * @param {string} options.filename - 日志文件名模式
   * @param {boolean} options.console - 是否输出到控制台
   * @param {string} options.level - 日志级别
   * @param {boolean} options.json - 是否以JSON格式记录
   * @param {string} options.serviceName - 服务名称
   */
  constructor(options = {}) {
    this.options = Object.assign({
      logDir: options.logDir || process.env.AUDIT_LOG_DIR || 'logs/audit',
      filename: options.filename || 'audit-%DATE%.log',
      console: options.console !== false,
      level: options.level || 'info',
      json: options.json !== false,
      serviceName: options.serviceName || process.env.SERVICE_NAME || 'microservice'
    }, options);
    
    // 确保日志目录存在
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
    
    // 配置日志格式
    const logFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      this.options.json ? format.json() : format.printf(info => {
        const { timestamp, level, message, ...meta } = info;
        return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      })
    );
    
    // 配置日志传输
    const logTransports = [];
    
    // 添加文件日志传输
    logTransports.push(new DailyRotateFile({
      dirname: this.options.logDir,
      filename: this.options.filename,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: this.options.level
    }));
    
    // 添加控制台日志传输
    if (this.options.console) {
      logTransports.push(new transports.Console({
        level: this.options.level
      }));
    }
    
    // 创建Winston日志记录器
    this.logger = createLogger({
      format: logFormat,
      transports: logTransports,
      exitOnError: false
    });
    
    logger.info(`审计日志记录器已创建: ${path.join(this.options.logDir, this.options.filename)}`);
  }
  
  /**
   * 记录审计事件
   * 
   * @param {Object} event - 审计事件
   * @param {string} event.type - 事件类型
   * @param {string} event.action - 操作行为
   * @param {string} event.userId - 用户ID
   * @param {string} event.username - 用户名
   * @param {string} event.resourceType - 资源类型
   * @param {string} event.resourceId - 资源ID
   * @param {Object} event.details - 详细信息
   * @param {Object} event.metadata - 元数据
   * @returns {boolean} 是否记录成功
   */
  log(event) {
    try {
      // 事件基本信息
      const auditEvent = {
        type: event.type || AUDIT_EVENT_TYPES.CUSTOM,
        action: event.action || 'unknown',
        timestamp: new Date().toISOString(),
        service: this.options.serviceName,
        
        // 用户信息
        userId: event.userId,
        username: event.username,
        
        // 资源信息
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        
        // 详细信息
        details: event.details || {},
        
        // 元数据
        metadata: event.metadata || {},
        
        // 环境信息
        environment: process.env.NODE_ENV || 'development'
      };
      
      // 记录审计日志
      this.logger.info(event.action || event.type, auditEvent);
      
      return true;
    } catch (err) {
      logger.error(`记录审计日志失败: ${err.message}`, {
        stack: err.stack,
        event
      });
      return false;
    }
  }
  
  /**
   * 记录用户登录事件
   * 
   * @param {Object} data - 事件数据
   * @returns {boolean} 是否记录成功
   */
  logLogin(data) {
    return this.log({
      type: AUDIT_EVENT_TYPES.USER_LOGIN,
      action: '用户登录',
      ...data
    });
  }
  
  /**
   * 记录用户登出事件
   * 
   * @param {Object} data - 事件数据
   * @returns {boolean} 是否记录成功
   */
  logLogout(data) {
    return this.log({
      type: AUDIT_EVENT_TYPES.USER_LOGOUT,
      action: '用户登出',
      ...data
    });
  }
  
  /**
   * 记录资源创建事件
   * 
   * @param {Object} data - 事件数据
   * @returns {boolean} 是否记录成功
   */
  logCreate(data) {
    return this.log({
      type: AUDIT_EVENT_TYPES.RESOURCE_CREATE,
      action: `创建${data.resourceType || '资源'}`,
      ...data
    });
  }
  
  /**
   * 记录资源更新事件
   * 
   * @param {Object} data - 事件数据
   * @returns {boolean} 是否记录成功
   */
  logUpdate(data) {
    return this.log({
      type: AUDIT_EVENT_TYPES.RESOURCE_UPDATE,
      action: `更新${data.resourceType || '资源'}`,
      ...data
    });
  }
  
  /**
   * 记录资源删除事件
   * 
   * @param {Object} data - 事件数据
   * @returns {boolean} 是否记录成功
   */
  logDelete(data) {
    return this.log({
      type: AUDIT_EVENT_TYPES.RESOURCE_DELETE,
      action: `删除${data.resourceType || '资源'}`,
      ...data
    });
  }
  
  /**
   * 记录API访问事件
   * 
   * @param {Object} data - 事件数据
   * @returns {boolean} 是否记录成功
   */
  logApiAccess(data) {
    return this.log({
      type: AUDIT_EVENT_TYPES.API_ACCESS,
      action: 'API访问',
      ...data
    });
  }
}

// 导出事件类型和类
module.exports = AuditLogger;
module.exports.AUDIT_EVENT_TYPES = AUDIT_EVENT_TYPES; 