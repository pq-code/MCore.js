/**
 * 安全模块 - 提供全面的安全防护功能
 * 
 * 设计理念:
 * 1. 渐进式采用: 可以单独使用任一安全功能，无需引入整个安全模块
 * 2. 原生兼容: 提供与流行安全库兼容的接口
 * 3. 低学习成本: 简单直观的API设计
 * 4. 松耦合: 各功能模块互不依赖，可单独使用
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

// 核心工具函数
const utils = {
  /**
   * 创建安全密钥
   * 
   * @param {number} length - 密钥长度，默认为32
   * @returns {string} 生成的安全密钥
   */
  generateSecretKey: (length = 32) => {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  },
  
  /**
   * 创建安全随机ID
   * 
   * @param {number} length - ID长度，默认为16
   * @returns {string} 生成的ID
   */
  generateRandomId: (length = 16) => {
    const crypto = require('crypto');
    return crypto.randomBytes(Math.ceil(length/2)).toString('hex').slice(0, length);
  }
};

// 中间件工厂函数 - 提供通用的中间件创建方式
const middleware = {
  // 根据常用Web框架提供特定适配
  express: {
    // Express专用中间件
    csrf: (options) => csrf.createCSRFMiddleware(options).express,
    xss: (options) => xss.middleware.express(options),
    cors: (options) => cors.createCorsMiddleware(options),
    rateLimit: (options) => rateLimit.createRateLimitMiddleware(options),
    helmet: (options) => helmet.createHelmetMiddleware(options),
    authorization: (provider, options) => authorization.createAuthorizationGuard(provider, options).createMiddleware().express
  },
  
  koa: {
    // Koa专用中间件
    csrf: (options) => csrf.createCSRFMiddleware(options).koa,
    xss: (options) => xss.middleware.koa(options),
    cors: (options) => cors.createCorsMiddleware(options),
    rateLimit: (options) => rateLimit.createRateLimitMiddleware(options),
    helmet: (options) => helmet.createHelmetMiddleware(options),
    authorization: (provider, options) => authorization.createAuthorizationGuard(provider, options).createMiddleware().koa
  },
  
  // 框架无关的中间件创建函数
  csrf: (options) => csrf.createCSRFMiddleware(options),
  xss: (options) => xss.middleware,
  cors: (options) => cors.createCorsMiddleware(options),
  rateLimit: (options) => rateLimit.createRateLimitMiddleware(options),
  helmet: (options) => helmet.createHelmetMiddleware(options)
};

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
  sanitizer,
  
  // 实用工具函数
  utils,
  
  // 预配置的中间件
  middleware,
  
  // 向后兼容的函数
  generateSecretKey: utils.generateSecretKey
}; 

// 提供快捷访问路径，方便直接解构使用
module.exports.createCorsMiddleware = cors.createCorsMiddleware;
module.exports.createRateLimitMiddleware = rateLimit.createRateLimitMiddleware;
module.exports.createHelmetMiddleware = helmet.createHelmetMiddleware; 