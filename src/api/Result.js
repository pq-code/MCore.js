/**
 * API结果类
 * 标准化API响应格式
 * 
 * @class Result
 */

const errorCodes = require('./errorCodes');

class Result {
  /**
   * 创建API结果实例
   * 
   * @param {Object} options - 结果选项
   * @param {number} options.code - 状态码
   * @param {string} options.message - 消息
   * @param {any} options.data - 数据
   * @param {Object} options.metadata - 元数据
   */
  constructor(options = {}) {
    this.code = options.code || 200;
    this.message = options.message || '';
    this.data = options.data !== undefined ? options.data : null;
    this.timestamp = options.timestamp || new Date().toISOString();
    this.metadata = options.metadata || {};
  }

  /**
   * 创建成功响应
   * 
   * @static
   * @param {any} data - 数据
   * @param {string} message - 消息
   * @param {Object} metadata - 元数据
   * @returns {Result} 结果实例
   */
  static success(data = null, message = '操作成功', metadata = {}) {
    return new Result({
      code: 200,
      message,
      data,
      metadata
    });
  }

  /**
   * 创建错误响应
   * 
   * @static
   * @param {string} message - 错误消息
   * @param {number} code - 错误码
   * @param {Object} metadata - 元数据
   * @returns {Result} 结果实例
   */
  static error(message = '操作失败', code = 500, metadata = {}) {
    return new Result({
      code,
      message,
      data: null,
      metadata
    });
  }

  /**
   * 创建404错误响应
   * 
   * @static
   * @param {string} message - 错误消息
   * @param {Object} metadata - 元数据
   * @returns {Result} 结果实例
   */
  static notFound(message = '资源不存在', metadata = {}) {
    return Result.error(message, 404, metadata);
  }

  /**
   * 创建参数验证错误响应
   * 
   * @static
   * @param {string} message - 错误消息
   * @param {Object} errors - 验证错误信息
   * @returns {Result} 结果实例
   */
  static validationError(message = '参数验证失败', errors = {}) {
    return Result.error(message, 400, { errors });
  }

  /**
   * 创建未授权错误响应
   * 
   * @static
   * @param {string} message - 错误消息
   * @param {Object} metadata - 元数据
   * @returns {Result} 结果实例
   */
  static unauthorized(message = '未授权', metadata = {}) {
    return Result.error(message, 401, metadata);
  }

  /**
   * 创建禁止访问错误响应
   * 
   * @static
   * @param {string} message - 错误消息
   * @param {Object} metadata - 元数据
   * @returns {Result} 结果实例
   */
  static forbidden(message = '禁止访问', metadata = {}) {
    return Result.error(message, 403, metadata);
  }

  /**
   * 创建业务逻辑错误响应
   * 
   * @static
   * @param {string} message - 错误消息
   * @param {string} errorCode - 业务错误码
   * @param {Object} metadata - 元数据
   * @returns {Result} 结果实例
   */
  static businessError(message, errorCode, metadata = {}) {
    return Result.error(
      message,
      400,
      {
        ...metadata,
        errorCode: errorCode || errorCodes.BUSINESS_ERROR
      }
    );
  }

  /**
   * 转换为JSON对象
   * 
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
      ...this.metadata
    };
  }

  /**
   * 应用到Koa上下文
   * 
   * @param {Object} ctx - Koa上下文
   */
  apply(ctx) {
    ctx.status = this.code >= 100 && this.code < 600 ? this.code : 500;
    ctx.body = this.toJSON();
  }
}

module.exports = Result; 