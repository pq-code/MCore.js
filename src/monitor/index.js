/**
 * 监控模块 - 提供系统监控和指标收集功能
 * 
 * @module monitor
 */

const MetricsCollector = require('./MetricsCollector');
const HealthChecker = require('./HealthChecker');
const middleware = require('./middleware');

/**
 * 创建指标收集器实例
 * 
 * @param {Object} options - 配置选项
 * @returns {MetricsCollector} 指标收集器实例
 */
function createMetricsCollector(options = {}) {
  return new MetricsCollector(options);
}

/**
 * 创建健康检查器实例
 * 
 * @param {Object} options - 配置选项
 * @returns {HealthChecker} 健康检查器实例
 */
function createHealthChecker(options = {}) {
  return new HealthChecker(options);
}

// 导出模块
module.exports = {
  createMetricsCollector,
  createHealthChecker,
  MetricsCollector,
  HealthChecker,
  middleware
}; 