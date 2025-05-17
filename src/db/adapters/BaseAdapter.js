/**
 * 基础数据库适配器
 * 所有数据库适配器必须继承此类并实现相应方法
 * 
 * @class BaseAdapter
 */

class BaseAdapter {
  /**
   * 创建适配器实例
   * 
   * @param {Object} config - 数据库配置
   */
  constructor(config) {
    this.config = config;
    this.connected = false;
    this.connection = null;
    this.models = new Map();
  }
  
  /**
   * 连接数据库
   * 子类必须实现此方法
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('必须由子类实现');
  }
  
  /**
   * 关闭数据库连接
   * 子类必须实现此方法
   * 
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('必须由子类实现');
  }
  
  /**
   * 创建模型
   * 子类必须实现此方法
   * 
   * @param {string} name - 模型名称
   * @param {Object} schema - 模型定义
   * @returns {Object} 模型对象
   */
  createModel(name, schema) {
    throw new Error('必须由子类实现');
  }
  
  /**
   * 执行原始查询
   * 子类必须实现此方法
   * 
   * @param {string} sql - SQL语句
   * @param {Array|Object} params - 查询参数
   * @returns {Promise<Array>} 查询结果
   */
  async query(sql, params) {
    throw new Error('必须由子类实现');
  }
  
  /**
   * 执行事务
   * 子类必须实现此方法
   * 
   * @param {Function} callback - 事务回调
   * @returns {Promise<any>} 事务结果
   */
  async transaction(callback) {
    throw new Error('必须由子类实现');
  }
  
  /**
   * 同步模型到数据库（创建表等）
   * 子类必须实现此方法
   * 
   * @param {Object} options - 同步选项
   * @returns {Promise<void>}
   */
  async sync(options = {}) {
    throw new Error('必须由子类实现');
  }
  
  /**
   * 获取模型
   * 
   * @param {string} name - 模型名称
   * @returns {Object} 模型对象
   */
  getModel(name) {
    if (!this.models.has(name)) {
      throw new Error(`模型未找到: ${name}`);
    }
    return this.models.get(name);
  }
  
  /**
   * 检查连接状态
   * 
   * @returns {boolean} 是否已连接
   */
  isConnected() {
    return this.connected;
  }
}

module.exports = BaseAdapter; 