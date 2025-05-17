/**
 * 日志系统模块
 * 提供统一的日志记录功能
 * 
 * @module logging
 */

const LoggerFactory = require('./LoggerFactory');
const { LOG_LEVELS } = require('../constants');

// 默认的日志工厂实例
const defaultFactory = new LoggerFactory();

// 默认日志记录器
const defaultLogger = defaultFactory.createLogger();

/**
 * 创建日志记录器工厂
 * 
 * @param {Object} options - 配置选项
 * @returns {LoggerFactory} 日志工厂实例
 */
function createLoggerFactory(options = {}) {
  return new LoggerFactory(options);
}

// 导出日志相关功能
module.exports = {
  // 类
  LoggerFactory,
  
  // 工厂方法
  createLoggerFactory,
  
  // 默认实例
  factory: defaultFactory,
  
  // 默认日志记录器
  logger: defaultLogger,
  
  // 日志级别
  LOG_LEVELS,
  
  // 代理默认日志记录器的方法
  error: (...args) => defaultLogger.error(...args),
  warn: (...args) => defaultLogger.warn(...args),
  info: (...args) => defaultLogger.info(...args),
  http: (...args) => defaultLogger.http(...args),
  verbose: (...args) => defaultLogger.verbose(...args),
  debug: (...args) => defaultLogger.debug(...args),
  silly: (...args) => defaultLogger.silly(...args)
}; 