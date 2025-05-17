/**
 * 日志工厂类
 * 负责创建和管理日志记录器
 * 
 * @class LoggerFactory
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const { LOG_LEVELS } = require('../constants');

class LoggerFactory {
  /**
   * 创建日志工厂实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.level - 日志级别
   * @param {string} options.format - 日志格式
   * @param {string} options.dir - 日志目录
   * @param {boolean} options.console - 是否输出到控制台
   */
  constructor(options = {}) {
    this.options = Object.assign({
      level: process.env.LOG_LEVEL || LOG_LEVELS.INFO,
      format: 'json',
      dir: process.env.LOG_DIR || 'logs',
      console: process.env.NODE_ENV !== 'production'
    }, options);
    
    // 确保日志目录存在
    this._ensureLogDir();
    
    // 创建日志格式
    this.formats = this._createFormats();
    
    // 创建传输通道
    this.transports = this._createTransports();
    
    // 缓存已创建的记录器
    this.loggers = new Map();
  }
  
  /**
   * 确保日志目录存在
   * 
   * @private
   */
  _ensureLogDir() {
    try {
      fs.mkdirSync(this.options.dir, { recursive: true });
    } catch (err) {
      // 忽略已存在的目录错误
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
  
  /**
   * 创建日志格式
   * 
   * @private
   * @returns {Object} 日志格式
   */
  _createFormats() {
    // 基础格式
    const baseFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true })
    );
    
    // JSON格式
    const jsonFormat = winston.format.combine(
      baseFormat,
      winston.format.json()
    );
    
    // 文本格式
    const textFormat = winston.format.combine(
      baseFormat,
      winston.format.printf(({ timestamp, level, message, service, ...rest }) => {
        const meta = Object.keys(rest).length > 0 ? `\n${JSON.stringify(rest, null, 2)}` : '';
        return `${timestamp} [${service || 'app'}] ${level.toUpperCase()}: ${message}${meta}`;
      })
    );
    
    // 带颜色的控制台格式
    const consoleFormat = winston.format.combine(
      baseFormat,
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, service, ...rest }) => {
        const meta = Object.keys(rest).length > 0 ? `\n${JSON.stringify(rest, null, 2)}` : '';
        return `${timestamp} [${service || 'app'}] ${level}: ${message}${meta}`;
      })
    );
    
    return { baseFormat, jsonFormat, textFormat, consoleFormat };
  }
  
  /**
   * 创建传输通道
   * 
   * @private
   * @returns {Array} 传输通道列表
   */
  _createTransports() {
    const transports = [];
    
    // 控制台输出
    if (this.options.console) {
      transports.push(
        new winston.transports.Console({
          level: this.options.level,
          format: this.formats.consoleFormat
        })
      );
    }
    
    // 文件输出
    const fileFormat = this.options.format === 'json' 
      ? this.formats.jsonFormat 
      : this.formats.textFormat;
    
    // 普通日志文件
    transports.push(
      new DailyRotateFile({
        level: this.options.level,
        dirname: this.options.dir,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat
      })
    );
    
    // 错误日志文件
    transports.push(
      new DailyRotateFile({
        level: 'error',
        dirname: this.options.dir,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat
      })
    );
    
    return transports;
  }
  
  /**
   * 创建日志记录器
   * 
   * @param {string} name - 记录器名称
   * @param {Object} options - 记录器选项
   * @returns {winston.Logger} 记录器实例
   */
  createLogger(name = 'default', options = {}) {
    // 检查缓存
    if (this.loggers.has(name)) {
      return this.loggers.get(name);
    }
    
    // 合并选项
    const loggerOptions = Object.assign({}, this.options, options);
    
    // 创建记录器
    const logger = winston.createLogger({
      level: loggerOptions.level,
      defaultMeta: { service: name },
      transports: this.transports.slice(),
      exitOnError: false
    });
    
    // 添加辅助方法
    logger.getTransports = () => logger.transports;
    logger.setLevel = level => {
      logger.level = level;
      logger.transports.forEach(t => {
        t.level = level;
      });
    };
    
    // 缓存记录器
    this.loggers.set(name, logger);
    
    return logger;
  }
  
  /**
   * 获取日志记录器
   * 
   * @param {string} name - 记录器名称
   * @returns {winston.Logger|undefined} 记录器实例
   */
  getLogger(name) {
    return this.loggers.get(name);
  }
  
  /**
   * 关闭所有日志记录器
   */
  close() {
    for (const logger of this.loggers.values()) {
      logger.close();
    }
    
    this.loggers.clear();
  }
  
  /**
   * 添加自定义传输通道
   * 
   * @param {winston.transport} transport - 传输通道
   */
  addTransport(transport) {
    this.transports.push(transport);
    
    // 更新所有已创建的记录器
    for (const logger of this.loggers.values()) {
      logger.add(transport);
    }
  }
  
  /**
   * 获取可用日志级别
   * 
   * @returns {Array<string>} 日志级别列表
   */
  getLevels() {
    return Object.values(LOG_LEVELS);
  }
}

module.exports = LoggerFactory; 