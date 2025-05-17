/**
 * 模型加载器
 * 负责自动加载模型定义文件
 * 
 * @class ModelLoader
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const logger = require('../logging').logger;

class ModelLoader {
  /**
   * 创建模型加载器
   * 
   * @param {DatabaseManager} dbManager - 数据库管理器
   */
  constructor(dbManager) {
    this.dbManager = dbManager;
  }
  
  /**
   * 从目录加载模型
   * 
   * @param {string} directory - 模型目录
   * @param {string} connectionName - 连接名称
   * @returns {Array} 已加载的模型列表
   */
  loadFromDirectory(directory, connectionName) {
    const models = [];
    
    try {
      // 获取所有JS文件
      const files = glob.sync('**/*.js', { cwd: directory });
      
      logger.debug(`发现模型文件 ${files.length} 个`, { directory });
      
      // 加载每个文件
      for (const file of files) {
        const modelPath = path.join(directory, file);
        try {
          // 导入模型定义
          const modelDefinition = require(modelPath);
          
          // 支持不同的导出方式
          if (typeof modelDefinition === 'function') {
            // 如果是函数，则调用并传入数据库管理器
            const model = modelDefinition(this.dbManager);
            if (model && model.name) {
              models.push(model);
              logger.debug(`已加载模型 (函数方式): ${model.name}`, { file });
            }
          } else if (modelDefinition && modelDefinition.name && modelDefinition.schema) {
            // 如果是包含name和schema的对象
            const { name, schema } = modelDefinition;
            const model = this.dbManager.registerModel(name, schema, connectionName);
            models.push(model);
            logger.debug(`已加载模型 (对象方式): ${name}`, { file });
          } else {
            logger.warn(`无法识别的模型定义格式: ${file}`);
          }
        } catch (err) {
          logger.error(`加载模型出错: ${file}`, { error: err.message, stack: err.stack });
        }
      }
      
      logger.info(`已加载 ${models.length} 个模型`);
      
      return models;
    } catch (err) {
      logger.error('扫描模型目录出错', { directory, error: err.message, stack: err.stack });
      return [];
    }
  }
  
  /**
   * 加载单个模型文件
   * 
   * @param {string} filePath - 模型文件路径
   * @param {string} connectionName - 连接名称
   * @returns {Object|null} 模型对象
   */
  loadFromFile(filePath, connectionName) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        logger.warn(`模型文件不存在: ${filePath}`);
        return null;
      }
      
      // 导入模型定义
      const modelDefinition = require(filePath);
      
      // 支持不同的导出方式
      if (typeof modelDefinition === 'function') {
        // 如果是函数，则调用并传入数据库管理器
        const model = modelDefinition(this.dbManager);
        if (model && model.name) {
          logger.debug(`已加载模型 (函数方式): ${model.name}`, { file: filePath });
          return model;
        }
      } else if (modelDefinition && modelDefinition.name && modelDefinition.schema) {
        // 如果是包含name和schema的对象
        const { name, schema } = modelDefinition;
        const model = this.dbManager.registerModel(name, schema, connectionName);
        logger.debug(`已加载模型 (对象方式): ${name}`, { file: filePath });
        return model;
      } else {
        logger.warn(`无法识别的模型定义格式: ${filePath}`);
      }
      
      return null;
    } catch (err) {
      logger.error(`加载模型文件出错: ${filePath}`, { error: err.message, stack: err.stack });
      return null;
    }
  }
}

module.exports = ModelLoader; 