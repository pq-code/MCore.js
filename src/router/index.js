/**
 * 路由模块
 * 提供路由管理、注册和辅助功能
 * 
 * 设计理念:
 * 1. 渐进式采用: 支持从简单的单路由到自动扫描的多种使用方式
 * 2. 原生兼容: 保持与底层框架（Koa/Express）的兼容性
 * 3. 低学习成本: 直观的API设计
 * 4. 松耦合: 与框架其他部分保持低依赖
 * 
 * @module router
 */

const Router = require('@koa/router');
const path = require('path');
const fs = require('fs');
const RouterBuilder = require('./RouterBuilder');
const { AutoRouter, createAutoRouter } = require('./AutoRouter');

/**
 * 创建路由构建器实例
 * 
 * @param {Object} options - 路由选项 
 * @returns {RouterBuilder} RouterBuilder实例
 */
function createRouterBuilder(options = {}) {
  return new RouterBuilder(options);
}

/**
 * 创建路由实例
 * 
 * @param {Object} options - 路由选项
 * @param {string} options.prefix - 路由前缀
 * @returns {Router} Router实例
 */
function createRouter(options = {}) {
  return new Router(options);
}

/**
 * 自动加载路由文件
 * 
 * @param {string} dir - 路由目录路径
 * @param {Object} app - 应用实例
 * @param {Object} options - 加载选项
 * @param {string} options.prefix - 路由前缀
 * @param {Function} options.filter - 过滤文件的函数
 * @returns {Array<Router>} 已加载的路由数组
 */
function loadRoutes(dir, app, options = {}) {
  const routesDir = path.resolve(process.cwd(), dir);
  const routers = [];
  
  if (!fs.existsSync(routesDir)) {
    console.warn(`路由目录不存在: ${routesDir}`);
    return routers;
  }
  
  try {
    // 读取目录下的所有文件
    const files = fs.readdirSync(routesDir);
    
    // 过滤函数
    const filter = options.filter || (file => file.endsWith('.js') && !file.startsWith('_'));
    
    // 遍历文件
    for (const file of files) {
      if (filter(file)) {
        const routePath = path.join(routesDir, file);
        const routeModule = require(routePath);
        
        // 如果导出的是路由实例
        if (routeModule instanceof Router) {
          routers.push(routeModule);
          app.use(routeModule.routes()).use(routeModule.allowedMethods());
        } 
        // 如果导出的是函数
        else if (typeof routeModule === 'function') {
          const router = new Router(options);
          routeModule(router, app);
          routers.push(router);
          app.use(router.routes()).use(router.allowedMethods());
        }
        // 如果导出的是对象并包含router属性
        else if (routeModule && routeModule.router instanceof Router) {
          routers.push(routeModule.router);
          app.use(routeModule.router.routes()).use(routeModule.router.allowedMethods());
        }
      }
    }
  } catch (err) {
    console.error(`加载路由失败: ${err.message}`);
  }
  
  return routers;
}

/**
 * 生成API文档
 * 
 * @param {Array<Router>} routers - 路由数组
 * @param {Object} options - 选项
 * @returns {Object} API文档对象
 */
function generateApiDocs(routers, options = {}) {
  // 简单实现，实际项目中可能需要更复杂的文档生成逻辑
  const docs = {
    title: options.title || 'API Documentation',
    version: options.version || '1.0.0',
    endpoints: []
  };
  
  // 从AutoRouter获取路由信息
  if (routers instanceof AutoRouter) {
    docs.endpoints = routers.getRoutes();
    return docs;
  }
  
  // 从普通路由提取信息
  routers.forEach(router => {
    if (router.stack) {
      router.stack.forEach(layer => {
        docs.endpoints.push({
          path: layer.path,
          methods: layer.methods,
          middleware: layer.stack.map(fn => fn.name || '匿名函数')
        });
      });
    }
  });
  
  return docs;
}

/**
 * 创建RESTful路由
 * 
 * @param {Router} router - 路由实例
 * @param {string} path - 资源路径
 * @param {Object} controller - 控制器对象
 * @param {Object} options - 选项
 * @param {Array<string>} options.exclude - 排除的方法
 * @param {Object} options.middlewares - 中间件配置
 */
function restful(router, path, controller, options = {}) {
  const { exclude = [], middlewares = {} } = options;
  
  // 获取资源路径
  const resourcePath = path.endsWith('/') ? path.slice(0, -1) : path;
  const resourceIdPath = `${resourcePath}/:id`;
  
  // 默认中间件
  const defaultMiddleware = async (ctx, next) => await next();
  
  // 获取中间件
  const getMiddleware = action => {
    return Array.isArray(middlewares[action]) 
      ? middlewares[action] 
      : (middlewares[action] ? [middlewares[action]] : [defaultMiddleware]);
  };
  
  // 注册路由
  if (!exclude.includes('list')) {
    router.get(resourcePath, ...getMiddleware('list'), controller.list || controller.index);
  }
  
  if (!exclude.includes('create')) {
    router.post(resourcePath, ...getMiddleware('create'), controller.create);
  }
  
  if (!exclude.includes('get')) {
    router.get(resourceIdPath, ...getMiddleware('get'), controller.get || controller.show);
  }
  
  if (!exclude.includes('update')) {
    router.put(resourceIdPath, ...getMiddleware('update'), controller.update);
  }
  
  if (!exclude.includes('patch')) {
    router.patch(resourceIdPath, ...getMiddleware('patch'), controller.patch);
  }
  
  if (!exclude.includes('delete')) {
    router.delete(resourceIdPath, ...getMiddleware('delete'), controller.delete || controller.remove);
  }
}

// 导出路由相关功能
module.exports = {
  // 核心类
  Router,
  RouterBuilder,
  AutoRouter,
  
  // 工厂函数
  createRouter,
  createRouterBuilder,
  createAutoRouter,
  
  // 实用函数
  loadRoutes,
  generateApiDocs,
  restful
}; 