/**
 * 审计服务类
 * 提供审计数据的存储和查询功能
 * 
 * @module audit/AuditService
 */

const { AUDIT_EVENT_TYPES } = require('./AuditLogger');
const logger = require('../logging').logger;

/**
 * 审计服务类
 */
class AuditService {
  /**
   * 创建审计服务实例
   * 
   * @param {Object} options - 配置选项
   * @param {Object} options.db - 数据库管理器
   * @param {AuditLogger} options.logger - 审计日志记录器
   * @param {Object} options.storage - 存储选项
   */
  constructor(options = {}) {
    // 数据库管理器
    this.db = options.db;
    
    // 存储方式：db（数据库）、file（文件）
    this.storageType = options.storage?.type || 'db';
    
    // 审计日志记录器
    this.logger = options.logger;
    
    // 初始化标志
    this.initialized = false;
    
    // 存储配置
    this.storageConfig = {
      // 审计表/集合名称
      tableName: options.storage?.tableName || 'audit_logs',
      
      // 数据库连接名称
      connectionName: options.storage?.connectionName || 'default',
      
      // 是否在内存中缓存
      cache: options.storage?.cache !== false,
      
      // 缓存大小
      cacheSize: options.storage?.cacheSize || 1000,
      
      // 批量写入大小
      batchSize: options.storage?.batchSize || 100,
      
      // 批量写入间隔（毫秒）
      batchInterval: options.storage?.batchInterval || 5000
    };
    
    // 内存缓存
    this.cache = [];
    
    // 批量写入定时器
    this.batchTimer = null;
  }
  
  /**
   * 初始化审计服务
   * 
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async init() {
    if (this.initialized) {
      return true;
    }
    
    try {
      // 如果使用数据库存储，确保数据库表/集合存在
      if (this.storageType === 'db' && this.db) {
        // 获取数据库连接
        const connection = this.db.getConnection(this.storageConfig.connectionName);
        
        if (!connection) {
          throw new Error(`数据库连接不存在: ${this.storageConfig.connectionName}`);
        }
        
        // 不同ORM的处理方式不同
        if (connection.sequelize) {
          // Sequelize
          await this._initSequelizeModel(connection);
        } else if (connection.mongoose) {
          // Mongoose
          await this._initMongooseModel(connection);
        } else {
          throw new Error('不支持的数据库类型');
        }
      }
      
      // 启动批量写入定时器
      if (this.storageConfig.cache) {
        this._startBatchTimer();
      }
      
      this.initialized = true;
      logger.info('审计服务已初始化');
      
      return true;
    } catch (err) {
      logger.error(`初始化审计服务失败: ${err.message}`, {
        stack: err.stack
      });
      return false;
    }
  }
  
  /**
   * 初始化Sequelize模型
   * 
   * @private
   * @param {Object} connection - 数据库连接
   * @returns {Promise<void>}
   */
  async _initSequelizeModel(connection) {
    const { DataTypes } = require('sequelize');
    
    // 创建审计日志模型
    const AuditLog = connection.sequelize.define(this.storageConfig.tableName, {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false
      },
      service: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      resourceType: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      resourceId: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      details: {
        type: DataTypes.JSON,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      environment: {
        type: DataTypes.STRING(20),
        allowNull: false
      }
    }, {
      tableName: this.storageConfig.tableName,
      timestamps: true,
      indexes: [
        {
          fields: ['type']
        },
        {
          fields: ['timestamp']
        },
        {
          fields: ['userId']
        },
        {
          fields: ['resourceType', 'resourceId']
        }
      ]
    });
    
    // 同步模型到数据库
    await AuditLog.sync();
    
    // 保存模型引用
    this.model = AuditLog;
  }
  
  /**
   * 初始化Mongoose模型
   * 
   * @private
   * @param {Object} connection - 数据库连接
   * @returns {Promise<void>}
   */
  async _initMongooseModel(connection) {
    const { Schema } = connection.mongoose;
    
    // 创建审计日志模式
    const auditLogSchema = new Schema({
      type: {
        type: String,
        required: true,
        index: true
      },
      action: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        required: true,
        index: true
      },
      service: {
        type: String,
        required: true
      },
      userId: {
        type: String,
        index: true
      },
      username: String,
      resourceType: {
        type: String,
        index: true
      },
      resourceId: String,
      details: Schema.Types.Mixed,
      metadata: Schema.Types.Mixed,
      environment: {
        type: String,
        required: true
      }
    }, {
      timestamps: true,
      collection: this.storageConfig.tableName
    });
    
    // 创建复合索引
    auditLogSchema.index({ resourceType: 1, resourceId: 1 });
    
    // 创建模型
    this.model = connection.mongoose.model('AuditLog', auditLogSchema);
  }
  
  /**
   * 启动批量写入定时器
   * 
   * @private
   */
  _startBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    this.batchTimer = setInterval(() => {
      this._flushCache();
    }, this.storageConfig.batchInterval);
    
    // 确保进程退出时刷新缓存
    process.on('beforeExit', () => {
      this._flushCache();
    });
  }
  
  /**
   * 刷新缓存到持久存储
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _flushCache() {
    if (this.cache.length === 0) {
      return;
    }
    
    const events = [...this.cache];
    this.cache = [];
    
    try {
      await this._storeEvents(events);
    } catch (err) {
      logger.error(`刷新审计日志缓存失败: ${err.message}`, {
        stack: err.stack,
        count: events.length
      });
      
      // 如果失败，将事件放回缓存
      this.cache = [...events, ...this.cache];
      
      // 如果缓存太大，删除一些旧事件防止内存泄漏
      if (this.cache.length > this.storageConfig.cacheSize * 2) {
        this.cache = this.cache.slice(-this.storageConfig.cacheSize);
        logger.warn('审计日志缓存过大，删除旧事件');
      }
    }
  }
  
  /**
   * 存储事件到持久存储
   * 
   * @private
   * @param {Array<Object>} events - 事件列表
   * @returns {Promise<void>}
   */
  async _storeEvents(events) {
    if (!this.initialized) {
      await this.init();
    }
    
    if (events.length === 0) {
      return;
    }
    
    if (this.storageType === 'db' && this.model) {
      // 数据库存储
      if (this.model.bulkCreate) {
        // Sequelize批量创建
        await this.model.bulkCreate(events);
      } else if (this.model.insertMany) {
        // Mongoose批量创建
        await this.model.insertMany(events);
      } else {
        // 逐个创建
        for (const event of events) {
          await this.model.create(event);
        }
      }
    } else if (this.logger) {
      // 日志记录器存储
      for (const event of events) {
        this.logger.log(event);
      }
    }
  }
  
  /**
   * 记录审计事件
   * 
   * @param {Object} event - 审计事件
   * @returns {Promise<boolean>} 是否记录成功
   */
  async record(event) {
    try {
      // 添加必要字段
      const auditEvent = {
        ...event,
        timestamp: event.timestamp || new Date(),
        service: event.service || process.env.SERVICE_NAME || 'unknown',
        environment: event.environment || process.env.NODE_ENV || 'development'
      };
      
      // 如果启用缓存，添加到缓存
      if (this.storageConfig.cache) {
        this.cache.push(auditEvent);
        
        // 如果缓存达到批量写入大小，立即刷新
        if (this.cache.length >= this.storageConfig.batchSize) {
          this._flushCache();
        }
        
        return true;
      } else {
        // 否则直接存储
        await this._storeEvents([auditEvent]);
        return true;
      }
    } catch (err) {
      logger.error(`记录审计事件失败: ${err.message}`, {
        stack: err.stack,
        event
      });
      return false;
    }
  }
  
  /**
   * 查询审计日志
   * 
   * @param {Object} query - 查询条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async query(query = {}, options = {}) {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      if (this.storageType === 'db' && this.model) {
        const { limit = 20, offset = 0, sort = { timestamp: -1 } } = options;
        
        if (this.model.findAndCountAll) {
          // Sequelize查询
          return await this.model.findAndCountAll({
            where: query,
            limit,
            offset,
            order: Object.entries(sort).map(([key, value]) => [key, value === 1 ? 'ASC' : 'DESC']),
            raw: true
          });
        } else if (this.model.find) {
          // Mongoose查询
          const total = await this.model.countDocuments(query);
          const results = await this.model.find(query)
            .sort(sort)
            .skip(offset)
            .limit(limit)
            .lean();
          
          return {
            count: total,
            rows: results
          };
        }
      }
      
      return { count: 0, rows: [] };
    } catch (err) {
      logger.error(`查询审计日志失败: ${err.message}`, {
        stack: err.stack,
        query,
        options
      });
      throw err;
    }
  }
  
  /**
   * 获取指定资源的审计日志
   * 
   * @param {string} resourceType - 资源类型
   * @param {string} resourceId - 资源ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 审计日志列表
   */
  async getResourceHistory(resourceType, resourceId, options = {}) {
    return this.query(
      { resourceType, resourceId },
      options
    );
  }
  
  /**
   * 获取用户操作历史
   * 
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 审计日志列表
   */
  async getUserHistory(userId, options = {}) {
    return this.query(
      { userId },
      options
    );
  }
  
  /**
   * 清空审计日志
   * 
   * @param {Object} options - 清空选项
   * @param {Date} options.before - 删除此日期之前的日志
   * @returns {Promise<number>} 删除的记录数
   */
  async clear(options = {}) {
    if (!this.initialized) {
      await this.init();
    }
    
    try {
      // 刷新缓存
      await this._flushCache();
      
      if (this.storageType === 'db' && this.model) {
        const query = {};
        
        if (options.before) {
          query.timestamp = { $lt: options.before };
        }
        
        if (this.model.destroy) {
          // Sequelize删除
          return await this.model.destroy({
            where: query
          });
        } else if (this.model.deleteMany) {
          // Mongoose删除
          const result = await this.model.deleteMany(query);
          return result.deletedCount;
        }
      }
      
      return 0;
    } catch (err) {
      logger.error(`清空审计日志失败: ${err.message}`, {
        stack: err.stack,
        options
      });
      throw err;
    }
  }
  
  /**
   * 关闭审计服务
   * 
   * @returns {Promise<void>}
   */
  async close() {
    // 停止批量写入定时器
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    
    // 刷新缓存
    await this._flushCache();
    
    this.initialized = false;
    logger.info('审计服务已关闭');
  }
}

module.exports = AuditService; 