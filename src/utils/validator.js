/**
 * 验证工具
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { AppError } = require('./errors');

// 创建验证器实例
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false
});

// 添加常用格式验证
addFormats(ajv);

/**
 * 验证数据
 * @param {Object} data - 要验证的数据
 * @param {Object} schema - JSON Schema
 * @returns {Promise<Object>} 验证后的数据
 */
async function validate(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  if (!valid) {
    const errors = validate.errors.map(error => ({
      field: error.instancePath.slice(1),
      message: error.message
    }));
    
    throw new AppError('VALIDATION_ERROR', '数据验证失败', 400, { errors });
  }
  
  return data;
}

module.exports = {
  validate,
  ajv
}; 