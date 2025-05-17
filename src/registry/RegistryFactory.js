/**
 * 服务注册工厂
 * 提供统一的服务注册实例创建方法
 * 
 * @module registry/RegistryFactory
 */

const ConsulRegistry = require('./ConsulRegistry');
const logger = require('../logging').logger;

/**
 * 注册类型枚举
 */
const REGISTRY_TYPES = {
  CONSUL: 'consul',
  NONE: 'none'
};

/**
 * 服务注册工厂类
 */
class RegistryFactory {
  /**
   * 创建服务注册实例
   * 
   * @static
   * @param {Object} options - 配置选项
   * @param {string} options.type - 注册中心类型，可选值：consul, none
   * @returns {Object} 服务注册实例
   */
  static create(options = {}) {
    // 默认使用consul
    const type = (options.type || process.env.REGISTRY_TYPE || REGISTRY_TYPES.CONSUL).toLowerCase();
    
    switch (type) {
    case REGISTRY_TYPES.CONSUL:
      return new ConsulRegistry(options);
    case REGISTRY_TYPES.NONE:
      return RegistryFactory.createNoneRegistry();
    default:
      logger.warn(`未知的注册中心类型: ${type}，将使用空注册`);
      return RegistryFactory.createNoneRegistry();
    }
  }
  
  /**
   * 创建空注册中心实例
   * 
   * @static
   * @returns {Object} 空注册中心实例
   */
  static createNoneRegistry() {
    return {
      register: async () => Promise.resolve(),
      deregister: async () => Promise.resolve(),
      isRegistered: () => false,
      getService: () => null,
      getAllServices: () => []
    };
  }
}

module.exports = RegistryFactory; 