/**
 * 中间件管理器
 * 提供中间件的统一配置、加载和管理
 */

const bodyParser = require('koa-bodyparser');
const { createErrorHandler } = require('../utils/errorHandler');

class MiddlewareManager {
  /**
   * 创建中间件管理器
   * @param {Object} app - 应用实例
   * @param {Object} options - 配置选项
   */
  constructor(app, options = {}) {
    this.app = app;
    this.logger = app.logger;
    this.config = {
      // 默认中间件配置
      errorHandler: {
        enabled: true,
        options: {
          showStack: process.env.NODE_ENV === 'development',
          includeRequestInfo: true
        }
      },
      requestLogger: {
        enabled: true,
        options: {
          level: 'info'
        }
      },
      bodyParser: {
        enabled: true,
        options: {
          enableTypes: ['json', 'form', 'text'],
          jsonLimit: '1mb',
          formLimit: '1mb'
        }
      },
      security: {
        enabled: true,
        options: {
          cors: true,
          helmet: true,
          xss: true
        }
      },
      // 合并用户配置
      ...options
    };
    
    // 中间件注册表
    this.registry = new Map();
    
    // 初始化内置中间件
    this._initializeBuiltinMiddlewares();
  }
  
  /**
   * 初始化内置中间件
   * @private
   */
  _initializeBuiltinMiddlewares() {
    // 注册错误处理中间件
    this.register('errorHandler', {
      factory: (options) => createErrorHandler(options),
      config: this.config.errorHandler
    });
    
    // 注册请求日志中间件
    this.register('requestLogger', {
      factory: (options) => async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        this.logger[options.level || 'info'](`${ctx.method} ${ctx.url} - ${ms}ms`);
      },
      config: this.config.requestLogger
    });
    
    // 注册请求体解析中间件
    this.register('bodyParser', {
      factory: (options) => bodyParser(options),
      config: this.config.bodyParser
    });
    
    // 注册安全中间件
    this.register('security', {
      factory: (options) => {
        const middlewares = [];
        
        if (options.cors) {
          middlewares.push(require('./security/cors')(options.cors));
        }
        
        if (options.helmet) {
          middlewares.push(require('./security/helmet')(options.helmet));
        }
        
        if (options.xss) {
          middlewares.push(require('./security/xss')(options.xss));
        }
        
        return middlewares;
      },
      config: this.config.security
    });
  }
  
  /**
   * 注册中间件
   * @param {string} name - 中间件名称
   * @param {Object} middleware - 中间件定义
   * @param {Function} middleware.factory - 中间件工厂函数
   * @param {Object} middleware.config - 中间件配置
   */
  register(name, middleware) {
    this.registry.set(name, middleware);
    return this;
  }
  
  /**
   * 获取中间件
   * @param {string} name - 中间件名称
   * @returns {Function|Function[]} 中间件函数或函数数组
   */
  get(name) {
    const middleware = this.registry.get(name);
    if (!middleware) {
      throw new Error(`中间件 ${name} 未注册`);
    }
    
    const { factory, config } = middleware;
    if (!config.enabled) {
      return null;
    }
    
    return factory(config.options);
  }
  
  /**
   * 应用所有启用的中间件
   */
  apply() {
    for (const [name, middleware] of this.registry) {
      if (middleware.config.enabled) {
        const result = this.get(name);
        if (Array.isArray(result)) {
          result.forEach(m => this.app.use(m));
        } else if (result) {
          this.app.use(result);
        }
        this.logger.debug(`已应用中间件: ${name}`);
      }
    }
  }
  
  /**
   * 配置中间件
   * @param {string} name - 中间件名称
   * @param {Object} config - 中间件配置
   */
  configure(name, config) {
    const middleware = this.registry.get(name);
    if (!middleware) {
      throw new Error(`中间件 ${name} 未注册`);
    }
    
    middleware.config = {
      ...middleware.config,
      ...config
    };
    
    return this;
  }
  
  /**
   * 启用中间件
   * @param {string} name - 中间件名称
   */
  enable(name) {
    this.configure(name, { enabled: true });
    return this;
  }
  
  /**
   * 禁用中间件
   * @param {string} name - 中间件名称
   */
  disable(name) {
    this.configure(name, { enabled: false });
    return this;
  }
}

module.exports = MiddlewareManager; 