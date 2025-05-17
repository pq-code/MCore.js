/**
 * 消息生产者类
 * 负责将消息发送到消息队列
 * 
 * @module mq/Producer
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../logging').logger;

/**
 * 消息生产者类
 */
class Producer {
  /**
   * 创建生产者实例
   * 
   * @param {Object} broker - 消息代理实例
   * @param {Object} options - 配置选项
   * @param {string} options.defaultExchange - 默认交换机
   * @param {Object} options.messageOptions - 消息配置选项
   */
  constructor(broker, options = {}) {
    if (!broker) {
      throw new Error('必须提供消息代理实例');
    }
    
    this.broker = broker;
    this.options = options;
    this.defaultExchange = options.defaultExchange || '';
    this.messageOptions = options.messageOptions || {};
    this.producerInstance = null;
    
    // 统计信息
    this.stats = {
      sent: 0,
      failed: 0,
      batches: 0
    };
  }
  
  /**
   * 初始化生产者
   * 
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.producerInstance) {
      if (!this.broker.isConnected()) {
        await this.broker.connect();
      }
      
      this.producerInstance = await this.broker.createProducer(this.options);
      logger.info('消息生产者已初始化');
    }
  }
  
  /**
   * 发送消息
   * 
   * @param {string} routingKey - 路由键
   * @param {Object|string} content - 消息内容
   * @param {Object} options - 发送选项
   * @param {string} options.exchange - 交换机名称
   * @param {string} options.messageId - 消息ID
   * @param {string} options.contentType - 内容类型
   * @param {boolean} options.persistent - 是否持久化
   * @returns {Promise<Object>} 发送结果
   */
  async send(routingKey, content, options = {}) {
    try {
      // 确保生产者已初始化
      await this.init();
      
      // 准备消息
      const message = this._prepareMessage(content, options);
      
      // 确定交换机
      const exchange = options.exchange || this.defaultExchange;
      
      // 发送消息
      const result = await this.producerInstance.send(routingKey, message, {
        exchange,
        ...this.messageOptions,
        ...options
      });
      
      // 更新统计信息
      this.stats.sent++;
      
      return result;
    } catch (err) {
      // 更新统计信息
      this.stats.failed++;
      
      logger.error(`发送消息失败: ${err.message}`, {
        stack: err.stack,
        routingKey,
        exchange: options.exchange || this.defaultExchange
      });
      
      throw err;
    }
  }
  
  /**
   * 批量发送消息
   * 
   * @param {Array<Object>} messages - 消息列表
   * @param {Object} options - 批量发送选项
   * @returns {Promise<Array>} 发送结果
   */
  async sendBatch(messages, options = {}) {
    try {
      // 确保生产者已初始化
      await this.init();
      
      // 准备批量消息
      const preparedMessages = messages.map(msg => ({
        routingKey: msg.routingKey,
        message: this._prepareMessage(msg.content, msg.options || {}),
        options: {
          exchange: (msg.options && msg.options.exchange) || this.defaultExchange,
          ...this.messageOptions,
          ...(msg.options || {})
        }
      }));
      
      // 发送批量消息
      const results = await this.producerInstance.sendBatch(preparedMessages, options);
      
      // 更新统计信息
      this.stats.sent += messages.length;
      this.stats.batches++;
      
      return results;
    } catch (err) {
      // 更新统计信息
      this.stats.failed += messages.length;
      
      logger.error(`批量发送消息失败: ${err.message}`, {
        stack: err.stack,
        messageCount: messages.length
      });
      
      throw err;
    }
  }
  
  /**
   * 获取统计信息
   * 
   * @returns {Object} 统计信息
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * 关闭生产者
   * 
   * @returns {Promise<void>}
   */
  async close() {
    if (this.producerInstance) {
      await this.broker.disconnect();
      this.producerInstance = null;
      logger.info('消息生产者已关闭');
    }
  }
  
  /**
   * 准备消息
   * 
   * @private
   * @param {any} content - 消息内容
   * @param {Object} options - 消息选项
   * @returns {Object} 准备好的消息
   */
  _prepareMessage(content, options = {}) {
    // 序列化消息内容（如果需要）
    let messageContent = content;
    let contentType = options.contentType || 'application/json';
    
    if (typeof content === 'object' && content !== null && contentType === 'application/json') {
      messageContent = JSON.stringify(content);
    }
    
    // 构建消息
    return {
      content: messageContent,
      messageId: options.messageId || uuidv4(),
      timestamp: Date.now(),
      contentType,
      persistent: options.persistent !== false,
      headers: options.headers || {}
    };
  }
}

module.exports = Producer; 