const { AppError } = require('./errors');
const logger = require('./logger');

/**
 * API响应工具
 */
const api = {
  /**
   * 创建成功响应
   * @param {Object} data - 响应数据
   * @param {string} message - 成功消息
   * @returns {Object} 标准响应对象
   */
  createSuccessResponse(data = null, message = '操作成功') {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * 创建错误响应
   * @param {Error|AppError} error - 错误对象
   * @param {Object} options - 配置选项
   * @returns {Object} 标准错误响应对象
   */
  createErrorResponse(error, options = {}) {
    const { showStack = process.env.NODE_ENV === 'development' } = options;
    
    // 记录错误日志
    logger.error('API错误', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status
    });

    // 构建错误响应
    const response = {
      success: false,
      message: error.message || '操作失败',
      error: {
        code: error.code || 'INTERNAL_ERROR',
        status: error.status || 500
      },
      timestamp: new Date().toISOString()
    };

    // 在开发环境下添加堆栈信息
    if (showStack && error.stack) {
      response.error.stack = error.stack;
    }

    return response;
  },

  /**
   * 处理API响应
   * @param {Object} ctx - Koa上下文
   * @param {Function} handler - 处理函数
   */
  async handleResponse(ctx, handler) {
    try {
      const result = await handler();
      ctx.body = api.createSuccessResponse(result);
    } catch (error) {
      ctx.status = error.status || 500;
      ctx.body = api.createErrorResponse(error);
    }
  }
};

module.exports = api; 