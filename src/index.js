/**
 * MCore.js 入口文件
 * 导出所有共享模块供各服务使用
 * 
 * 设计理念:
 * 1. 渐进式采用: 支持按需引入模块，最小化依赖
 * 2. 原生兼容: 保持与底层框架的兼容性
 * 3. 低学习成本: 简单直观的API设计
 * 4. 松耦合: 模块间低依赖，可灵活组合
 * 
 * 使用示例:
 * 1. 仅引入单个模块: const { cache } = require('mcore.js');
 * 2. 使用完整应用: const { createApp } = require('mcore.js');
 * 
 * @module mcore.js
 */

// 基础模块 - 按需加载，减少不必要的依赖
let BaseApp, router, auth, api, db, registry, logger, audit, cache, 
    mq, resilience, config, monitor, security, hooks, middlewares, 
    utils, constants;

// 延迟加载函数 - 仅在需要时才加载模块
const lazyLoad = (module, path) => {
  return new Proxy({}, {
    get(target, prop) {
      if (!module) {
        try {
          // 尝试按需加载模块
          module = require(path);
        } catch (error) {
          console.error(`无法加载模块 ${path}:`, error.message);
          throw new Error(`MCore.js: 模块 ${path} 加载失败`);
        }
      }
      return module[prop];
    }
  });
};

// 创建延迟加载的模块代理
const lazyModules = {
  get BaseApp() { if (!BaseApp) BaseApp = require('./app/BaseApp'); return BaseApp; },
  get router() { if (!router) router = require('./router'); return router; },
  get auth() { if (!auth) auth = require('./auth'); return auth; },
  get api() { if (!api) api = require('./api'); return api; },
  get db() { if (!db) db = require('./db'); return db; },
  get registry() { if (!registry) registry = require('./registry'); return registry; },
  get logger() { if (!logger) logger = require('./logging'); return logger; },
  get audit() { if (!audit) audit = require('./audit'); return audit; },
  get cache() { if (!cache) cache = require('./cache'); return cache; },
  get mq() { if (!mq) mq = require('./mq'); return mq; },
  get resilience() { if (!resilience) resilience = require('./resilience'); return resilience; },
  get config() { if (!config) config = require('./config'); return config; },
  get monitor() { if (!monitor) monitor = require('./monitor'); return monitor; },
  get security() { if (!security) security = require('./security'); return security; },
  get hooks() { if (!hooks) hooks = require('./hooks'); return hooks; },
  get middlewares() { if (!middlewares) middlewares = require('./middlewares'); return middlewares; },
  get utils() { if (!utils) utils = require('./utils'); return utils; },
  get constants() { if (!constants) constants = require('./constants'); return constants; }
};

/**
 * 创建应用实例的快捷方法
 * 
 * @param {Object} options - 应用配置选项
 * @param {Object} options.features - 功能开关，控制启用哪些特性
 * @returns {BaseApp} 应用实例
 */
function createApp(options = {}) {
  // 加载环境变量 - 仅在创建应用时加载，避免引入单个模块时就加载
  require('dotenv').config();
  
  // 确保加载应用模块
  const BaseAppClass = lazyModules.BaseApp;
  
  // 创建应用实例
  return new BaseAppClass(options);
}

/**
 * 创建轻量级应用实例，仅包含基本功能
 * 适用于只需要部分功能的场景
 * 
 * @param {Object} options - 应用配置选项
 * @returns {BaseApp} 轻量级应用实例
 */
function createLightApp(options = {}) {
  // 加载环境变量
  require('dotenv').config();
  
  // 确保加载应用模块
  const BaseAppClass = lazyModules.BaseApp;
  
  // 禁用默认不需要的功能
  const lightOptions = {
    ...options,
    features: {
      serviceRegistry: false,
      configCenter: false,
      messageQueue: false,
      ...options.features
    }
  };
  
  // 创建应用实例
  return new BaseAppClass(lightOptions);
}

// 导出所有模块 - 使用代理以实现按需加载
module.exports = {
  // 创建应用方法
  createApp,
  createLightApp,
  
  // 应用基类 - 用代理延迟加载
  get BaseApp() { return lazyModules.BaseApp; },
  
  // 直接导出Router类，简化使用
  get Router() { return lazyModules.router.Router; },
  
  // 核心模块 - 全部使用代理延迟加载
  get router() { return lazyModules.router; },
  get auth() { return lazyModules.auth; },
  get api() { return lazyModules.api; },
  get db() { return lazyModules.db; },
  get registry() { return lazyModules.registry; },
  get logger() { return lazyModules.logger; },
  get audit() { return lazyModules.audit; },
  get cache() { return lazyModules.cache; },
  get mq() { return lazyModules.mq; },
  get resilience() { return lazyModules.resilience; },
  get config() { return lazyModules.config; },
  get monitor() { return lazyModules.monitor; },
  get security() { return lazyModules.security; },
  get hooks() { return lazyModules.hooks; },
  get middlewares() { return lazyModules.middlewares; },
  get utils() { return lazyModules.utils; },
  get constants() { return lazyModules.constants; },
  
  // 版本信息
  version: require('../package.json').version
}; 