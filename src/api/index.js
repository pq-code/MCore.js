/**
 * API标准模块
 * 提供统一的API响应格式、错误处理、分页等功能
 * 
 * @module api
 */

const Result = require('./Result');
const Paginator = require('./Paginator');
const validator = require('./validator');
const errorCodes = require('./errorCodes');

module.exports = {
  Result,
  Paginator,
  validator,
  errorCodes
}; 