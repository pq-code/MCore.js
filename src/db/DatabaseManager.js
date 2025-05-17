/**
 * 数据库管理器
 * 负责管理数据库连接和模型
 * 
 * @class DatabaseManager
 */

const path = require('path');
const fs = require('fs');
const ModelLoader = require('./ModelLoader');
const logger = require('../logging').logger;

class DatabaseManager {
  /**
   * 创建数据库管理器实例
   * 
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = options;
    this.connections = new Map();
    this.models = new Map();
    this.modelLoader = new ModelLoader(this);
    this.defaultConnection = null;
  }
  
  /**
   * 创建数据库连接
   * 
   * @param {Object} config - 连接配置
   * @param {string} name - 连接名称，默认为'default'
   * @returns {Object} 连接对象
   */
  async createConnection(config, name = 'default') {
    try {
      // 检查必要的依赖
      this._checkDependencies(config.dialect);
      
      // 动态加载适配器
      const AdapterClass = await this._getAdapter(config.dialect);
      const adapter = new AdapterClass(config);
      
      // 创建连接
      await adapter.connect();
      
      // 保存连接
      this.connections.set(name, adapter);
      
      // 设为默认连接（如果是第一个连接）
      if (!this.defaultConnection) {
        this.defaultConnection = name;
      }
      
      logger.info(`数据库连接创建成功`, {
        dialect: config.dialect,
        name,
        host: config.host,
        database: config.database
      });
      
      return adapter;
    } catch (err) {
      logger.error(`数据库连接创建失败`, {
        error: err.message,
        dialect: config.dialect,
        name,
        host: config.host,
        database: config.database
      });
      
      throw err;
    }
  }
  
  /**
   * 注册模型
   * 
   * @param {string} name - 模型名称
   * @param {Object} schema - 模型定义
   * @param {string} connectionName - 连接名称
   * @returns {Object} 模型对象
   */
  registerModel(name, schema, connectionName = this.defaultConnection) {
    if (!connectionName) {
      throw new Error('未指定连接名称，且没有默认连接');
    }
    
    const connection = this.connections.get(connectionName);
    if (!connection) {
      throw new Error(`连接未找到: ${connectionName}`);
    }
    
    const model = connection.createModel(name, schema);
    this.models.set(name, { model, connectionName });
    
    logger.debug(`模型注册成功: ${name}`, { connectionName });
    
    return model;
  }
  
  /**
   * 获取模型
   * 
   * @param {string} name - 模型名称
   * @returns {Object} 模型对象
   */
  getModel(name) {
    const modelData = this.models.get(name);
    if (!modelData) {
      throw new Error(`模型未找到: ${name}`);
    }
    
    return modelData.model;
  }
  
  /**
   * 加载模型
   * 
   * @param {string} dir - 模型目录
   * @param {string} connectionName - 连接名称
   * @returns {Array} 已加载的模型列表
   */
  loadModels(dir, connectionName = this.defaultConnection) {
    if (!connectionName) {
      throw new Error('未指定连接名称，且没有默认连接');
    }
    
    const modelsDir = path.resolve(process.cwd(), dir);
    
    if (!fs.existsSync(modelsDir)) {
      logger.warn(`模型目录不存在: ${modelsDir}`);
      return [];
    }
    
    logger.info(`从目录加载模型: ${modelsDir}`, { connectionName });
    return this.modelLoader.loadFromDirectory(modelsDir, connectionName);
  }
  
  /**
   * 执行原始查询
   * 
   * @param {string} sql - SQL语句
   * @param {Array} params - 查询参数
   * @param {string} connectionName - 连接名称
   * @returns {Array} 查询结果
   */
  async query(sql, params, connectionName = this.defaultConnection) {
    if (!connectionName) {
      throw new Error('未指定连接名称，且没有默认连接');
    }
    
    const connection = this.connections.get(connectionName);
    if (!connection) {
      throw new Error(`连接未找到: ${connectionName}`);
    }
    
    return connection.query(sql, params);
  }
  
  /**
   * 执行事务
   * 
   * @param {Function} callback - 事务回调
   * @param {string} connectionName - 连接名称
   * @returns {*} 事务结果
   */
  async transaction(callback, connectionName = this.defaultConnection) {
    if (!connectionName) {
      throw new Error('未指定连接名称，且没有默认连接');
    }
    
    const connection = this.connections.get(connectionName);
    if (!connection) {
      throw new Error(`连接未找到: ${connectionName}`);
    }
    
    return connection.transaction(callback);
  }
  
  /**
   * 关闭所有数据库连接
   */
  async closeAll() {
    for (const [name, connection] of this.connections.entries()) {
      try {
        await connection.close();
        logger.info(`数据库连接已关闭: ${name}`);
      } catch (err) {
        logger.error(`关闭数据库连接出错: ${name}`, { error: err.message });
      }
    }
    
    this.connections.clear();
    this.models.clear();
    this.defaultConnection = null;
  }
  
  /**
   * 检查依赖是否已安装
   * 
   * @private
   * @param {string} dialect - 数据库类型
   */
  _checkDependencies(dialect) {
    const dependencies = {
      mysql: ['mysql2'],
      mariadb: ['mariadb'],
      postgres: ['pg', 'pg-hstore'],
      mongodb: ['mongoose'],
      sqlite: ['sqlite3']
    };
    
    const missing = [];
    for (const dep of dependencies[dialect] || []) {
      try {
        require(dep);
      } catch (err) {
        missing.push(dep);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(
        `使用 ${dialect} 数据库需要安装以下依赖: ${missing.join(', ')}\n` +
        `请运行: npm install --save ${missing.join(' ')}`
      );
    }
  }
  
  /**
   * 获取适配器类
   * 
   * @private
   * @param {string} dialect - 数据库类型
   * @returns {Class} 适配器类
   */
  async _getAdapter(dialect) {
    try {
      return require(`./adapters/${dialect}Adapter`);
    } catch (err) {
      throw new Error(`不支持的数据库类型: ${dialect}`);
    }
  }
}

module.exports = DatabaseManager; 