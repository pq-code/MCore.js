/**
 * API错误码常量
 * 提供统一的业务错误码
 * 
 * @module api/errorCodes
 */

// 通用错误 (10000-19999)
const COMMON = {
  // 系统级错误 (10000-10999)
  SYSTEM_ERROR: '10000',              // 系统错误
  SERVICE_UNAVAILABLE: '10001',       // 服务不可用
  TIMEOUT: '10002',                   // 超时
  RATE_LIMIT: '10003',                // 限流
  BUSINESS_ERROR: '10004',            // 业务错误
  
  // 参数错误 (11000-11999)
  PARAM_INVALID: '11000',             // 参数无效
  PARAM_MISSING: '11001',             // 参数缺失
  PARAM_TYPE_ERROR: '11002',          // 参数类型错误
  PARAM_FORMAT_ERROR: '11003',        // 参数格式错误
  
  // 用户错误 (12000-12999)
  USER_NOT_EXIST: '12000',            // 用户不存在
  USER_ALREADY_EXIST: '12001',        // 用户已存在
  USER_AUTH_FAIL: '12002',            // 用户认证失败
  USER_FORBIDDEN: '12003',            // 用户禁止访问
  USER_ACCOUNT_LOCKED: '12004',       // 用户账号锁定
  USER_PASSWORD_ERROR: '12005',       // 用户密码错误
  
  // 数据错误 (13000-13999)
  DATA_NOT_FOUND: '13000',            // 数据不存在
  DATA_ALREADY_EXIST: '13001',        // 数据已存在
  DATA_VALIDATION_FAIL: '13002',      // 数据验证失败
  DATA_INTEGRITY_ERROR: '13003',      // 数据完整性错误
  
  // 文件相关错误 (14000-14999)
  FILE_NOT_FOUND: '14000',            // 文件不存在
  FILE_SIZE_EXCEED: '14001',          // 文件大小超限
  FILE_TYPE_INVALID: '14002',         // 文件类型无效
  FILE_UPLOAD_FAIL: '14003',          // 文件上传失败
  
  // 权限相关错误 (15000-15999)
  PERMISSION_DENIED: '15000',         // 权限拒绝
  TOKEN_INVALID: '15001',             // Token无效
  TOKEN_EXPIRED: '15002',             // Token过期
  IP_FORBIDDEN: '15003',              // IP禁止访问
  
  // 资源相关错误 (16000-16999)
  RESOURCE_NOT_FOUND: '16000',        // 资源不存在
  RESOURCE_EXHAUSTED: '16001',        // 资源耗尽
  RESOURCE_CONFLICT: '16002',         // 资源冲突
  
  // 业务规则错误 (17000-17999)
  RULE_VALIDATION_FAIL: '17000',      // 规则验证失败
  OPERATION_FORBIDDEN: '17001',       // 操作禁止
  OPERATION_UNSUPPORTED: '17002',     // 操作不支持
  STATUS_INVALID: '17003',            // 状态无效
};

// 认证服务错误 (20000-29999)
const AUTH = {
  // 认证错误 (20000-20999)
  AUTH_FAILED: '20000',               // 认证失败
  AUTH_EXPIRED: '20001',              // 认证过期
  AUTH_INVALID_CREDENTIALS: '20002',  // 无效凭证
  AUTH_INVALID_TOKEN: '20003',        // 无效Token
  AUTH_MISSING_TOKEN: '20004',        // 缺少Token
  
  // 授权错误 (21000-21999)
  AUTH_INSUFFICIENT_PERMISSIONS: '21000', // 权限不足
  AUTH_ROLE_NOT_FOUND: '21001',       // 角色不存在
};

// 业务服务错误 (30000-39999)
const BUSINESS = {
  // 业务服务通用错误 (30000-30999)
  BUSINESS_VALIDATION_FAIL: '30000',  // 业务验证失败
  BUSINESS_PROCESS_FAIL: '30001',     // 业务处理失败
  BUSINESS_STATE_INVALID: '30002',    // 业务状态无效
};

// BFF服务错误 (40000-49999)
const BFF = {
  // BFF服务通用错误 (40000-40999)
  BFF_UPSTREAM_ERROR: '40000',        // 上游服务错误
  BFF_DATA_TRANSFORM_ERROR: '40001',  // 数据转换错误
};

// 低代码平台错误 (50000-59999)
const LOWCODE = {
  // 低代码平台通用错误 (50000-50999)
  LOWCODE_COMPILE_ERROR: '50000',     // 编译错误
  LOWCODE_RENDER_ERROR: '50001',      // 渲染错误
  LOWCODE_TEMPLATE_ERROR: '50002',    // 模板错误
};

// AI服务错误 (60000-69999)
const AI = {
  // AI服务通用错误 (60000-60999)
  AI_MODEL_ERROR: '60000',            // 模型错误
  AI_INFERENCE_ERROR: '60001',        // 推理错误
  AI_TRAINING_ERROR: '60002',         // 训练错误
  AI_DATA_ERROR: '60003',             // 数据错误
};

module.exports = {
  ...COMMON,
  ...AUTH,
  ...BUSINESS,
  ...BFF,
  ...LOWCODE,
  ...AI
}; 