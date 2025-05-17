/**
 * Sequelize通用适配器基类
 * 为基于Sequelize的数据库适配器提供公共实现
 * 
 * @class SequelizeAdapter
 */

const { Sequelize, DataTypes } = require('sequelize');
const BaseAdapter = require('./BaseAdapter');
const logger = require('../../logging').logger;

class SequelizeAdapter extends BaseAdapter {
  /**
   * 创建Sequelize适配器实例
   * 
   * @param {Object} config - 数据库配置
   */
  constructor(config) {
    super(config);
    this.sequelize = null;
    this.dialect = this.config.dialect || 'mysql';
  }
  
  /**
   * 连接数据库
   * 子类应重写此方法以检查特定依赖
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // 创建Sequelize实例
      this.sequelize = new Sequelize({
        dialect: this.dialect,
        host: this.config.host || 'localhost',
        port: this.config.port || 3306,
        database: this.config.database,
        username: this.config.username,
        password: this.config.password,
        pool: this.config.pool || {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        logging: this.config.logging === true 
          ? msg => logger.debug(msg) 
          : false,
        dialectOptions: this.config.dialectOptions || {},
        ...this.config.options
      });
      
      // 测试连接
      await this.sequelize.authenticate();
      this.connected = true;
      this.connection = this.sequelize;
      
      logger.info(`${this.dialect} 连接成功`, {
        host: this.config.host,
        database: this.config.database
      });
      
      return this.sequelize;
    } catch (err) {
      logger.error(`${this.dialect} 连接失败`, {
        error: err.message,
        host: this.config.host,
        database: this.config.database
      });
      
      throw err;
    }
  }
  
  /**
   * 关闭数据库连接
   * 
   * @returns {Promise<void>}
   */
  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.connected = false;
      this.connection = null;
      logger.info(`${this.dialect} 连接已关闭`);
    }
  }
  
  /**
   * 创建模型
   * 
   * @param {string} name - 模型名称
   * @param {Object} schema - 模型定义
   * @returns {Object} 模型对象
   */
  createModel(name, schema) {
    if (!this.sequelize) {
      throw new Error('数据库未连接');
    }
    
    // 转换schema为Sequelize格式
    const modelAttributes = this._convertSchema(schema);
    
    // 创建Sequelize模型
    const model = this.sequelize.define(name, modelAttributes, this._getModelOptions(schema));
    
    // 保存模型引用
    this.models.set(name, model);
    
    // 处理关联关系
    if (schema.relations) {
      // 延迟处理关联，确保所有模型都已定义
      process.nextTick(() => {
        this._setupRelations(name, schema.relations);
      });
    }
    
    logger.debug(`创建 ${this.dialect} 模型: ${name}`);
    
    return model;
  }
  
  /**
   * 获取模型选项
   * 
   * @protected
   * @param {Object} schema - 模型定义
   * @returns {Object} 模型选项
   */
  _getModelOptions(schema) {
    return {
      tableName: schema.tableName || schema.name.toLowerCase(),
      timestamps: schema.timestamps !== false,
      paranoid: schema.paranoid === true,
      underscored: schema.underscored === true,
      ...schema.options
    };
  }
  
  /**
   * 执行原始查询
   * 
   * @param {string} sql - SQL语句
   * @param {Array|Object} params - 查询参数
   * @returns {Promise<Array>} 查询结果
   */
  async query(sql, params) {
    if (!this.sequelize) {
      throw new Error('数据库未连接');
    }
    
    return this.sequelize.query(sql, {
      replacements: params,
      type: Sequelize.QueryTypes.SELECT
    });
  }
  
  /**
   * 执行事务
   * 
   * @param {Function} callback - 事务回调
   * @returns {Promise<any>} 事务结果
   */
  async transaction(callback) {
    if (!this.sequelize) {
      throw new Error('数据库未连接');
    }
    
    try {
      return await this.sequelize.transaction(callback);
    } catch (err) {
      logger.error('事务执行失败', { error: err.message });
      throw err;
    }
  }
  
  /**
   * 同步模型到数据库（创建表等）
   * 
   * @param {Object} options - 同步选项
   * @returns {Promise<void>}
   */
  async sync(options = {}) {
    if (!this.sequelize) {
      throw new Error('数据库未连接');
    }
    
    try {
      await this.sequelize.sync(options);
      logger.info('数据库同步完成', { force: options.force === true });
    } catch (err) {
      logger.error('数据库同步失败', { error: err.message });
      throw err;
    }
  }
  
  /**
   * 转换模型定义为Sequelize格式
   * 
   * @protected
   * @param {Object} schema - 模型定义
   * @returns {Object} Sequelize格式的模型定义
   */
  _convertSchema(schema) {
    const attributes = {};
    const skipFields = ['tableName', 'timestamps', 'paranoid', 'underscored', 'options', 'relations', 'charset', 'collate'];
    
    // 处理字段定义
    for (const [field, definition] of Object.entries(schema)) {
      // 跳过非字段属性
      if (skipFields.includes(field)) {
        continue;
      }
      
      // 如果是简单类型字符串
      if (typeof definition === 'string') {
        attributes[field] = {
          type: this._getDataType(definition)
        };
      } 
      // 如果是对象定义
      else if (typeof definition === 'object') {
        attributes[field] = {
          type: this._getDataType(definition.type),
          allowNull: definition.allowNull !== false,
          defaultValue: definition.defaultValue,
          primaryKey: definition.primaryKey === true,
          unique: definition.unique === true,
          autoIncrement: definition.autoIncrement === true,
          comment: definition.comment
        };
        
        // 处理特殊属性
        if (definition.validate) {
          attributes[field].validate = definition.validate;
        }
        
        // 处理字符集和排序规则
        if (definition.charset) {
          attributes[field].charset = definition.charset;
        }
        
        if (definition.collate) {
          attributes[field].collate = definition.collate;
        }
      }
    }
    
    return attributes;
  }
  
  /**
   * 获取Sequelize数据类型
   * 
   * @protected
   * @param {string} type - 类型名称
   * @returns {Object} Sequelize数据类型
   */
  _getDataType(type) {
    if (!type) return DataTypes.STRING;
    
    const typeMap = {
      'STRING': DataTypes.STRING,
      'TEXT': DataTypes.TEXT,
      'BOOLEAN': DataTypes.BOOLEAN,
      'INTEGER': DataTypes.INTEGER,
      'BIGINT': DataTypes.BIGINT,
      'FLOAT': DataTypes.FLOAT,
      'DOUBLE': DataTypes.DOUBLE,
      'DECIMAL': DataTypes.DECIMAL,
      'DATE': DataTypes.DATE,
      'DATEONLY': DataTypes.DATEONLY,
      'TIME': DataTypes.TIME,
      'JSON': DataTypes.JSON,
      'JSONB': DataTypes.JSONB,
      'UUID': DataTypes.UUID,
      'ENUM': DataTypes.ENUM
    };
    
    return typeMap[type.toUpperCase()] || DataTypes.STRING;
  }
  
  /**
   * 设置模型间的关联关系
   * 
   * @protected
   * @param {string} modelName - 模型名称
   * @param {Object} relations - 关联关系定义
   */
  _setupRelations(modelName, relations) {
    const model = this.models.get(modelName);
    
    if (!model || !relations) return;
    
    for (const [relationType, relationDefs] of Object.entries(relations)) {
      // 支持多个同类型关联
      const relationList = Array.isArray(relationDefs) ? relationDefs : [relationDefs];
      
      for (const relation of relationList) {
        const targetModel = this.models.get(relation.model);
        
        if (!targetModel) {
          logger.warn(`关联目标模型不存在: ${relation.model}`);
          continue;
        }
        
        // 设置关联关系
        switch (relationType.toLowerCase()) {
        case 'hasone':
          model.hasOne(targetModel, relation.options);
          break;
        case 'belongsto':
          model.belongsTo(targetModel, relation.options);
          break;
        case 'hasmany':
          model.hasMany(targetModel, relation.options);
          break;
        case 'belongstomany':
          const through = relation.through;
          if (!through) {
            logger.warn('belongsToMany关联需要指定through选项');
            continue;
          }
          model.belongsToMany(targetModel, { through, ...relation.options });
          break;
        default:
          logger.warn(`未知的关联类型: ${relationType}`);
        }
      }
    }
  }
}

module.exports = SequelizeAdapter; 