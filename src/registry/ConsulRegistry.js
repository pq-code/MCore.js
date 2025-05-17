/**
 * Consul服务注册实现
 * 提供与Consul集成的服务注册与发现功能
 * 
 * @module registry/ConsulRegistry
 */

const Consul = require('consul');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const logger = require('../logging').logger;

/**
 * Consul服务注册类
 */
class ConsulRegistry {
  /**
   * 创建Consul注册实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.host - Consul主机地址
   * @param {number} options.port - Consul端口
   * @param {boolean} options.secure - 是否使用HTTPS
   * @param {string} options.dc - 数据中心
   * @param {Object} options.defaults - Consul默认选项
   */
  constructor(options = {}) {
    // Consul连接配置
    this.config = {
      host: options.host || process.env.CONSUL_HOST || 'localhost',
      port: options.port || process.env.CONSUL_PORT || 8500,
      secure: options.secure || process.env.CONSUL_SECURE === 'true' || false,
      defaults: options.defaults || {}
    };
    
    if (options.dc) {
      this.config.defaults.dc = options.dc;
    }
    
    // 创建Consul客户端
    try {
      this.consul = new Consul(this.config);
      logger.info(`Consul客户端已创建: ${this.config.host}:${this.config.port}`);
    } catch (err) {
      logger.error(`创建Consul客户端失败: ${err.message}`);
      throw err;
    }
    
    // 服务实例ID
    this.instanceId = null;
    
    // 服务信息
    this.serviceInfo = null;
  }
  
  /**
   * 注册服务到Consul
   * 
   * @param {Object} service - 服务信息
   * @param {string} service.name - 服务名称
   * @param {string} service.id - 服务ID
   * @param {Array<string>} service.tags - 服务标签
   * @param {string} service.address - 服务地址
   * @param {number} service.port - 服务端口
   * @param {Object} service.check - 健康检查配置
   * @returns {Promise<boolean>} 是否注册成功
   */
  async register(service = {}) {
    try {
      // 服务ID，如果未提供则生成
      const id = service.id || `${service.name}-${uuidv4()}`;
      
      // 构建注册信息
      const registration = {
        name: service.name,
        id: id,
        tags: service.tags || ['microservice', 'nodejs'],
        address: service.address || this._getLocalIP(),
        port: service.port || parseInt(process.env.PORT, 10) || 3000,
        check: service.check || {
          http: `http://${service.address || this._getLocalIP()}:${service.port || parseInt(process.env.PORT, 10) || 3000}/api/v1/health`,
          interval: '10s',
          timeout: '2s'
        }
      };
      
      // 注册服务
      await this.consul.agent.service.register(registration);
      
      // 保存服务信息
      this.instanceId = id;
      this.serviceInfo = registration;
      
      logger.info(`服务已注册到Consul: ${registration.name} (${registration.id})`, {
        address: registration.address,
        port: registration.port
      });
      
      return true;
    } catch (err) {
      logger.error(`服务注册到Consul失败: ${err.message}`, {
        stack: err.stack,
        service: service.name
      });
      return false;
    }
  }
  
  /**
   * 从Consul注销服务
   * 
   * @param {string} serviceId - 服务ID，如果不提供则使用实例ID
   * @returns {Promise<boolean>} 是否注销成功
   */
  async deregister(serviceId = null) {
    const id = serviceId || this.instanceId;
    
    if (!id) {
      logger.warn('注销服务失败: 未提供服务ID且实例未注册');
      return false;
    }
    
    try {
      await this.consul.agent.service.deregister(id);
      
      if (id === this.instanceId) {
        this.instanceId = null;
        this.serviceInfo = null;
      }
      
      logger.info(`服务已从Consul注销: ${id}`);
      return true;
    } catch (err) {
      logger.error(`从Consul注销服务失败: ${err.message}`, {
        stack: err.stack,
        serviceId: id
      });
      return false;
    }
  }
  
  /**
   * 检查服务是否已注册
   * 
   * @param {string} serviceId - 服务ID，如果不提供则使用实例ID
   * @returns {Promise<boolean>} 是否已注册
   */
  async isRegistered(serviceId = null) {
    const id = serviceId || this.instanceId;
    
    if (!id) {
      return false;
    }
    
    try {
      const services = await this.consul.agent.service.list();
      return !!services[id];
    } catch (err) {
      logger.error(`检查服务注册状态失败: ${err.message}`, {
        stack: err.stack,
        serviceId: id
      });
      return false;
    }
  }
  
  /**
   * 根据服务名称获取服务实例
   * 
   * @param {string} serviceName - 服务名称
   * @param {Object} options - 查询选项
   * @param {boolean} options.passing - 是否只返回健康检查通过的服务
   * @param {string} options.tag - 服务标签过滤
   * @param {string} options.dc - 数据中心
   * @returns {Promise<Array>} 服务实例列表
   */
  async getService(serviceName, options = {}) {
    try {
      const queryOptions = {
        passing: options.passing !== false,
        ...options
      };
      
      const result = await this.consul.catalog.service.nodes({
        service: serviceName,
        ...queryOptions
      });
      
      return result;
    } catch (err) {
      logger.error(`获取服务实例失败: ${err.message}`, {
        stack: err.stack,
        serviceName
      });
      return [];
    }
  }
  
  /**
   * 获取所有服务
   * 
   * @returns {Promise<Object>} 所有服务列表
   */
  async getAllServices() {
    try {
      const services = await this.consul.catalog.service.list();
      return services;
    } catch (err) {
      logger.error(`获取所有服务失败: ${err.message}`, {
        stack: err.stack
      });
      return {};
    }
  }
  
  /**
   * 获取KV值
   * 
   * @param {string} key - 键名
   * @param {Object} options - 选项
   * @returns {Promise<string|null>} 值或null
   */
  async get(key, options = {}) {
    try {
      const result = await this.consul.kv.get(key, options);
      return result ? result.Value : null;
    } catch (err) {
      logger.error(`获取Consul KV失败: ${err.message}`, {
        stack: err.stack,
        key
      });
      return null;
    }
  }
  
  /**
   * 设置KV值
   * 
   * @param {string} key - 键名
   * @param {string} value - 值
   * @param {Object} options - 选项
   * @returns {Promise<boolean>} 是否成功
   */
  async set(key, value, options = {}) {
    try {
      await this.consul.kv.set(key, value, options);
      return true;
    } catch (err) {
      logger.error(`设置Consul KV失败: ${err.message}`, {
        stack: err.stack,
        key
      });
      return false;
    }
  }
  
  /**
   * 获取本地IP地址
   * 
   * @private
   * @returns {string} 本地IP地址
   */
  _getLocalIP() {
    const interfaces = os.networkInterfaces();
    let address = 'localhost';
    
    // 遍历网络接口
    for (const interfaceName of Object.keys(interfaces)) {
      const interfaceInfo = interfaces[interfaceName];
      
      // 查找IPv4，非内部地址
      const ip = interfaceInfo.find(info => {
        return info.family === 'IPv4' && !info.internal;
      });
      
      if (ip) {
        address = ip.address;
        break;
      }
    }
    
    return address;
  }
}

module.exports = ConsulRegistry; 