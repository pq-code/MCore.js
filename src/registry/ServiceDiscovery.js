/**
 * 服务发现类
 * 提供服务发现和负载均衡功能
 * 
 * @module registry/ServiceDiscovery
 */

const http = require('http');
const https = require('https');
const logger = require('../logging').logger;
const RegistryFactory = require('./RegistryFactory');
const { URL } = require('url');

/**
 * 负载均衡策略枚举
 */
const LOAD_BALANCE_STRATEGY = {
  RANDOM: 'random',
  ROUND_ROBIN: 'round-robin',
  LEAST_CONNECTIONS: 'least-connections',
  IP_HASH: 'ip-hash',
  CONSISTENT_HASH: 'consistent-hash',
  WEIGHTED: 'weighted'
};

/**
 * 服务发现类
 */
class ServiceDiscovery {
  /**
   * 创建服务发现实例
   * 
   * @param {Object} options - 配置选项
   * @param {Object} options.registry - 注册中心配置，如果不提供则使用环境变量创建
   * @param {string} options.loadBalanceStrategy - 负载均衡策略
   * @param {boolean} options.cache - 是否缓存服务列表
   * @param {number} options.cacheTTL - 缓存过期时间（毫秒）
   * @param {Object} options.timeouts - 超时设置
   */
  constructor(options = {}) {
    // 创建注册中心
    this.registry = options.registry || RegistryFactory.create(options);
    
    // 负载均衡策略
    this.loadBalanceStrategy = options.loadBalanceStrategy || 
      process.env.LOAD_BALANCE_STRATEGY || 
      LOAD_BALANCE_STRATEGY.ROUND_ROBIN;
    
    // 服务缓存
    this.cache = options.cache !== false;
    this.cacheTTL = options.cacheTTL || 10000; // 默认10秒过期
    
    // 服务缓存对象
    this.serviceCache = new Map();
    
    // 服务计数器（用于轮询负载均衡）
    this.serviceCounters = new Map();
    
    // 超时设置
    this.timeouts = {
      connect: options.timeouts?.connect || 2000,  // 连接超时
      request: options.timeouts?.request || 5000,  // 请求超时
      socket: options.timeouts?.socket || 10000    // Socket超时
    };
  }
  
  /**
   * 发现服务
   * 
   * @param {string} serviceName - 服务名称
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 服务实例列表
   */
  async discover(serviceName, options = {}) {
    // 检查缓存
    if (this.cache) {
      const cached = this.serviceCache.get(serviceName);
      if (cached && cached.expires > Date.now()) {
        return cached.instances;
      }
    }
    
    // 查询服务注册中心
    const instances = await this.registry.getService(serviceName, options);
    
    // 更新缓存
    if (this.cache && instances.length > 0) {
      this.serviceCache.set(serviceName, {
        instances,
        expires: Date.now() + this.cacheTTL
      });
    }
    
    return instances;
  }
  
  /**
   * 根据负载均衡策略选择服务实例
   * 
   * @param {Array} instances - 服务实例列表
   * @param {string} serviceName - 服务名称
   * @param {Object} context - 上下文信息
   * @returns {Object} 选中的服务实例
   */
  selectInstance(instances, serviceName, context = {}) {
    if (!instances || instances.length === 0) {
      return null;
    }
    
    if (instances.length === 1) {
      return instances[0];
    }
    
    // 根据负载均衡策略选择实例
    switch (this.loadBalanceStrategy) {
    case LOAD_BALANCE_STRATEGY.RANDOM:
      return this._selectRandom(instances);
        
    case LOAD_BALANCE_STRATEGY.ROUND_ROBIN:
      return this._selectRoundRobin(instances, serviceName);
        
    case LOAD_BALANCE_STRATEGY.IP_HASH:
      return this._selectIPHash(instances, context.clientIP);
        
      // 其他策略暂时使用随机选择
    default:
      logger.warn(`不支持的负载均衡策略: ${this.loadBalanceStrategy}，将使用随机策略`);
      return this._selectRandom(instances);
    }
  }
  
  /**
   * 调用服务接口
   * 
   * @param {string} serviceName - 服务名称
   * @param {Object} options - 请求选项
   * @param {string} options.path - 请求路径
   * @param {string} options.method - 请求方法
   * @param {Object} options.headers - 请求头
   * @param {Object|string} options.data - 请求数据
   * @param {Object} options.context - 上下文信息
   * @returns {Promise<Object>} 响应结果
   */
  async call(serviceName, options = {}) {
    try {
      // 发现服务实例
      const instances = await this.discover(serviceName, { passing: true });
      
      if (!instances || instances.length === 0) {
        throw new Error(`服务未找到: ${serviceName}`);
      }
      
      // 选择服务实例
      const instance = this.selectInstance(instances, serviceName, options.context);
      
      if (!instance) {
        throw new Error(`没有可用的服务实例: ${serviceName}`);
      }
      
      // 构建请求URL
      const protocol = options.secure ? 'https:' : 'http:';
      const url = new URL(options.path || '/', `${protocol}//${instance.ServiceAddress}:${instance.ServicePort}`);
      
      // 发起请求
      return await this._request({
        url: url.toString(),
        method: options.method || 'GET',
        headers: options.headers || {},
        data: options.data,
        timeout: options.timeout || this.timeouts.request
      });
    } catch (err) {
      logger.error(`调用服务失败: ${err.message}`, {
        stack: err.stack,
        serviceName,
        path: options.path
      });
      throw err;
    }
  }
  
  /**
   * 发送HTTP请求
   * 
   * @private
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 响应结果
   */
  _request(options) {
    return new Promise((resolve, reject) => {
      const url = new URL(options.url);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method,
        headers: options.headers || {},
        timeout: options.timeout || this.timeouts.request
      };
      
      // 设置默认内容类型
      if (options.data && !requestOptions.headers['Content-Type']) {
        requestOptions.headers['Content-Type'] = 'application/json';
      }
      
      const req = client.request(requestOptions, res => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          let responseData;
          
          // 尝试解析JSON响应
          if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
            try {
              responseData = JSON.parse(data);
            } catch (err) {
              responseData = data;
            }
          } else {
            responseData = data;
          }
          
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        });
      });
      
      // 错误处理
      req.on('error', err => {
        reject(err);
      });
      
      // 超时处理
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`请求超时: ${options.url}`));
      });
      
      // 发送请求数据
      if (options.data) {
        const data = typeof options.data === 'string' ? 
          options.data : 
          JSON.stringify(options.data);
        
        req.write(data);
      }
      
      req.end();
    });
  }
  
  /**
   * 随机选择服务实例
   * 
   * @private
   * @param {Array} instances - 服务实例列表
   * @returns {Object} 选中的服务实例
   */
  _selectRandom(instances) {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }
  
  /**
   * 轮询选择服务实例
   * 
   * @private
   * @param {Array} instances - 服务实例列表
   * @param {string} serviceName - 服务名称
   * @returns {Object} 选中的服务实例
   */
  _selectRoundRobin(instances, serviceName) {
    // 获取或初始化计数器
    let counter = this.serviceCounters.get(serviceName) || 0;
    
    // 选择实例
    const instance = instances[counter % instances.length];
    
    // 更新计数器
    counter = (counter + 1) % 1000000; // 防止溢出
    this.serviceCounters.set(serviceName, counter);
    
    return instance;
  }
  
  /**
   * 根据IP哈希选择服务实例
   * 
   * @private
   * @param {Array} instances - 服务实例列表
   * @param {string} clientIP - 客户端IP
   * @returns {Object} 选中的服务实例
   */
  _selectIPHash(instances, clientIP) {
    if (!clientIP) {
      return this._selectRandom(instances);
    }
    
    // 简单的IP哈希
    let hash = 0;
    for (let i = 0; i < clientIP.length; i++) {
      hash = (hash * 31 + clientIP.charCodeAt(i)) % 1000000;
    }
    
    const index = hash % instances.length;
    return instances[index];
  }
}

module.exports = ServiceDiscovery; 