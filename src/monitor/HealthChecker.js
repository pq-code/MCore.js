/**
 * 健康检查器
 * 监控系统健康状态和依赖服务
 * 
 * @module monitor/HealthChecker
 */

const EventEmitter = require('events');
const os = require('os');
const logger = require('../logging').logger;

/**
 * 健康状态枚举
 */
const HEALTH_STATUS = {
  UP: 'UP',
  DOWN: 'DOWN',
  DEGRADED: 'DEGRADED'
};

/**
 * 健康检查器类
 */
class HealthChecker extends EventEmitter {
  /**
   * 创建健康检查器实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.serviceName - 服务名称
   * @param {number} options.checkInterval - 检查间隔（毫秒）
   * @param {boolean} options.includeDetails - 是否包含详细信息
   */
  constructor(options = {}) {
    super();
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'service';
    this.checkInterval = options.checkInterval || 60000; // 默认1分钟
    this.includeDetails = options.includeDetails !== false;
    this.startTime = Date.now();
    this.timer = null;
    this.checks = new Map();
    this.dependencies = new Map();
    this.isShuttingDown = false;
  }
  
  /**
   * 开始执行健康检查
   * 
   * @returns {HealthChecker} 当前实例，支持链式调用
   */
  start() {
    if (this.timer) {
      return this;
    }
    
    // 设置默认检查
    this._setupDefaultChecks();
    
    // 立即执行一次检查
    this._runChecks();
    
    // 设置定时器
    this.timer = setInterval(() => {
      this._runChecks();
    }, this.checkInterval);
    
    // 确保不会阻止进程退出
    if (this.timer.unref) {
      this.timer.unref();
    }
    
    logger.info(`健康检查器已启动，间隔: ${this.checkInterval}ms`);
    
    // 监听进程退出信号
    this._setupProcessListeners();
    
    return this;
  }
  
  /**
   * 停止健康检查
   * 
   * @returns {HealthChecker} 当前实例，支持链式调用
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('健康检查器已停止');
    }
    
    return this;
  }
  
  /**
   * 添加健康检查
   * 
   * @param {string} name - 检查名称
   * @param {Function} checkFn - 检查函数，返回检查结果对象或Promise
   * @param {Object} options - 选项
   * @param {boolean} options.critical - 是否为关键检查
   * @returns {HealthChecker} 当前实例，支持链式调用
   */
  addCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      name,
      checkFn,
      critical: options.critical !== false,
      status: HEALTH_STATUS.UP,
      lastCheck: null,
      lastSuccess: null,
      error: null,
      details: {}
    });
    
    return this;
  }
  
  /**
   * 添加依赖服务
   * 
   * @param {string} name - 依赖名称
   * @param {string} type - 依赖类型
   * @param {Object} options - 选项
   * @param {boolean} options.critical - 是否为关键依赖
   * @param {Function} options.checkFn - 检查函数
   * @returns {HealthChecker} 当前实例，支持链式调用
   */
  addDependency(name, type, options = {}) {
    const dependency = {
      name,
      type,
      critical: options.critical !== false,
      status: HEALTH_STATUS.UP,
      lastCheck: null,
      lastSuccess: null,
      error: null,
      details: {}
    };
    
    // 如果提供了检查函数，创建一个健康检查
    if (typeof options.checkFn === 'function') {
      const checkName = `dependency:${name}`;
      this.addCheck(checkName, options.checkFn, {
        critical: options.critical
      });
      
      dependency.checkName = checkName;
    }
    
    this.dependencies.set(name, dependency);
    
    return this;
  }
  
  /**
   * 设置依赖状态
   * 
   * @param {string} name - 依赖名称
   * @param {string} status - 健康状态
   * @param {Object} details - 详细信息
   * @returns {HealthChecker} 当前实例，支持链式调用
   */
  setDependencyStatus(name, status, details = {}) {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      logger.warn(`尝试设置未知依赖的状态: ${name}`);
      return this;
    }
    
    const oldStatus = dependency.status;
    dependency.status = status;
    dependency.lastCheck = Date.now();
    
    if (status === HEALTH_STATUS.UP) {
      dependency.lastSuccess = Date.now();
      dependency.error = null;
    } else {
      dependency.error = details.error || null;
    }
    
    dependency.details = details;
    
    // 触发状态变更事件
    if (oldStatus !== status) {
      this.emit('dependency-status-change', name, status, oldStatus, details);
    }
    
    return this;
  }
  
  /**
   * 获取健康检查结果
   * 
   * @param {Object} options - 选项
   * @param {boolean} options.includeDetails - 是否包含详细信息
   * @returns {Promise<Object>} 健康检查结果
   */
  async getHealth(options = {}) {
    const includeDetails = options.includeDetails !== undefined
      ? options.includeDetails
      : this.includeDetails;
    
    // 执行一次检查
    if (options.runChecks) {
      await this._runChecks();
    }
    
    // 计算整体状态
    const status = this._calculateOverallStatus();
    
    // 构建响应
    const health = {
      status,
      serviceName: this.serviceName,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0'
    };
    
    // 计算运行时信息
    if (includeDetails) {
      health.details = {
        checks: {},
        dependencies: {},
        system: this._getSystemInfo()
      };
      
      // 添加检查信息
      for (const [name, check] of this.checks.entries()) {
        health.details.checks[name] = {
          status: check.status,
          critical: check.critical,
          lastCheck: check.lastCheck,
          lastSuccess: check.lastSuccess,
          error: check.error ? check.error.message : null
        };
        
        if (check.details) {
          health.details.checks[name].details = check.details;
        }
      }
      
      // 添加依赖信息
      for (const [name, dependency] of this.dependencies.entries()) {
        health.details.dependencies[name] = {
          type: dependency.type,
          status: dependency.status,
          critical: dependency.critical,
          lastCheck: dependency.lastCheck,
          lastSuccess: dependency.lastSuccess,
          error: dependency.error ? dependency.error.message : null
        };
        
        if (dependency.details) {
          health.details.dependencies[name].details = dependency.details;
        }
      }
    }
    
    return health;
  }
  
  /**
   * 获取系统状态信息
   * 
   * @returns {Object} 系统状态信息
   */
  getInfo() {
    const info = {
      service: {
        name: this.serviceName,
        version: process.env.npm_package_version || '0.0.0',
        uptime: process.uptime(),
        startTime: new Date(this.startTime).toISOString()
      },
      system: this._getSystemInfo(),
      node: {
        version: process.version,
        env: process.env.NODE_ENV || 'development'
      }
    };
    
    return info;
  }
  
  /**
   * 设置默认健康检查
   * 
   * @private
   */
  _setupDefaultChecks() {
    // 内存使用检查
    this.addCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemoryPercent = (1 - (freeMemory / totalMemory)) * 100;
      
      // 如果内存使用率超过90%，标记为DOWN
      const status = usedMemoryPercent > 90 ? HEALTH_STATUS.DOWN : HEALTH_STATUS.UP;
      
      return {
        status,
        details: {
          total: totalMemory,
          free: freeMemory,
          usedPercent: usedMemoryPercent.toFixed(2),
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss
        }
      };
    }, { critical: false });
    
    // 磁盘空间检查（暂未实现，需要额外的模块）
    
    // 进程状态检查
    this.addCheck('process', async () => {
      return {
        status: this.isShuttingDown ? HEALTH_STATUS.DOWN : HEALTH_STATUS.UP,
        details: {
          pid: process.pid,
          uptime: process.uptime(),
          title: process.title
        }
      };
    });
  }
  
  /**
   * 设置进程监听器
   * 
   * @private
   */
  _setupProcessListeners() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    
    signals.forEach(signal => {
      process.once(signal, () => {
        logger.info(`收到${signal}信号，准备关闭服务`);
        this.isShuttingDown = true;
        
        // 触发事件
        this.emit('shutdown', signal);
      });
    });
  }
  
  /**
   * 执行所有健康检查
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _runChecks() {
    // 执行每个检查
    for (const [name, check] of this.checks.entries()) {
      try {
        check.lastCheck = Date.now();
        
        // 执行检查函数
        const result = await Promise.resolve(check.checkFn());
        
        // 更新检查状态
        const oldStatus = check.status;
        check.status = result.status || HEALTH_STATUS.UP;
        
        if (check.status === HEALTH_STATUS.UP) {
          check.lastSuccess = Date.now();
          check.error = null;
        } else {
          check.error = result.error || null;
        }
        
        check.details = result.details || {};
        
        // 触发状态变更事件
        if (oldStatus !== check.status) {
          this.emit('check-status-change', name, check.status, oldStatus, check.details);
          
          // 计算并触发整体状态变更
          this._emitOverallStatusChange();
        }
        
        // 如果是依赖检查，更新依赖状态
        for (const [depName, dependency] of this.dependencies.entries()) {
          if (dependency.checkName === name) {
            this.setDependencyStatus(depName, check.status, check.details);
          }
        }
        
      } catch (error) {
        // 检查失败
        const oldStatus = check.status;
        check.status = HEALTH_STATUS.DOWN;
        check.error = error;
        check.details = {
          error: error.message,
          stack: error.stack
        };
        
        // 触发状态变更事件
        if (oldStatus !== check.status) {
          this.emit('check-status-change', name, check.status, oldStatus, check.details);
          
          // 计算并触发整体状态变更
          this._emitOverallStatusChange();
        }
        
        // 如果是依赖检查，更新依赖状态
        for (const [depName, dependency] of this.dependencies.entries()) {
          if (dependency.checkName === name) {
            this.setDependencyStatus(depName, check.status, check.details);
          }
        }
        
        logger.error(`健康检查失败 [${name}]: ${error.message}`, {
          stack: error.stack
        });
      }
    }
  }
  
  /**
   * 计算整体健康状态
   * 
   * @private
   * @returns {string} 健康状态
   */
  _calculateOverallStatus() {
    let hasCriticalFailure = false;
    let hasNonCriticalFailure = false;
    
    // 检查所有检查状态
    for (const check of this.checks.values()) {
      if (check.status === HEALTH_STATUS.DOWN) {
        if (check.critical) {
          hasCriticalFailure = true;
          break;
        } else {
          hasNonCriticalFailure = true;
        }
      } else if (check.status === HEALTH_STATUS.DEGRADED) {
        hasNonCriticalFailure = true;
      }
    }
    
    // 检查所有依赖状态
    for (const dependency of this.dependencies.values()) {
      if (dependency.status === HEALTH_STATUS.DOWN) {
        if (dependency.critical) {
          hasCriticalFailure = true;
          break;
        } else {
          hasNonCriticalFailure = true;
        }
      } else if (dependency.status === HEALTH_STATUS.DEGRADED) {
        hasNonCriticalFailure = true;
      }
    }
    
    // 确定整体状态
    if (hasCriticalFailure) {
      return HEALTH_STATUS.DOWN;
    } else if (hasNonCriticalFailure) {
      return HEALTH_STATUS.DEGRADED;
    } else {
      return HEALTH_STATUS.UP;
    }
  }
  
  /**
   * 触发整体状态变更事件
   * 
   * @private
   */
  _emitOverallStatusChange() {
    const newStatus = this._calculateOverallStatus();
    
    // 缓存上一次状态
    if (!this._lastOverallStatus) {
      this._lastOverallStatus = newStatus;
      return;
    }
    
    // 检查是否有变化
    if (this._lastOverallStatus !== newStatus) {
      this.emit('status-change', newStatus, this._lastOverallStatus);
      this._lastOverallStatus = newStatus;
      
      // 记录日志
      const logLevel = newStatus === HEALTH_STATUS.UP ? 'info' : 'warn';
      logger[logLevel](`服务健康状态变更: ${this._lastOverallStatus} -> ${newStatus}`);
    }
  }
  
  /**
   * 获取系统信息
   * 
   * @private
   * @returns {Object} 系统信息
   */
  _getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usedPercent: ((1 - (os.freemem() / os.totalmem())) * 100).toFixed(2)
      },
      loadavg: os.loadavg(),
      uptime: os.uptime()
    };
  }
}

// 导出健康状态常量
HealthChecker.STATUS = HEALTH_STATUS;

module.exports = HealthChecker; 