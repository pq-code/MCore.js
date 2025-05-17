/**
 * 认证模块入口文件
 * 提供JWT处理和认证中间件
 */

const jwt = require('./jwt');
const authMiddleware = require('./authMiddleware');

module.exports = {
  jwt,
  authMiddleware
}; 