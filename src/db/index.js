/**
 * 数据库模块
 * 提供数据库连接和模型管理
 * 
 * @module db
 */

const DatabaseManager = require('./DatabaseManager');
const ModelLoader = require('./ModelLoader');

// 默认数据库管理器实例
const defaultManager = new DatabaseManager();

/**
 * 创建数据库管理器
 * 
 * @param {Object} options - 配置选项
 * @returns {DatabaseManager} 数据库管理器实例
 */
function createDatabaseManager(options = {}) {
  return new DatabaseManager(options);
}

// 导出数据库相关功能
module.exports = {
  // 类
  DatabaseManager,
  ModelLoader,
  
  // 默认实例
  manager: defaultManager,
  
  // 工厂方法
  createDatabaseManager,
  
  // 快捷方法
  createConnection: (config, name) => defaultManager.createConnection(config, name),
  registerModel: (name, schema, connectionName) => defaultManager.registerModel(name, schema, connectionName),
  getModel: name => defaultManager.getModel(name),
  loadModels: (dir, connectionName) => defaultManager.loadModels(dir, connectionName),
  query: (sql, params, connectionName) => defaultManager.query(sql, params, connectionName),
  transaction: (callback, connectionName) => defaultManager.transaction(callback, connectionName)
}; 