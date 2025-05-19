/**
 * 错误处理工具
 */

class AppError extends Error {
  /**
   * 创建应用错误
   * @param {string} code - 错误代码
   * @param {string} message - 错误消息
   * @param {number} status - HTTP状态码
   * @param {Object} details - 错误详情
   */
  constructor(code, message, status = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    
    // 捕获堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * 创建未授权错误
   * @param {string} message - 错误消息
   * @returns {AppError}
   */
  static unauthorized(message = '未授权访问') {
    return new AppError('UNAUTHORIZED', message, 401);
  }
  
  /**
   * 创建禁止访问错误
   * @param {string} message - 错误消息
   * @returns {AppError}
   */
  static forbidden(message = '禁止访问') {
    return new AppError('FORBIDDEN', message, 403);
  }
  
  /**
   * 创建未找到错误
   * @param {string} message - 错误消息
   * @returns {AppError}
   */
  static notFound(message = '资源不存在') {
    return new AppError('NOT_FOUND', message, 404);
  }
  
  /**
   * 创建验证错误
   * @param {string} message - 错误消息
   * @param {Object} details - 验证错误详情
   * @returns {AppError}
   */
  static validation(message = '验证失败', details = {}) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }
  
  /**
   * 创建冲突错误
   * @param {string} message - 错误消息
   * @returns {AppError}
   */
  static conflict(message = '资源冲突') {
    return new AppError('CONFLICT', message, 409);
  }
  
  /**
   * 创建服务器错误
   * @param {string} message - 错误消息
   * @returns {AppError}
   */
  static server(message = '服务器内部错误') {
    return new AppError('SERVER_ERROR', message, 500);
  }
  
  /**
   * 转换为JSON对象
   * @returns {Object}
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details
    };
  }
}

module.exports = {
  AppError
}; 