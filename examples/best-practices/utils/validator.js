/**
 * 数据验证工具
 */

const Ajv = require('ajv');
const { AppError } = require('./errors');

// 创建验证器实例
const ajv = new Ajv({
  allErrors: true,
  jsonPointers: true,
  removeAdditional: true
});

// 添加常用格式验证
ajv.addFormat('email', /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
ajv.addFormat('password', /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/);
ajv.addFormat('phone', /^1[3-9]\d{9}$/);

/**
 * 验证数据
 * @param {Object} data - 要验证的数据
 * @param {Object} schema - JSON Schema
 * @returns {Object} 验证后的数据
 * @throws {AppError} 验证失败时抛出错误
 */
function validate(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (!valid) {
    const errors = validate.errors.map(err => ({
      field: err.dataPath.slice(1),
      message: err.message
    }));
    
    throw AppError.validation('数据验证失败', { errors });
  }
  
  return data;
}

/**
 * 验证查询参数
 * @param {Object} query - 查询参数
 * @param {Object} schema - JSON Schema
 * @returns {Object} 验证后的查询参数
 */
function validateQuery(query, schema) {
  // 转换查询参数类型
  const data = {};
  for (const [key, value] of Object.entries(query)) {
    if (schema.properties[key]?.type === 'number') {
      data[key] = Number(value);
    } else if (schema.properties[key]?.type === 'boolean') {
      data[key] = value === 'true';
    } else if (schema.properties[key]?.type === 'array') {
      data[key] = value.split(',');
    } else {
      data[key] = value;
    }
  }
  
  return validate(data, schema);
}

/**
 * 验证请求体
 * @param {Object} body - 请求体
 * @param {Object} schema - JSON Schema
 * @returns {Object} 验证后的请求体
 */
function validateBody(body, schema) {
  return validate(body, schema);
}

/**
 * 验证路径参数
 * @param {Object} params - 路径参数
 * @param {Object} schema - JSON Schema
 * @returns {Object} 验证后的路径参数
 */
function validateParams(params, schema) {
  return validate(params, schema);
}

module.exports = {
  validate,
  validateQuery,
  validateBody,
  validateParams
}; 