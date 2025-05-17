/**
 * 消息处理器类
 * 提供消息处理的基本能力
 * 
 * @module mq/MessageHandler
 */

const logger = require('../logging').logger;

/**
 * 消息处理器类
 */
class MessageHandler {
  /**
   * 创建消息处理器实例
   * 
   * @param {Object} options - 配置选项
   * @param {Function} options.handler - 消息处理函数
   * @param {number} options.maxRetries - 最大重试次数
   * @param {number} options.retryDelay - 重试延迟（毫秒）
   * @param {Function} options.errorHandler - 错误处理函数
   */
  constructor(options = {}) {
    this.handler = options.handler;
    this.maxRetries = options.maxRetries || parseInt(process.env.MQ_MAX_RETRIES, 10) || 3;
    this.retryDelay = options.retryDelay || parseInt(process.env.MQ_RETRY_DELAY, 10) || 1000;
    this.errorHandler = options.errorHandler;
    
    // 绑定方法
    this.process = this.process.bind(this);
  }
  
  /**
   * 处理消息
   * 
   * @param {Object} message - 消息内容
   * @param {Object} context - 上下文信息
   * @returns {Promise<any>} 处理结果
   */
  async process(message, context = {}) {
    if (!this.handler) {
      throw new Error('未定义消息处理函数');
    }
    
    let retries = 0;
    let error = null;
    
    // 尝试处理消息，支持重试
    while (retries <= this.maxRetries) {
      try {
        // 处理消息
        const result = await this.handler(message, context);
        
        // 如果成功，返回结果
        return result;
      } catch (err) {
        error = err;
        
        // 记录错误
        logger.error(`消息处理失败 (尝试 ${retries + 1}/${this.maxRetries + 1}): ${err.message}`, {
          stack: err.stack,
          message,
          context,
          retries
        });
        
        // 如果还有重试次数，等待后重试
        if (retries < this.maxRetries) {
          await this._sleep(this.retryDelay * Math.pow(2, retries));
          retries++;
        } else {
          // 已达到最大重试次数，如果有错误处理器，调用它
          if (this.errorHandler) {
            try {
              return await this.errorHandler(error, message, context);
            } catch (handlerError) {
              logger.error(`错误处理器失败: ${handlerError.message}`, {
                stack: handlerError.stack,
                originalError: error.message
              });
              
              // 重新抛出原始错误
              throw error;
            }
          } else {
            // 没有错误处理器，抛出错误
            throw error;
          }
        }
      }
    }
  }
  
  /**
   * 等待指定时间
   * 
   * @private
   * @param {number} ms - 等待时间（毫秒）
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MessageHandler; 