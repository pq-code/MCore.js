/**
 * 工具函数模块
 * 导出所有通用工具函数
 * 
 * @module utils
 */

// 日志工具
const logger = require('./logger');

// 端口工具
const portUtil = require('./portUtil');

// 导出所有工具函数
module.exports = {
  logger,
  portUtil
}; 