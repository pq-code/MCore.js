/**
 * 安全头设置模块
 * 提供HTTP安全头配置和中间件，防止常见的Web漏洞
 */

const koaHelmet = require('koa-helmet');

/**
 * 创建安全头中间件
 * 
 * @param {Object} options - 安全头配置选项
 * @returns {Function} Koa中间件函数
 */
function createHelmetMiddleware(options = {}) {
  return koaHelmet(options);
}

/**
 * 默认安全头配置
 * 
 * @returns {Object} 默认安全头配置
 */
function getDefaultConfig() {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    xssFilter: true,
    hsts: {
      maxAge: 15552000, // 180天
      includeSubDomains: true
    },
    frameguard: {
      action: 'deny'
    },
    noSniff: true,
    referrerPolicy: {
      policy: 'same-origin'
    }
  };
}

/**
 * 验证并合并安全头配置
 * 
 * @param {Object} options - 用户提供的安全头配置
 * @returns {Object} 验证并合并后的配置
 */
function validateHelmetOptions(options) {
  if (!options) {
    return {
      enabled: false
    };
  }
  
  if (typeof options === 'boolean') {
    return {
      enabled: options
    };
  }
  
  return {
    enabled: options.enabled !== false,
    ...options
  };
}

module.exports = {
  createHelmetMiddleware,
  getDefaultConfig,
  validateHelmetOptions
}; 