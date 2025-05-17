/**
 * 钩子系统模块
 * 提供事件钩子注册和执行的功能
 * 
 * @module hooks
 */

const HookManager = require('./HookManager');
const HookContext = require('./HookContext');
const { HOOK_NAMES } = require('../constants');

/**
 * 创建钩子管理器实例
 * 
 * @returns {HookManager} 钩子管理器实例
 */
function createHookManager() {
  return new HookManager();
}

// 导出钩子相关功能
module.exports = {
  HookManager,
  HookContext,
  createHookManager,
  HOOK_NAMES
}; 