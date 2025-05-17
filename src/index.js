/**
 * MCore.js 入口文件
 * 导出所有共享模块供各服务使用
 * 
 * @module mcore.js
 */

// 加载环境变量
require('dotenv').config();

// 基础应用框架
const BaseApp = require('./app/BaseApp');

// 路由模块
const router = require('./router');

// 认证模块
const auth = require('./auth');

// API 标准模块
const api = require('./api');

// 数据库模块
const db = require('./db');

// 服务注册与发现模块
const registry = require('./registry');

// 日志模块
const logger = require('./logging');

// 审计模块
const audit = require('./audit');

// 缓存模块
const cache = require('./cache');

// 消息队列模块
const mq = require('./mq');

// 弹性模块
const resilience = require('./resilience');

// 配置中心模块
const config = require('./config');

// 监控模块
const monitor = require('./monitor');

// 安全模块
const security = require('./security');

// 钩子系统
const hooks = require('./hooks');

// 中间件
const middlewares = require('./middlewares');

// 工具函数
const utils = require('./utils');

// 常量定义
const constants = require('./constants');

/**
 * 创建应用实例的快捷方法
 * 
 * @param {Object} options - 应用配置选项
 * @returns {BaseApp} 应用实例
 */
function createApp(options = {}) {
  return new BaseApp(options);
}

// 导出所有模块
module.exports = {
  // 创建应用方法
  createApp,
  
  // 应用基类
  BaseApp,
  
  // 核心模块
  router,
  auth,
  api,
  db,
  registry,
  logger,
  audit,
  cache,
  mq,
  resilience,
  config,
  monitor,
  security,
  hooks,
  middlewares,
  utils,
  constants,
  
  // 版本信息
  version: require('../package.json').version
}; 