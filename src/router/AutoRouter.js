/**
 * 自动路由模块
 * 自动扫描路由文件夹并注册路由，支持多种路由定义方式和灵活的配置
 * 
 * 设计理念:
 * 1. 约定优于配置: 通过文件夹结构自动映射到API路径
 * 2. 多种定义方式: 支持多种路由文件格式，适应不同的编码风格
 * 3. 灵活配置: 提供丰富的配置选项，满足不同需求
 * 4. 与框架松耦合: 支持不同的Web框架
 * 
 * @module AutoRouter
 */

const fs = require('fs');
const path = require('path');
const Router = require('@koa/router');

/**
 * 自动路由扫描器类
 */
class AutoRouter {
  /**
   * 创建自动路由扫描器实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.routesDir - 路由文件夹路径，默认为'routes'
   * @param {string} options.basePrefix - 基础路由前缀，默认为'/api'
   * @param {Function} options.fileFilter - 文件过滤函数
   * @param {Object} options.routeOptions - 传递给路由的选项
   * @param {boolean} options.recursive - 是否递归扫描子文件夹，默认为true
   * @param {Function} options.pathResolver - 路径解析函数，自定义路由路径的生成
   * @param {Object} options.framework - 指定Web框架，用于正确应用中间件
   */
  constructor(options = {}) {
    this.options = {
      routesDir: options.routesDir || 'routes',
      basePrefix: options.basePrefix || '/api',
      fileFilter: options.fileFilter || (file => file.endsWith('.js') && !file.startsWith('_')),
      routeOptions: options.routeOptions || {},
      recursive: options.recursive !== false,
      pathResolver: options.pathResolver || this._defaultPathResolver.bind(this),
      framework: options.framework || 'koa',
      middlewares: options.middlewares || []
    };
    
    this.routers = [];
    this.routeMap = new Map(); // 路径到路由的映射，用于调试和文档生成
  }
  
  /**
   * 扫描并注册路由
   * 
   * @param {Object} app - 应用实例
   * @param {Object} context - 传递给路由处理函数的上下文
   * @returns {AutoRouter} 当前实例
   */
  scan(app, context = {}) {
    const routesDir = path.resolve(process.cwd(), this.options.routesDir);
    
    if (!fs.existsSync(routesDir)) {
      console.warn(`路由目录不存在: ${routesDir}`);
      return this;
    }
    
    this._scanDirectory(routesDir, app, '', context);
    
    return this;
  }
  
  /**
   * 获取注册的所有路由信息，用于生成API文档
   * 
   * @returns {Array} 路由信息数组
   */
  getRoutes() {
    return Array.from(this.routeMap.entries()).map(([path, info]) => ({
      path,
      method: info.method,
      handler: info.handler,
      middleware: info.middleware,
      meta: info.meta
    }));
  }
  
  /**
   * 递归扫描目录
   * 
   * @private
   * @param {string} dir - 待扫描的目录
   * @param {Object} app - 应用实例
   * @param {string} relativePath - 相对路径，用于构建API路径
   * @param {Object} context - 上下文对象
   */
  _scanDirectory(dir, app, relativePath, context) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && this.options.recursive) {
        // 处理子目录
        const newRelativePath = path.join(relativePath, file);
        this._scanDirectory(filePath, app, newRelativePath, context);
      } else if (stat.isFile() && this.options.fileFilter(file)) {
        // 处理路由文件
        try {
          const routePathSegment = path.basename(file, '.js');
          let apiPath = this.options.pathResolver(relativePath, routePathSegment, file);
          
          // 标准化API路径
          apiPath = path.posix.join(this.options.basePrefix, apiPath);
          apiPath = apiPath.replace(/\\/g, '/');
          
          this._registerRoute(filePath, apiPath, app, context);
        } catch (err) {
          console.error(`加载路由文件失败: ${file}`, err);
        }
      }
    }
  }
  
  /**
   * 默认路径解析器
   * 
   * @private
   * @param {string} relativePath - 相对路径
   * @param {string} filename - 文件名（不含扩展名）
   * @returns {string} 解析后的API路径
   */
  _defaultPathResolver(relativePath, filename) {
    // 如果文件名是index，则使用目录名作为路径
    // 否则使用文件名作为路径
    if (filename === 'index') {
      return relativePath;
    }
    
    return path.posix.join(relativePath, filename);
  }
  
  /**
   * 注册路由文件
   * 
   * @private
   * @param {string} filePath - 文件路径
   * @param {string} apiPath - API路径
   * @param {Object} app - 应用实例
   * @param {Object} context - 上下文对象
   */
  _registerRoute(filePath, apiPath, app, context) {
    // 清除Node缓存，确保热重载时能获取最新的路由定义
    delete require.cache[require.resolve(filePath)];
    
    const routeModule = require(filePath);
    let router;
    
    // 根据路由文件的导出方式，采用不同的注册策略
    if (routeModule instanceof Router) {
      // 导出Router实例
      router = routeModule;
      this._applyRouter(router, app);
    } else if (typeof routeModule === 'function') {
      // 导出函数
      const routerOptions = { ...this.options.routeOptions, prefix: apiPath };
      router = new Router(routerOptions);
      
      // 注入中间件
      const middlewares = [...this.options.middlewares];
      
      // 执行路由定义函数
      routeModule(router, context, { middlewares, apiPath });
      
      this._applyRouter(router, app);
    } else if (routeModule && typeof routeModule === 'object') {
      // 导出对象 - 支持多种结构
      if (routeModule.router instanceof Router) {
        // 对象包含router属性
        router = routeModule.router;
        this._applyRouter(router, app);
      } else {
        // RESTful API对象结构 {get, post, put, delete, ...}
        router = this._createRouterFromObject(routeModule, apiPath);
        this._applyRouter(router, app);
      }
    }
    
    if (router) {
      this.routers.push(router);
    }
  }
  
  /**
   * 从对象创建路由
   * 支持 {get, post, put, delete} 形式的路由定义
   * 
   * @private
   * @param {Object} routeObj - 路由对象
   * @param {string} apiPath - API路径
   * @returns {Router} 创建的路由实例
   */
  _createRouterFromObject(routeObj, apiPath) {
    const routerOptions = { ...this.options.routeOptions };
    const router = new Router(routerOptions);
    
    // 处理meta元数据
    const meta = routeObj.meta || {};
    
    // 应用中间件
    const middlewares = [...this.options.middlewares];
    if (Array.isArray(routeObj.middlewares)) {
      middlewares.push(...routeObj.middlewares);
    }
    
    // HTTP方法映射
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
    
    methods.forEach(method => {
      if (typeof routeObj[method] === 'function') {
        const handler = routeObj[method];
        
        // 注册路由
        router[method](apiPath, ...middlewares, handler);
        
        // 存储路由信息用于文档生成
        this.routeMap.set(`${method.toUpperCase()} ${apiPath}`, {
          method: method.toUpperCase(),
          handler: handler.name || '匿名函数',
          middleware: middlewares.map(m => m.name || '匿名中间件'),
          meta
        });
      }
    });
    
    return router;
  }
  
  /**
   * 应用路由到应用实例
   * 
   * @private
   * @param {Router} router - 路由实例
   * @param {Object} app - 应用实例
   */
  _applyRouter(router, app) {
    if (this.options.framework === 'koa') {
      app.use(router.routes()).use(router.allowedMethods());
    } else if (this.options.framework === 'express') {
      app.use(router.routes());
    } else {
      // 默认假设是Koa兼容的框架
      app.use(router.routes()).use(router.allowedMethods());
    }
  }
}

/**
 * 创建自动路由实例
 * 
 * @param {Object} options - 配置选项
 * @returns {AutoRouter} 自动路由实例
 */
function createAutoRouter(options = {}) {
  return new AutoRouter(options);
}

module.exports = {
  AutoRouter,
  createAutoRouter
}; 