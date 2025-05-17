/**
 * 服务注册与发现模块
 * 提供服务注册、服务发现和健康检查功能
 * 
 * @module registry
 */

const ConsulRegistry = require('./ConsulRegistry');
const RegistryFactory = require('./RegistryFactory');
const ServiceDiscovery = require('./ServiceDiscovery');

/**
 * 创建服务注册实例
 * 
 * @param {Object} options - 配置选项
 * @returns {Object} 服务注册实例
 */
function createRegistry(options = {}) {
  return RegistryFactory.create(options);
}

/**
 * 创建服务发现实例
 * 
 * @param {Object} options - 配置选项
 * @returns {ServiceDiscovery} 服务发现实例
 */
function createServiceDiscovery(options = {}) {
  return new ServiceDiscovery(options);
}

module.exports = {
  createRegistry,
  createServiceDiscovery,
  ConsulRegistry,
  ServiceDiscovery
}; 