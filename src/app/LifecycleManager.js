/**
 * 应用生命周期管理器
 * 提供应用生命周期的统一管理和优雅关闭
 */

const { HOOK_NAMES } = require('../constants');

class LifecycleManager {
  /**
   * 创建生命周期管理器
   * @param {Object} app - 应用实例
   * @param {Object} options - 配置选项
   */
  constructor(app, options = {}) {
    this.app = app;
    this.logger = app.logger;
    this.config = {
      // 默认配置
      shutdownTimeout: 10000,  // 关闭超时时间（毫秒）
      gracefulShutdown: true,  // 是否启用优雅关闭
      // 合并用户配置
      ...options
    };
    
    // 应用状态
    this.state = {
      isRunning: false,
      startTime: null,
      isShuttingDown: false
    };
    
    // 注册进程事件处理
    this._registerProcessEvents();
  }
  
  /**
   * 注册进程事件处理
   * @private
   */
  _registerProcessEvents() {
    if (!this.config.gracefulShutdown) return;
    
    // 处理SIGTERM信号
    process.on('SIGTERM', () => {
      this.logger.info('收到SIGTERM信号，准备关闭应用');
      this.stop();
    });
    
    // 处理SIGINT信号
    process.on('SIGINT', () => {
      this.logger.info('收到SIGINT信号，准备关闭应用');
      this.stop();
    });
    
    // 处理未捕获的异常
    process.on('uncaughtException', (err) => {
      this.logger.error('未捕获的异常', { error: err });
      this.stop();
    });
    
    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason) => {
      this.logger.error('未处理的Promise拒绝', { reason });
      this.stop();
    });
  }
  
  /**
   * 启动应用
   * @returns {Promise<void>}
   */
  async start() {
    if (this.state.isRunning) {
      this.logger.warn('应用已经在运行中');
      return;
    }
    
    try {
      // 执行启动前钩子
      await this.app.hooks.execute(HOOK_NAMES.BEFORE_START, { app: this.app });
      
      // 启动HTTP服务器
      this.app.server = this.app.app.listen(this.app.options.port);
      
      // 更新应用状态
      this.state.isRunning = true;
      this.state.startTime = new Date();
      
      // 记录启动日志
      this.logger.info(`应用 ${this.app.options.name} 启动成功，监听端口: ${this.app.options.port}`);
      
      // 执行启动后钩子
      await this.app.hooks.execute(HOOK_NAMES.AFTER_START, { app: this.app });
    } catch (err) {
      this.logger.error(`应用启动失败: ${err.message}`, { error: err.stack });
      throw err;
    }
  }
  
  /**
   * 停止应用
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.state.isRunning || this.state.isShuttingDown) {
      return;
    }
    
    this.state.isShuttingDown = true;
    
    try {
      // 执行停止前钩子
      await this.app.hooks.execute(HOOK_NAMES.BEFORE_STOP, { app: this.app });
      
      // 设置关闭超时
      const timeout = setTimeout(() => {
        this.logger.error('应用关闭超时，强制退出');
        process.exit(1);
      }, this.config.shutdownTimeout);
      
      // 关闭HTTP服务器
      if (this.app.server) {
        await new Promise((resolve, reject) => {
          this.app.server.close((err) => {
            clearTimeout(timeout);
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      // 更新应用状态
      this.state.isRunning = false;
      this.state.isShuttingDown = false;
      
      // 记录停止日志
      const uptime = Date.now() - this.state.startTime.getTime();
      this.logger.info(`应用 ${this.app.options.name} 已停止，运行时间: ${uptime}ms`);
      
      // 执行停止后钩子
      await this.app.hooks.execute(HOOK_NAMES.AFTER_STOP, { app: this.app });
    } catch (err) {
      this.logger.error(`应用停止失败: ${err.message}`, { error: err.stack });
      throw err;
    }
  }
  
  /**
   * 重启应用
   * @returns {Promise<void>}
   */
  async restart() {
    this.logger.info('正在重启应用...');
    await this.stop();
    await this.start();
    this.logger.info('应用重启完成');
  }
  
  /**
   * 获取应用状态
   * @returns {Object} 应用状态信息
   */
  getStatus() {
    return {
      name: this.app.options.name,
      isRunning: this.state.isRunning,
      isShuttingDown: this.state.isShuttingDown,
      startTime: this.state.startTime,
      uptime: this.state.startTime ? Date.now() - this.state.startTime.getTime() : 0,
      pid: process.pid,
      memory: process.memoryUsage()
    };
  }
}

module.exports = LifecycleManager; 