/**
 * MySQL数据库适配器
 * 基于Sequelize的MySQL实现
 * 
 * @class MySQLAdapter
 */

const SequelizeAdapter = require('./SequelizeAdapter');

class MySQLAdapter extends SequelizeAdapter {
  /**
   * 创建MySQL适配器实例
   * 
   * @param {Object} config - 数据库配置
   */
  constructor(config) {
    super(config);
    this.dialect = 'mysql';
  }
  
  /**
   * 连接数据库前检查依赖
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // 检查mysql2依赖
      try {
        require('mysql2');
      } catch (err) {
        throw new Error('使用MySQL需要安装mysql2依赖: npm install --save mysql2');
      }
      
      // 调用父类的连接方法
      return super.connect();
    } catch (err) {
      throw err;
    }
  }
}

module.exports = MySQLAdapter; 