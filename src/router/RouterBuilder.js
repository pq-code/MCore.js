/**
 * 路由构建器类
 * 提供流式API构建路由
 * 
 * @class RouterBuilder
 */

const Router = require('@koa/router');

class RouterBuilder {
  /**
   * 创建路由构建器实例
   * 
   * @param {Object} options - 路由选项
   */
  constructor(options = {}) {
    this.router = new Router(options);
    this.middlewares = [];
    this.prefix = options.prefix || '';
    this.groups = [];
    this.currentGroup = null;
  }
  
  /**
   * 添加全局中间件
   * 
   * @param {...Function} middlewares - 中间件函数
   * @returns {RouterBuilder} 当前实例
   */
  use(...middlewares) {
    this.middlewares.push(...middlewares);
    return this;
  }
  
  /**
   * 设置路由前缀
   * 
   * @param {string} prefix - 前缀
   * @returns {RouterBuilder} 当前实例
   */
  setPrefix(prefix) {
    this.prefix = prefix;
    this.router.prefix(prefix);
    return this;
  }
  
  /**
   * 创建路由组
   * 
   * @param {string} prefix - 组前缀
   * @param {Function} callback - 组回调函数
   * @param {Array<Function>} middlewares - 组中间件
   * @returns {RouterBuilder} 当前实例
   */
  group(prefix, callback, ...middlewares) {
    // 保存当前组状态
    const parentGroup = this.currentGroup;
    
    // 创建新组
    this.currentGroup = {
      prefix: prefix,
      middlewares: [...this.middlewares, ...middlewares]
    };
    
    // 添加到组列表
    this.groups.push(this.currentGroup);
    
    // 执行回调
    callback(this);
    
    // 恢复父级组状态
    this.currentGroup = parentGroup;
    
    return this;
  }
  
  /**
   * 获取完整路径
   * 
   * @private
   * @param {string} path - 原始路径
   * @returns {string} 完整路径
   */
  _getFullPath(path) {
    let fullPath = path;
    
    // 添加当前组前缀
    if (this.currentGroup && this.currentGroup.prefix) {
      fullPath = `${this.currentGroup.prefix}${path.startsWith('/') ? path : `/${path}`}`;
    }
    
    return fullPath;
  }
  
  /**
   * 获取中间件列表
   * 
   * @private
   * @param {Array<Function>} middlewares - 路由中间件
   * @returns {Array<Function>} 完整中间件列表
   */
  _getMiddlewares(middlewares) {
    // 基础中间件
    let allMiddlewares = [...this.middlewares];
    
    // 添加组中间件
    if (this.currentGroup && this.currentGroup.middlewares.length > 0) {
      allMiddlewares = [...allMiddlewares, ...this.currentGroup.middlewares];
    }
    
    // 添加路由特定中间件
    if (middlewares && middlewares.length > 0) {
      allMiddlewares = [...allMiddlewares, ...middlewares];
    }
    
    return allMiddlewares;
  }
  
  /**
   * 注册GET路由
   * 
   * @param {string} path - 路径
   * @param {...Function} handlers - 处理函数
   * @returns {RouterBuilder} 当前实例
   */
  get(path, ...handlers) {
    const fullPath = this._getFullPath(path);
    const middlewares = this._getMiddlewares(handlers.slice(0, -1));
    const handler = handlers[handlers.length - 1];
    
    this.router.get(fullPath, ...middlewares, handler);
    return this;
  }
  
  /**
   * 注册POST路由
   * 
   * @param {string} path - 路径
   * @param {...Function} handlers - 处理函数
   * @returns {RouterBuilder} 当前实例
   */
  post(path, ...handlers) {
    const fullPath = this._getFullPath(path);
    const middlewares = this._getMiddlewares(handlers.slice(0, -1));
    const handler = handlers[handlers.length - 1];
    
    this.router.post(fullPath, ...middlewares, handler);
    return this;
  }
  
  /**
   * 注册PUT路由
   * 
   * @param {string} path - 路径
   * @param {...Function} handlers - 处理函数
   * @returns {RouterBuilder} 当前实例
   */
  put(path, ...handlers) {
    const fullPath = this._getFullPath(path);
    const middlewares = this._getMiddlewares(handlers.slice(0, -1));
    const handler = handlers[handlers.length - 1];
    
    this.router.put(fullPath, ...middlewares, handler);
    return this;
  }
  
  /**
   * 注册PATCH路由
   * 
   * @param {string} path - 路径
   * @param {...Function} handlers - 处理函数
   * @returns {RouterBuilder} 当前实例
   */
  patch(path, ...handlers) {
    const fullPath = this._getFullPath(path);
    const middlewares = this._getMiddlewares(handlers.slice(0, -1));
    const handler = handlers[handlers.length - 1];
    
    this.router.patch(fullPath, ...middlewares, handler);
    return this;
  }
  
  /**
   * 注册DELETE路由
   * 
   * @param {string} path - 路径
   * @param {...Function} handlers - 处理函数
   * @returns {RouterBuilder} 当前实例
   */
  delete(path, ...handlers) {
    const fullPath = this._getFullPath(path);
    const middlewares = this._getMiddlewares(handlers.slice(0, -1));
    const handler = handlers[handlers.length - 1];
    
    this.router.delete(fullPath, ...middlewares, handler);
    return this;
  }
  
  /**
   * 注册所有方法的路由
   * 
   * @param {string} path - 路径
   * @param {...Function} handlers - 处理函数
   * @returns {RouterBuilder} 当前实例
   */
  all(path, ...handlers) {
    const fullPath = this._getFullPath(path);
    const middlewares = this._getMiddlewares(handlers.slice(0, -1));
    const handler = handlers[handlers.length - 1];
    
    this.router.all(fullPath, ...middlewares, handler);
    return this;
  }
  
  /**
   * 注册RESTful路由
   * 
   * @param {string} path - 资源路径
   * @param {Object} controller - 控制器对象
   * @param {Object} options - 选项
   * @returns {RouterBuilder} 当前实例
   */
  resource(path, controller, options = {}) {
    const { exclude = [] } = options;
    
    const resourcePath = this._getFullPath(path);
    const resourceIdPath = `${resourcePath}/:id`;
    const middlewares = this._getMiddlewares(options.middlewares || []);
    
    // 注册路由
    if (controller.index && !exclude.includes('index')) {
      this.router.get(resourcePath, ...middlewares, controller.index);
    }
    
    if (controller.create && !exclude.includes('create')) {
      this.router.post(resourcePath, ...middlewares, controller.create);
    }
    
    if (controller.show && !exclude.includes('show')) {
      this.router.get(resourceIdPath, ...middlewares, controller.show);
    }
    
    if (controller.update && !exclude.includes('update')) {
      this.router.put(resourceIdPath, ...middlewares, controller.update);
    }
    
    if (controller.patch && !exclude.includes('patch')) {
      this.router.patch(resourceIdPath, ...middlewares, controller.patch);
    }
    
    if (controller.destroy && !exclude.includes('destroy')) {
      this.router.delete(resourceIdPath, ...middlewares, controller.destroy);
    }
    
    return this;
  }
  
  /**
   * 构建路由实例
   * 
   * @returns {Router} 路由实例
   */
  build() {
    return this.router;
  }
}

module.exports = RouterBuilder; 