/**
 * 安全模块 - 提供全面的安全防护功能
 * 
 * @module security
 */

const encryption = require('./encryption');
const hash = require('./hash');
const password = require('./password');
const csrf = require('./csrf');
const xss = require('./xss');
const cors = require('./cors');
const rateLimit = require('./rateLimit');
const helmet = require('./helmet');
const authorization = require('./authorization');
const sanitizer = require('./sanitizer');

// 导出模块
module.exports = {
  // 加密与解密
  encryption,
  
  // 哈希计算
  hash,
  
  // 密码处理
  password,
  
  // CSRF防护
  csrf,
  
  // XSS防护
  xss,
  
  // CORS配置
  cors,
  
  // 速率限制
  rateLimit,
  
  // HTTP安全头
  helmet,
  
  // 授权控制
  authorization,
  
  // 数据清理
  sanitizer
}; 