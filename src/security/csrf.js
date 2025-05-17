/**
 * CSRF防护模块
 * 提供CSRF令牌生成和验证功能
 * 
 * @module security/csrf
 */

const crypto = require('crypto');
const logger = require('../logging').logger;

/**
 * CSRF令牌生成器类
 */
class CSRFTokenManager {
  /**
   * 创建CSRF令牌管理器
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.secret - 用于签名的密钥，建议从环境变量读取
   * @param {string} options.cookieName - CSRF Cookie名称
   * @param {string} options.headerName - 请求头名称
   * @param {number} options.ttl - 令牌有效期（秒）
   */
  constructor(options = {}) {
    this.secret = options.secret || process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
    this.cookieName = options.cookieName || 'csrf_token';
    this.headerName = options.headerName || 'x-csrf-token';
    this.ttl = options.ttl || 3600; // 默认1小时
    this.ignoreMethods = ['GET', 'HEAD', 'OPTIONS'];
    this.ignorePaths = [];
  }
  
  /**
   * 生成CSRF令牌
   * 
   * @param {string} [sessionId] - 会话ID，如果不提供则自动生成
   * @returns {string} CSRF令牌
   */
  generateToken(sessionId = '') {
    try {
      // 如果没有提供会话ID，生成一个随机ID
      const sid = sessionId || crypto.randomBytes(16).toString('hex');
      
      // 创建令牌内容
      const timestamp = Date.now();
      const payload = `${sid}:${timestamp}`;
      
      // 生成哈希
      const hmac = crypto.createHmac('sha256', this.secret);
      hmac.update(payload);
      const hash = hmac.digest('hex');
      
      // 构造令牌
      return `${payload}:${hash}`;
    } catch (error) {
      logger.error(`生成CSRF令牌失败: ${error.message}`, { stack: error.stack });
      throw new Error(`生成CSRF令牌失败: ${error.message}`);
    }
  }
  
  /**
   * 验证CSRF令牌
   * 
   * @param {string} token - CSRF令牌
   * @param {string} [sessionId] - 会话ID
   * @returns {boolean} 验证结果
   */
  verifyToken(token, sessionId = '') {
    try {
      // 解析令牌
      const parts = token.split(':');
      if (parts.length !== 3) {
        return false;
      }
      
      const [tokenSid, timestampStr, hash] = parts;
      
      // 如果提供了会话ID，验证它与令牌中的会话ID是否匹配
      if (sessionId && tokenSid !== sessionId) {
        return false;
      }
      
      // 验证令牌是否过期
      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      if (isNaN(timestamp) || now - timestamp > this.ttl * 1000) {
        return false;
      }
      
      // 验证哈希
      const payload = `${tokenSid}:${timestampStr}`;
      const hmac = crypto.createHmac('sha256', this.secret);
      hmac.update(payload);
      const calculatedHash = hmac.digest('hex');
      
      return calculatedHash === hash;
    } catch (error) {
      logger.error(`验证CSRF令牌失败: ${error.message}`, { stack: error.stack });
      return false;
    }
  }
  
  /**
   * 设置忽略的HTTP方法
   * 
   * @param {Array<string>} methods - 忽略的HTTP方法列表
   * @returns {CSRFTokenManager} 当前实例，支持链式调用
   */
  setIgnoreMethods(methods) {
    if (Array.isArray(methods)) {
      this.ignoreMethods = methods.map(m => m.toUpperCase());
    }
    return this;
  }
  
  /**
   * 设置忽略的路径
   * 
   * @param {Array<string|RegExp>} paths - 忽略的路径列表
   * @returns {CSRFTokenManager} 当前实例，支持链式调用
   */
  setIgnorePaths(paths) {
    if (Array.isArray(paths)) {
      this.ignorePaths = paths;
    }
    return this;
  }
  
  /**
   * 检查请求是否应该被忽略CSRF验证
   * 
   * @param {Object} ctx - Koa上下文
   * @returns {boolean} 是否应该忽略
   */
  shouldIgnore(ctx) {
    // 忽略指定的HTTP方法
    if (this.ignoreMethods.includes(ctx.method.toUpperCase())) {
      return true;
    }
    
    // 忽略指定的路径
    const path = ctx.path;
    for (const pattern of this.ignorePaths) {
      if (pattern instanceof RegExp && pattern.test(path)) {
        return true;
      } else if (typeof pattern === 'string' && path.startsWith(pattern)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 创建Koa中间件
   * 
   * @param {Object} [options] - 中间件选项
   * @param {boolean} [options.includeHeader=true] - 是否在响应头中包含令牌
   * @param {boolean} [options.useCookies=true] - 是否使用Cookie传递令牌
   * @param {Object} [options.cookieOptions] - Cookie配置
   * @returns {Function} Koa中间件函数
   */
  koaMiddleware(options = {}) {
    const includeHeader = options.includeHeader !== false;
    const useCookies = options.useCookies !== false;
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      // 如果是HTTPS环境，设置secure为true
      secure: options.cookieOptions?.secure !== undefined 
        ? options.cookieOptions.secure 
        : process.env.NODE_ENV === 'production',
      ...options.cookieOptions
    };
    
    return async (ctx, next) => {
      // 从会话或Cookie中获取会话ID
      const sessionId = ctx.session?.id || '';
      
      // 生成新令牌
      const token = this.generateToken(sessionId);
      
      // 保存令牌到上下文，以便在应用中使用
      ctx.state.csrfToken = token;
      
      // 将令牌设置到Cookie
      if (useCookies) {
        ctx.cookies.set(this.cookieName, token, cookieOptions);
      }
      
      // 将令牌设置到响应头
      if (includeHeader) {
        ctx.set(this.headerName, token);
      }
      
      // 对于非GET请求，验证CSRF令牌
      if (!this.shouldIgnore(ctx)) {
        // 尝试从请求头、请求体或查询参数中获取令牌
        const requestToken = 
          ctx.headers[this.headerName.toLowerCase()] || 
          ctx.request.body?._csrf || 
          ctx.query?._csrf || 
          ctx.cookies.get(this.cookieName);
        
        // 如果没有令牌或令牌无效，则拒绝请求
        if (!requestToken || !this.verifyToken(requestToken, sessionId)) {
          ctx.status = 403;
          ctx.body = {
            code: 'CSRF_ERROR',
            message: 'CSRF验证失败'
          };
          return;
        }
      }
      
      // 继续处理请求
      await next();
    };
  }
  
  /**
   * 创建Express中间件
   * 
   * @param {Object} [options] - 中间件选项
   * @param {boolean} [options.includeHeader=true] - 是否在响应头中包含令牌
   * @param {boolean} [options.useCookies=true] - 是否使用Cookie传递令牌
   * @param {Object} [options.cookieOptions] - Cookie配置
   * @returns {Function} Express中间件函数
   */
  expressMiddleware(options = {}) {
    const includeHeader = options.includeHeader !== false;
    const useCookies = options.useCookies !== false;
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      // 如果是HTTPS环境，设置secure为true
      secure: options.cookieOptions?.secure !== undefined 
        ? options.cookieOptions.secure 
        : process.env.NODE_ENV === 'production',
      ...options.cookieOptions
    };
    
    return (req, res, next) => {
      // 从会话或Cookie中获取会话ID
      const sessionId = req.session?.id || '';
      
      // 生成新令牌
      const token = this.generateToken(sessionId);
      
      // 保存令牌到请求对象，以便在应用中使用
      req.csrfToken = token;
      
      // 将令牌设置到Cookie
      if (useCookies && res.cookie) {
        res.cookie(this.cookieName, token, cookieOptions);
      }
      
      // 将令牌设置到响应头
      if (includeHeader) {
        res.set(this.headerName, token);
      }
      
      // 对于非GET请求，验证CSRF令牌
      if (!this.shouldIgnoreExpress(req)) {
        // 尝试从请求头、请求体或查询参数中获取令牌
        const requestToken = 
          req.headers[this.headerName.toLowerCase()] || 
          req.body?._csrf || 
          req.query?._csrf || 
          req.cookies?.[this.cookieName];
        
        // 如果没有令牌或令牌无效，则拒绝请求
        if (!requestToken || !this.verifyToken(requestToken, sessionId)) {
          return res.status(403).json({
            code: 'CSRF_ERROR',
            message: 'CSRF验证失败'
          });
        }
      }
      
      // 继续处理请求
      next();
    };
  }
  
  /**
   * 检查Express请求是否应该被忽略CSRF验证
   * 
   * @param {Object} req - Express请求对象
   * @returns {boolean} 是否应该忽略
   */
  shouldIgnoreExpress(req) {
    // 忽略指定的HTTP方法
    if (this.ignoreMethods.includes(req.method.toUpperCase())) {
      return true;
    }
    
    // 忽略指定的路径
    const path = req.path;
    for (const pattern of this.ignorePaths) {
      if (pattern instanceof RegExp && pattern.test(path)) {
        return true;
      } else if (typeof pattern === 'string' && path.startsWith(pattern)) {
        return true;
      }
    }
    
    return false;
  }
}

/**
 * 创建CSRF令牌管理器
 * 
 * @param {Object} options - 配置选项
 * @returns {CSRFTokenManager} CSRF令牌管理器实例
 */
function createCSRFManager(options = {}) {
  return new CSRFTokenManager(options);
}

module.exports = {
  CSRFTokenManager,
  createCSRFManager
}; 