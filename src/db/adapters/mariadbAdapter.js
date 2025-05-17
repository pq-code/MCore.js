/**
 * MariaDB数据库适配器
 * 基于Sequelize的MariaDB实现
 * 
 * @class MariaDBAdapter
 */

const SequelizeAdapter = require('./SequelizeAdapter');

class MariaDBAdapter extends SequelizeAdapter {
  /**
   * 创建MariaDB适配器实例
   * 
   * @param {Object} config - 数据库配置
   */
  constructor(config) {
    super(config);
    this.dialect = 'mariadb';
  }
  
  /**
   * 连接数据库前检查依赖
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // 检查mariadb依赖
      try {
        require('mariadb');
      } catch (err) {
        throw new Error('使用MariaDB需要安装mariadb依赖: npm install --save mariadb');
      }
      
      // 调用父类的连接方法
      return super.connect();
    } catch (err) {
      throw err;
    }
  }
  
  /**
   * 获取模型选项
   * 
   * @protected
   * @param {Object} schema - 模型定义
   * @returns {Object} 模型选项
   */
  _getModelOptions(schema) {
    // 获取父类的模型选项
    const options = super._getModelOptions(schema);
    
    // 添加MariaDB特有选项
    return {
      ...options,
      charset: schema.charset || 'utf8mb4',
      collate: schema.collate || 'utf8mb4_unicode_ci'
    };
  }
}

module.exports = MariaDBAdapter; 