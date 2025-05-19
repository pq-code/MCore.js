/**
 * 应用程序错误类
 * 提供统一的错误类型和格式
 */

const { ErrorTypes } = require('./errorHandler');

class AppError extends Error {
  /**
   * 创建应用程序错误
   * @param {string} message - 错误消息
   * @param {string} type - 错误类型
   * @param {Object} options - 错误选项
   */
  constructor(message, type = ErrorTypes.INTERNAL, options = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.type = type;
    this.code = options.code || type;
    this.status = options.status;
    this.details = options.details;
    
    // 确保错误堆栈正确
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * 创建验证错误
   * @param {string} message - 错误消息
   * @param {Object} details - 验证详情
   * @returns {AppError} 验证错误实例
   */
  static validation(message, details = {}) {
    return new AppError(message, ErrorTypes.VALIDATION, {
      status: 400,
      details
    });
  }
  
  /**
   * 创建认证错误
   * @param {string} message - 错误消息
   * @returns {AppError} 认证错误实例
   */
  static authentication(message = '未认证') {
    return new AppError(message, ErrorTypes.AUTHENTICATION, {
      status: 401
    });
  }
  
  /**
   * 创建授权错误
   * @param {string} message - 错误消息
   * @returns {AppError} 授权错误实例
   */
  static authorization(message = '无权限') {
    return new AppError(message, ErrorTypes.AUTHORIZATION, {
      status: 403
    });
  }
  
  /**
   * 创建资源未找到错误
   * @param {string} message - 错误消息
   * @returns {AppError} 资源未找到错误实例
   */
  static notFound(message = '资源未找到') {
    return new AppError(message, ErrorTypes.NOT_FOUND, {
      status: 404
    });
  }
  
  /**
   * 创建冲突错误
   * @param {string} message - 错误消息
   * @returns {AppError} 冲突错误实例
   */
  static conflict(message = '资源冲突') {
    return new AppError(message, ErrorTypes.CONFLICT, {
      status: 409
    });
  }
  
  /**
   * 创建内部错误
   * @param {string} message - 错误消息
   * @returns {AppError} 内部错误实例
   */
  static internal(message = '服务器内部错误') {
    return new AppError(message, ErrorTypes.INTERNAL, {
      status: 500
    });
  }
}

module.exports = AppError; 