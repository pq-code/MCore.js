/**
 * 日志工具
 * 提供基本的日志记录功能
 */

const winston = require('winston');
const path = require('path');

// 创建日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 创建日志记录器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'debug' : 'info'),
  format: logFormat,
  defaultMeta: { service: process.env.SERVICE_NAME || 'app' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // 文件输出
    new winston.transports.File({
      filename: path.join(process.env.LOG_PATH || 'logs', 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(process.env.LOG_PATH || 'logs', 'combined.log')
    })
  ]
});

// 开发环境下添加调试日志
if (process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: 'debug'
  }));
  }

// 确保错误对象被正确序列化
logger.error = (message, meta = {}) => {
  if (meta.error instanceof Error) {
    meta.error = {
      message: meta.error.message,
      stack: meta.error.stack
    };
  }
  return logger.log('error', message, meta);
};

module.exports = logger; 