/**
 * 常量定义
 * 
 * @module constants
 */

/**
 * 环境类型
 */
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  TEST: 'test',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

/**
 * 日志级别
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly'
};

/**
 * 响应状态码
 */
const RESPONSE_CODES = {
  SUCCESS: 0,              // 成功
  VALIDATION_ERROR: 40000, // 参数验证错误
  UNAUTHORIZED: 40100,     // 未授权
  FORBIDDEN: 40300,        // 禁止访问
  NOT_FOUND: 40400,        // 资源不存在
  CONFLICT: 40900,         // 资源冲突
  SERVER_ERROR: 50000,     // 服务器错误
  SERVICE_UNAVAILABLE: 50300 // 服务不可用
};

/**
 * 审计类型
 */
const AUDIT_TYPES = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  
  RESOURCE_CREATE: 'RESOURCE_CREATE',
  RESOURCE_READ: 'RESOURCE_READ',
  RESOURCE_UPDATE: 'RESOURCE_UPDATE',
  RESOURCE_DELETE: 'RESOURCE_DELETE',
  
  SYSTEM_START: 'SYSTEM_START',
  SYSTEM_STOP: 'SYSTEM_STOP',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

/**
 * 审计结果
 */
const AUDIT_OUTCOMES = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  ERROR: 'ERROR',
  DENIED: 'DENIED'
};

/**
 * 钩子名称
 */
const HOOK_NAMES = {
  // 应用生命周期钩子
  BEFORE_START: 'beforeStart',
  AFTER_START: 'afterStart',
  BEFORE_SHUTDOWN: 'beforeShutdown',
  ON_ERROR: 'onError',
  
  // 请求处理钩子
  BEFORE_REQUEST: 'beforeRequest',
  AFTER_REQUEST: 'afterRequest',
  BEFORE_RESPONSE: 'beforeResponse',
  ON_REQUEST_ERROR: 'onRequestError',
  
  // 路由钩子
  BEFORE_ROUTE_REGISTER: 'beforeRouteRegister',
  AFTER_ROUTE_REGISTER: 'afterRouteRegister',
  BEFORE_CONTROLLER: 'beforeController',
  AFTER_CONTROLLER: 'afterController',
  
  // 认证钩子
  ON_AUTHENTICATE: 'onAuthenticate',
  ON_AUTHORIZE: 'onAuthorize',
  AFTER_LOGIN: 'afterLogin',
  AFTER_LOGOUT: 'afterLogout',
  
  // 数据库钩子
  BEFORE_CONNECT: 'beforeConnect',
  AFTER_CONNECT: 'afterConnect',
  BEFORE_QUERY: 'beforeQuery',
  AFTER_QUERY: 'afterQuery',
  BEFORE_CREATE: 'beforeCreate',
  AFTER_CREATE: 'afterCreate',
  BEFORE_UPDATE: 'beforeUpdate',
  AFTER_UPDATE: 'afterUpdate',
  BEFORE_DELETE: 'beforeDelete',
  AFTER_DELETE: 'afterDelete'
};

/**
 * 服务健康状态
 */
const HEALTH_STATUS = {
  UP: 'UP',
  DOWN: 'DOWN',
  DEGRADED: 'DEGRADED',
  UNKNOWN: 'UNKNOWN'
};

module.exports = {
  ENVIRONMENTS,
  LOG_LEVELS,
  RESPONSE_CODES,
  AUDIT_TYPES,
  AUDIT_OUTCOMES,
  HOOK_NAMES,
  HEALTH_STATUS
}; 