/**
 * 基础应用类
 * 提供微服务的基础功能
 * 
 * @class BaseApp
 */

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const Router = require('@koa/router');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const logger = require('../logging');
const db = require('../db');
const { createHookManager } = require('../hooks');
const { HOOK_NAMES, HEALTH_STATUS } = require('../constants');
const responseHandler = require('../middlewares/responseHandler');

class BaseApp {
  /**
   * 创建基础应用实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.serviceName - 服务名称
   * @param {number} options.port - 服务端口
   * @param {string} options.version - 服务版本
   * @param {Object} options.registry - 服务注册配置
   * @param {Object} options.logger - 日志配置
   * @param {Object} options.db - 数据库配置
   * @param {Object} options.auth - 认证配置
   */
  constructor(options = {}) {
    // 服务基本信息
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'microservice';
    this.port = options.port || parseInt(process.env.PORT || '3000', 10);
    this.version = options.version || process.env.SERVICE_VERSION || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
    
    // 创建应用实例
    this.app = new Koa();
    
    // 公共路由和受保护路由
    this.publicRouter = new Router({ prefix: '/api/v1' });
    this.protectedRouter = new Router({ prefix: '/api/v1' });
    
    // 钩子系统
    this.hooks = createHookManager();
    
    // 日志系统
    this.logger = options.logger
      ? logger.createLoggerFactory(options.logger).createLogger(this.serviceName)
      : logger.createLoggerFactory({ level: process.env.LOG_LEVEL }).createLogger(this.serviceName);
    
    // 数据库管理器
    this.db = db.manager;
    
    // 数据库配置
    this.dbConfig = options.db;
    
    // 健康状态
    this.healthStatus = HEALTH_STATUS.UP;
    
    // 服务状态
    this.status = {
      startTime: null,
      uptime: 0,
      totalRequests: 0,
      activeRequests: 0,
      errors: 0
    };
    
    // 初始化配置
    this.config = this._loadConfig(options);
    
    // 初始化中间件
    this._initMiddlewares();
    
    // 注册健康检查路由
    this._registerHealthCheck();
    
    // 全局错误处理
    this._registerErrorHandlers();
  }
  
  /**
   * 加载配置
   * 
   * @private
   * @param {Object} options - 配置选项
   * @returns {Object} 配置对象
   */
  _loadConfig(options = {}) {
    // 默认配置
    const defaultConfig = {
      cors: {
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
      },
      bodyParser: {
        enableTypes: ['json', 'form'],
        jsonLimit: '1mb',
        strict: true,
        onerror: (err, ctx) => {
          ctx.throw(422, `请求体解析错误: ${err.message}`);
        }
      },
      requestId: {
        header: 'X-Request-ID',
        generator: () => uuidv4()
      }
    };
    
    // 合并配置
    return Object.assign({}, defaultConfig, options);
  }
  
  /**
   * 初始化中间件
   * 
   * @private
   */
  _initMiddlewares() {
    // CORS中间件
    this.app.use(cors(this.config.cors));
    
    // 请求体解析中间件
    this.app.use(bodyParser(this.config.bodyParser));
    
    // 统一响应格式中间件
    this.app.use(responseHandler());
    
    // 请求日志中间件（排除健康检查）
    this.app.use(async (ctx, next) => {
      // 健康检查接口不记录日志
      if (ctx.path === '/api/v1/health') {
        return await next();
      }
      
      const start = Date.now();
      try {
        await next();
        const ms = Date.now() - start;
        this.logger.info(`${ctx.method} ${ctx.url} - ${ms}ms`, {
          requestId: ctx.state.requestId || 'unknown'
        });
      } catch (err) {
        const ms = Date.now() - start;
        this.logger.error(`${ctx.method} ${ctx.url} - ${ms}ms - Error: ${err.message}`, {
          requestId: ctx.state.requestId || 'unknown',
          error: err.stack
        });
        throw err; // 继续抛出错误，让响应处理中间件处理
      }
    });
    
    // 将数据库对象添加到上下文
    this.app.use(async (ctx, next) => {
      ctx.db = this.db;
      await next();
    });
  }
  
  /**
   * 注册健康检查路由
   * 
   * @private
   */
  _registerHealthCheck() {
    this.publicRouter.get('/health', async (ctx) => {
      const health = {
        status: this.healthStatus,
        service: this.serviceName,
        version: this.version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: this.environment,
        details: {
          memory: process.memoryUsage(),
          requests: {
            total: this.status.totalRequests,
            active: this.status.activeRequests
          }
        }
      };
      
      // 添加数据库状态
      if (this.db.connections.size > 0) {
        health.details.database = {
          connected: true,
          connections: Array.from(this.db.connections.keys())
        };
      }
      
      // 运行钩子以允许添加更多健康检查细节
      const hookContext = await this.hooks.execute(HOOK_NAMES.BEFORE_RESPONSE, { health });
      
      ctx.body = hookContext.error ? health : hookContext.result.health;
    });
  }
  
  /**
   * 注册全局错误处理
   * 
   * @private
   */
  _registerErrorHandlers() {
    // Koa错误事件
    this.app.on('error', (err, ctx) => {
      this.logger.error(`服务错误`, {
        error: err.message,
        stack: err.stack,
        url: ctx ? ctx.url : '',
        method: ctx ? ctx.method : '',
        requestId: ctx ? ctx.state.requestId : ''
      });
      
      // 执行错误钩子
      this.hooks.execute(HOOK_NAMES.ON_ERROR, { error: err, ctx })
        .catch(hookErr => {
          this.logger.error(`执行错误钩子失败`, { error: hookErr.message });
        });
    });
    
    // 进程异常
    process.on('uncaughtException', (err) => {
      this.logger.error(`未捕获的异常`, {
        error: err.message,
        stack: err.stack
      });
      
      // 执行错误钩子
      this.hooks.execute(HOOK_NAMES.ON_ERROR, { error: err })
        .catch(hookErr => {
          this.logger.error(`执行错误钩子失败`, { error: hookErr.message });
        });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`未处理的Promise拒绝`, {
        error: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
      
      // 执行错误钩子
      this.hooks.execute(HOOK_NAMES.ON_ERROR, { error: reason instanceof Error ? reason : new Error(String(reason)) })
        .catch(hookErr => {
          this.logger.error(`执行错误钩子失败`, { error: hookErr.message });
        });
    });
  }
  
  /**
   * 初始化数据库连接
   * 
   * @param {Object} config - 数据库配置，如果未提供则使用构造函数传入的配置
   * @returns {Promise<void>}
   */
  async initDatabase(config = null) {
    const dbConfig = config || this.dbConfig;
    
    if (!dbConfig) {
      this.logger.debug('没有提供数据库配置，跳过数据库初始化');
      return;
    }
    
    try {
      this.logger.info('正在初始化数据库连接');
      
      // 执行数据库连接前钩子
      const beforeConnectHook = await this.hooks.execute(HOOK_NAMES.BEFORE_CONNECT, { config: dbConfig });
      if (beforeConnectHook.error) {
        throw beforeConnectHook.error;
      }
      
      // 如果钩子修改了配置，使用修改后的配置
      const finalConfig = beforeConnectHook.result ? beforeConnectHook.result.config : dbConfig;
      
      // 创建连接
      const connection = await db.createConnection(finalConfig);
      
      // 执行数据库连接后钩子
      await this.hooks.execute(HOOK_NAMES.AFTER_CONNECT, { connection });
      
      // 如果配置了模型目录，自动加载模型
      if (finalConfig.modelsDir) {
        this.logger.info(`正在加载模型目录: ${finalConfig.modelsDir}`);
        await db.loadModels(finalConfig.modelsDir);
      }
      
      // 自动同步模型到数据库
      if (finalConfig.sync) {
        const syncOptions = typeof finalConfig.sync === 'object' ? finalConfig.sync : {};
        this.logger.info('正在同步数据库模型', syncOptions);
        await connection.sync(syncOptions);
      }
      
      this.logger.info('数据库初始化完成');
      
      return connection;
    } catch (err) {
      this.logger.error('数据库初始化失败', { error: err.message, stack: err.stack });
      
      // 如果配置了必要选项，重新抛出错误
      if (dbConfig.required !== false) {
        throw err;
      }
    }
  }
  
  /**
   * 注册所有路由
   * 
   * @param {Function} routeRegistrar - 路由注册函数
   * @returns {BaseApp} 当前应用实例
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
   * 自动加载路由
   * 
   * @param {string} dir - 路由目录
   * @returns {BaseApp} 当前应用实例
   */
  loadRoutes(dir) {
    const routesDir = path.resolve(process.cwd(), dir);
    
    if (!fs.existsSync(routesDir)) {
      this.logger.warn(`路由目录不存在: ${routesDir}`);
      return this;
    }
    
    this.logger.info(`加载路由目录: ${routesDir}`);
    
    try {
      // 读取目录下的所有文件
      const files = fs.readdirSync(routesDir);
      
      // 遍历文件
      for (const file of files) {
        if (file.endsWith('.js')) {
          const routePath = path.join(routesDir, file);
          const router = require(routePath);
          
          // 注册路由
          if (typeof router === 'function') {
            router(this.app, this);
            this.logger.debug(`已加载路由文件: ${file}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`加载路由失败`, { error: err.message, stack: err.stack });
    }
    
    return this;
  }
  
  /**
   * 启动应用
   * 
   * @returns {Promise<BaseApp>} 应用实例
   */
  async start() {
    try {
      // 执行启动前钩子
      const beforeStartHook = await this.hooks.execute(HOOK_NAMES.BEFORE_START, { app: this });
      
      if (beforeStartHook.error) {
        throw beforeStartHook.error;
      }
      
      // 初始化数据库连接（如果配置了）
      if (this.dbConfig) {
        await this.initDatabase();
      }
      
      // 启动HTTP服务
      return new Promise((resolve, reject) => {
        try {
          this.server = this.app.listen(this.port, () => {
            // 记录状态
            this.status.startTime = Date.now();
            
            this.logger.info(`服务已启动`, {
              service: this.serviceName,
              port: this.port,
              environment: this.environment,
              version: this.version
            });
            
            // 执行启动后钩子
            this.hooks.execute(HOOK_NAMES.AFTER_START, { app: this })
              .catch(err => {
                this.logger.error(`执行启动后钩子失败`, { error: err.message });
              });
            
            // 优雅关闭处理
            this._registerShutdownHandlers();
            
            resolve(this);
          });
          
          this.server.on('error', (err) => {
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      this.logger.error(`启动服务失败`, { error: err.message, stack: err.stack });
      throw err;
    }
  }
  
  /**
   * 注册关闭处理程序
   * 
   * @private
   */
  _registerShutdownHandlers() {
    const shutdown = async () => {
      try {
        this.logger.info(`正在关闭服务...`, { service: this.serviceName });
        
        // 设置健康状态为DOWN，快速失败新请求
        this.healthStatus = HEALTH_STATUS.DOWN;
        
        // 执行关闭前钩子
        await this.hooks.execute(HOOK_NAMES.BEFORE_SHUTDOWN, { app: this });
        
        // 关闭数据库连接
        await this.db.closeAll();
        
        // 关闭HTTP服务器
        if (this.server) {
          this.server.close();
        }
        
        // 关闭日志等资源
        logger.factory.close();
        
        this.logger.info(`服务已关闭`, { service: this.serviceName });
        
        // 延迟退出，确保日志被写入
        setTimeout(() => {
          process.exit(0);
        }, 500);
      } catch (err) {
        this.logger.error(`关闭服务出错`, { error: err.message, stack: err.stack });
        process.exit(1);
      }
    };
    
    // 注册信号处理程序
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
  
  /**
   * 注册钩子
   * 
   * @param {string} name - 钩子名称
   * @param {Function} handler - 钩子处理函数
   * @param {Object} options - 钩子选项
   * @returns {string} 处理器ID
   */
  hook(name, handler, options = {}) {
    return this.hooks.register(name, handler, options);
  }
  
  /**
   * 执行钩子
   * 
   * @param {string} name - 钩子名称
   * @param {Object} data - 上下文数据
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} 钩子上下文
   */
  async executeHook(name, data = {}, options = {}) {
    return this.hooks.execute(name, data, options);
  }
  
  /**
   * 注册新的钩子点
   * 
   * @param {string} name - 钩子名称
   * @returns {BaseApp} 当前应用实例
   */
  registerHook(name) {
    if (!this.hooks.has(name)) {
      this.logger.debug(`注册新钩子点: ${name}`);
    }
    return this;
  }
}

module.exports = BaseApp;