/**
 * 参数验证工具
 * 提供请求参数验证功能
 * 
 * @module api/validator
 */

const Result = require('./Result');
const errorCodes = require('./errorCodes');

/**
 * 验证规则类型枚举
 */
const RULE_TYPES = {
  REQUIRED: 'required',
  TYPE: 'type',
  MIN: 'min',
  MAX: 'max',
  LENGTH: 'length',
  PATTERN: 'pattern',
  ENUM: 'enum',
  CUSTOM: 'custom'
};

/**
 * 数据类型枚举
 */
const DATA_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
  ARRAY: 'array',
  DATE: 'date',
  EMAIL: 'email',
  URL: 'url'
};

/**
 * 验证数据类型
 * 
 * @private
 * @param {any} value - 待验证的值
 * @param {string} type - 期望的类型
 * @returns {boolean} 是否符合类型要求
 */
function validateType(value, type) {
  if (value === null || value === undefined) {
    return false;
  }
  
  switch (type.toLowerCase()) {
    case DATA_TYPES.STRING:
      return typeof value === 'string';
    case DATA_TYPES.NUMBER:
      return typeof value === 'number' && !isNaN(value);
    case DATA_TYPES.BOOLEAN:
      return typeof value === 'boolean';
    case DATA_TYPES.OBJECT:
      return typeof value === 'object' && !Array.isArray(value) && value !== null;
    case DATA_TYPES.ARRAY:
      return Array.isArray(value);
    case DATA_TYPES.DATE:
      return value instanceof Date || !isNaN(Date.parse(value));
    case DATA_TYPES.EMAIL:
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case DATA_TYPES.URL:
      try {
        new URL(value);
        return true;
      } catch (e) {
        return false;
      }
    default:
      return false;
  }
}

/**
 * 验证请求参数
 * 
 * @param {Object} data - 请求参数
 * @param {Object} rules - 验证规则
 * @returns {Object} 验证结果对象，包含isValid和errors属性
 */
function validate(data, rules) {
  // 如果没有规则，直接返回验证通过
  if (!rules || Object.keys(rules).length === 0) {
    return { isValid: true, errors: {} };
  }
  
  // 如果没有数据，但有规则，验证必填字段
  if (!data) {
    data = {};
  }
  
  const errors = {};
  let isValid = true;
  
  // 遍历规则对象，验证每个字段
  for (const [field, fieldRules] of Object.entries(rules)) {
    // 获取字段值
    const value = data[field];
    
    // 存储字段错误信息
    const fieldErrors = [];
    
    // 根据规则类型进行验证
    if (fieldRules.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field}是必填项`);
    }
    
    // 如果字段有值，继续验证其他规则
    if (value !== undefined && value !== null) {
      // 验证类型
      if (fieldRules.type && !validateType(value, fieldRules.type)) {
        fieldErrors.push(`${field}应为${fieldRules.type}类型`);
      }
      
      // 验证最小值/长度
      if (fieldRules.min !== undefined) {
        if (typeof value === 'number' && value < fieldRules.min) {
          fieldErrors.push(`${field}不能小于${fieldRules.min}`);
        } else if (typeof value === 'string' && value.length < fieldRules.min) {
          fieldErrors.push(`${field}长度不能小于${fieldRules.min}`);
        } else if (Array.isArray(value) && value.length < fieldRules.min) {
          fieldErrors.push(`${field}项数不能少于${fieldRules.min}`);
        }
      }
      
      // 验证最大值/长度
      if (fieldRules.max !== undefined) {
        if (typeof value === 'number' && value > fieldRules.max) {
          fieldErrors.push(`${field}不能大于${fieldRules.max}`);
        } else if (typeof value === 'string' && value.length > fieldRules.max) {
          fieldErrors.push(`${field}长度不能超过${fieldRules.max}`);
        } else if (Array.isArray(value) && value.length > fieldRules.max) {
          fieldErrors.push(`${field}项数不能超过${fieldRules.max}`);
        }
      }
      
      // 验证精确长度
      if (fieldRules.length !== undefined && 
          ((typeof value === 'string' && value.length !== fieldRules.length) ||
           (Array.isArray(value) && value.length !== fieldRules.length))) {
        fieldErrors.push(`${field}长度应为${fieldRules.length}`);
      }
      
      // 验证正则表达式
      if (fieldRules.pattern && typeof value === 'string') {
        const pattern = fieldRules.pattern instanceof RegExp
          ? fieldRules.pattern
          : new RegExp(fieldRules.pattern);
        
        if (!pattern.test(value)) {
          fieldErrors.push(fieldRules.patternMessage || `${field}格式不正确`);
        }
      }
      
      // 验证枚举值
      if (fieldRules.enum && Array.isArray(fieldRules.enum) && !fieldRules.enum.includes(value)) {
        fieldErrors.push(`${field}必须是[${fieldRules.enum.join(', ')}]之一`);
      }
      
      // 自定义验证函数
      if (fieldRules.custom && typeof fieldRules.custom === 'function') {
        const customResult = fieldRules.custom(value, data);
        if (customResult !== true) {
          fieldErrors.push(customResult || `${field}验证失败`);
        }
      }
    }
    
    // 如果字段有错误，更新验证结果
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
      isValid = false;
    }
  }
  
  return { isValid, errors };
}

/**
 * 创建Koa中间件，用于请求参数验证
 * 
 * @param {Object} schema - 验证规则对象
 * @param {Object} options - 选项
 * @param {string} options.source - 数据来源，可以是'body'、'query'、'params'或'all'
 * @returns {Function} Koa中间件函数
 */
function middleware(schema = {}, options = {}) {
  const source = options.source || 'body';
  
  return async (ctx, next) => {
    let dataToValidate;
    
    // 根据来源获取数据
    switch (source) {
      case 'body':
        dataToValidate = ctx.request.body;
        break;
      case 'query':
        dataToValidate = ctx.query;
        break;
      case 'params':
        dataToValidate = ctx.params;
        break;
      case 'all':
        dataToValidate = {
          ...ctx.query,
          ...ctx.params,
          ...ctx.request.body
        };
        break;
      default:
        dataToValidate = ctx.request.body;
    }
    
    // 执行验证
    const { isValid, errors } = validate(dataToValidate, schema);
    
    // 如果验证失败，返回错误响应
    if (!isValid) {
      Result.validationError(
        '参数验证失败',
        { fields: errors }
      ).apply(ctx);
      return;
    }
    
    // 验证通过，继续处理请求
    await next();
  };
}

module.exports = {
  validate,
  middleware,
  RULE_TYPES,
  DATA_TYPES
}; 