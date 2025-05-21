/**
 * 基础应用类
 * 提供应用的核心功能和生命周期管理
 * 
 * @class BaseApp
 */

const Koa = require('koa');
const Router = require('@koa/router');
const path = require('path');
const fs = require('fs');
const { HOOK_NAMES } = require('../constants');
const hooks = require('../hooks');
const Logger = require('../logging/Logger');
const MiddlewareManager = require('../middlewares/MiddlewareManager');
const LifecycleManager = require('./LifecycleManager');

class BaseApp {
  /**
   * 创建应用实例
   * 
   * @param {Object} options - 应用配置选项
   * @param {string} options.name - 应用名称
   * @param {number} options.port - 应用端口
   */
  constructor(options = {}) {
    this.options = {
      name: options.name || 'mcore-app',
      port: options.port || 3000
    };
    
    // 核心组件
    this.app = new Koa();
    this.hooks = hooks.createHookManager();
    this.logger = new Logger(this.options.name);
    this.publicRouter = new Router();
    this.protectedRouter = new Router();
    
    // 应用配置
    this.config = {
      ...this.options,
      middleware: options.middleware || {},
      lifecycle: options.lifecycle || {}
    };
    
    // 初始化应用
    this._initialize();
  }
  
  /**
   * 初始化应用
   * 
   * @private
   */
  _initialize() {
    // 设置应用上下文
    this.app.context.appName = this.options.name;
    this.app.context.logger = this.logger;
    
    // 注册钩子
    this._registerHooks();
    
    // 初始化中间件管理器
    this.middlewareManager = new MiddlewareManager(this, this.config.middleware);
    
    // 初始化生命周期管理器
    this.lifecycleManager = new LifecycleManager(this, this.config.lifecycle);
    
    // 配置基础中间件
    this._configureMiddleware();

    console.log('BaseApp initialized',this.app);
  }
  
  /**
   * 注册应用钩子
   * 
   * @private
   */
  _registerHooks() {
    // 内置钩子
    const builtinHookNames = Object.values(HOOK_NAMES);
    builtinHookNames.forEach(hookName => {
      this.hooks.register(hookName);
    });
  }
  
  /**
   * 配置基础中间件
   * 
   * @private
   */
  _configureMiddleware() {
    // 应用所有启用的中间件
    this.middlewareManager.apply();
  }
  
  /**
   * 配置中间件
   * 
   * @public
   * @param {string} name - 中间件名称
   * @param {Object} config - 中间件配置
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  configureMiddleware(name, config) {
    this.middlewareManager.configure(name, config);
    return this;
  }
  
  /**
   * 启用中间件
   * 
   * @public
   * @param {string} name - 中间件名称
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  enableMiddleware(name) {
    this.middlewareManager.enable(name);
    return this;
  }
  
  /**
   * 禁用中间件
   * 
   * @public
   * @param {string} name - 中间件名称
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  disableMiddleware(name) {
    this.middlewareManager.disable(name);
    return this;
  }
  
  /**
   * 注册自定义中间件
   * 
   * @public
   * @param {string} name - 中间件名称
   * @param {Object} middleware - 中间件定义
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  registerMiddleware(name, middleware) {
    this.middlewareManager.register(name, middleware);
    return this;
  }
  
  /**
   * 注册中间件
   * 
   * @public
   * @param {Function} middleware - 中间件函数
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  use(middleware) {
    this.app.use(middleware);
    return this;
  }
  
  /**
   * 注册路由
   * 
   * @public
   * @param {Router} router - 路由实例
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  useRouter(router) {
    this.app.use(router.routes());
    this.app.use(router.allowedMethods());
    return this;
  }
  
  /**
   * 配置应用
   * 
   * @public
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  configure(key, value) {
    if (typeof key === 'object') {
      this.config = { ...this.config, ...key };
    } else {
      this.config[key] = value;
    }
    
    return this;
  }
  
  /**
   * 获取配置
   * 
   * @public
   * @param {string} key - 配置键
   * @param {*} defaultValue - 默认值
   * @returns {*} 配置值
   */
  getConfig(key, defaultValue) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
  
  /**
   * 注册钩子处理函数
   * 
   * @public
   * @param {string} hookName - 钩子名称
   * @param {Function} handler - 处理函数
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  on(hookName, handler) {
    this.hooks.on(hookName, handler);
    return this;
  }
  
  /**
   * 注册路由
   * 
   * @param {Function} routeRegistrar - 路由注册函数
   */
  registerRoutes(routeRegistrar) {
    // 执行路由注册前钩子
    this.hooks.execute(HOOK_NAMES.BEFORE_ROUTE_REGISTER, { app: this })
      .then(async (hookContext) => {
        // 注册全局路由
        this.app.use(this.publicRouter.routes()).use(this.publicRouter.allowedMethods());
        this.app.use(this.protectedRouter.routes()).use(this.protectedRouter.allowedMethods());
        
        // 注册业务路由
        if (typeof routeRegistrar === 'function') {
          await routeRegistrar(this.app, this);
        }
        
        // 执行路由注册后钩子
        await this.hooks.execute(HOOK_NAMES.AFTER_ROUTE_REGISTER, { app: this });
        
        // 404处理中间件
        this.app.use(async (ctx) => {
          if (ctx.status === 404) {
            ctx.status = 404;
            ctx.body = {
              code: 404,
              message: `接口不存在: ${ctx.path}`
            };
          }
        });
      })
      .catch(err => {
        this.logger.error(`注册路由失败`, { error: err.message, stack: err.stack });
      });
    
    return this;
  }
  
  /**
   * 从目录加载路由
   * 
   * @param {string} dir - 路由目录
   * @param {Object} options - 加载选项
   * @param {boolean} options.recursive - 是否递归加载子目录
   * @param {string[]} options.fileExtensions - 要加载的文件扩展名
   * @param {string[]} options.excludePatterns - 要排除的文件模式
   * @returns {BaseApp} 当前实例，支持链式调用
   */
  loadRoutes(dir, options = {}) {
    const {
      recursive = false,
      fileExtensions = ['.js'],
      excludePatterns = []
    } = options;
    
    const routesDir = path.resolve(process.cwd(), dir);
    
    if (!fs.existsSync(routesDir)) {
      this.logger.warn(`路由目录不存在: ${routesDir}`);
      return this;
    }
    
    this.logger.info(`加载路由目录: ${routesDir}`);
    
    /**
     * 加载单个路由文件
     * @param {string} filePath - 文件路径
     */
    const loadRouteFile = (filePath) => {
      try {
        const router = require(filePath);
        
        // 支持函数式路由定义
        if (typeof router === 'function') {
          router(this.app, this);
          this.logger.debug(`已加载路由文件: ${filePath}`);
        }
        // 支持对象式路由定义
        else if (typeof router === 'object') {
          this._registerObjectRoutes(router, filePath);
        }
      } catch (err) {
        this.logger.error(`加载路由文件失败: ${filePath}`, { error: err.message });
      }
    };
    
    /**
     * 处理目录
     * @param {string} dirPath - 目录路径
     */
    const processDirectory = (dirPath) => {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && recursive) {
          processDirectory(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(file);
          if (fileExtensions.includes(ext) && 
              !excludePatterns.some(pattern => pattern.test(file))) {
            loadRouteFile(fullPath);
          }
        }
      }
    };
    
    processDirectory(routesDir);
    return this;
  }
  
  /**
   * 注册对象式路由定义
   * @private
   * @param {Object} router - 路由对象
   * @param {string} filePath - 文件路径
   */
  _registerObjectRoutes(router, filePath) {
    const {
      prefix = '',
      middlewares = [],
      routes = {}
    } = router;
    
    // 创建路由实例
    const routeInstance = new Router({ prefix });
    
    // 注册中间件
    middlewares.forEach(middleware => {
      routeInstance.use(middleware);
    });
    
    // 注册路由
    Object.entries(routes).forEach(([path, handlers]) => {
      Object.entries(handlers).forEach(([method, handler]) => {
        if (typeof handler === 'function') {
          routeInstance[method.toLowerCase()](path, handler);
        } else if (Array.isArray(handler)) {
          // 支持中间件数组
          routeInstance[method.toLowerCase()](path, ...handler);
        }
      });
    });
    
    // 应用路由
    this.app.use(routeInstance.routes());
    this.app.use(routeInstance.allowedMethods());
    
    this.logger.debug(`已加载对象式路由: ${filePath}`);
  }
  
  /**
   * 启动应用
   * 
   * @public
   * @returns {Promise<void>}
   */
  async start() {
    return this.lifecycleManager.start();
  }
  
  /**
   * 停止应用
   * 
   * @public
   * @returns {Promise<void>}
   */
  async stop() {
    return this.lifecycleManager.stop();
  }
  
  /**
   * 重启应用
   * 
   * @public
   * @returns {Promise<void>}
   */
  async restart() {
    return this.lifecycleManager.restart();
  }
  
  /**
   * 获取应用状态
   * 
   * @public
   * @returns {Object} 应用状态信息
   */
  getStatus() {
    return this.lifecycleManager.getStatus();
  }
}

module.exports = BaseApp;