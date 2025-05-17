/**
 * 配置中心模块 - 提供统一的配置管理
 * 
 * @module config
 */

const ConfigManager = require('./ConfigManager');
const ConsulProvider = require('./providers/ConsulProvider');
const EtcdProvider = require('./providers/EtcdProvider');
const FileProvider = require('./providers/FileProvider');
const EnvProvider = require('./providers/EnvProvider');

/**
 * 创建配置管理器实例
 * 
 * @param {Object} options - 配置选项
 * @returns {ConfigManager} 配置管理器实例
 */
function createConfigManager(options = {}) {
  return new ConfigManager(options);
}

// 导出模块
module.exports = {
  createConfigManager,
  ConfigManager,
  providers: {
    ConsulProvider,
    EtcdProvider,
    FileProvider,
    EnvProvider
  }
}; 