/**
 * 日志工具
 * 提供基本的日志记录功能
 */

/**
 * 日志级别
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * 简单日志记录器
 */
class SimpleLogger {
  constructor(options = {}) {
    this.level = options.level || LOG_LEVELS.INFO;
    this.levels = {
      [LOG_LEVELS.ERROR]: 0,
      [LOG_LEVELS.WARN]: 1,
      [LOG_LEVELS.INFO]: 2,
      [LOG_LEVELS.DEBUG]: 3
    };
  }

  /**
   * 检查给定级别是否应该记录
   * @param {string} level 日志级别
   * @returns {boolean} 是否应该记录
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * 格式化日志消息
   * @param {string} level 日志级别
   * @param {string} message 日志消息
   * @param {Object} [meta] 额外元数据
   * @returns {string} 格式化后的日志
   */
  formatLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  /**
   * 记录错误日志
   * @param {string} message 日志消息
   * @param {Object} [meta] 额外元数据
   */
  error(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatLog(LOG_LEVELS.ERROR, message, meta));
    }
  }

  /**
   * 记录警告日志
   * @param {string} message 日志消息
   * @param {Object} [meta] 额外元数据
   */
  warn(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatLog(LOG_LEVELS.WARN, message, meta));
    }
  }

  /**
   * 记录信息日志
   * @param {string} message 日志消息
   * @param {Object} [meta] 额外元数据
   */
  info(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(this.formatLog(LOG_LEVELS.INFO, message, meta));
    }
  }

  /**
   * 记录调试日志
   * @param {string} message 日志消息
   * @param {Object} [meta] 额外元数据
   */
  debug(message, meta = {}) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(this.formatLog(LOG_LEVELS.DEBUG, message, meta));
    }
  }
}

// 创建默认logger实例
const logger = new SimpleLogger();

module.exports = logger; 