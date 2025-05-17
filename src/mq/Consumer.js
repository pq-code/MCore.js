/**
 * 消息消费者类
 * 负责从消息队列接收和处理消息
 * 
 * @module mq/Consumer
 */

const MessageHandler = require('./MessageHandler');
const logger = require('../logging').logger;

/**
 * 消息消费者类
 */
class Consumer {
  /**
   * 创建消费者实例
   * 
   * @param {Object} broker - 消息代理实例
   * @param {Object} options - 配置选项
   * @param {string} options.queue - 队列名称
   * @param {boolean} options.autoAck - 是否自动确认消息
   * @param {number} options.prefetch - 预取数量
   * @param {boolean} options.noLocal - 是否不接收自己发送的消息
   * @param {boolean} options.exclusive - 是否独占队列
   * @param {boolean} options.durable - 是否持久化
   */
  constructor(broker, options = {}) {
    if (!broker) {
      throw new Error('必须提供消息代理实例');
    }
    
    this.broker = broker;
    this.options = {
      queue: options.queue || '',
      autoAck: options.autoAck !== false,
      prefetch: options.prefetch || parseInt(process.env.MQ_PREFETCH, 10) || 10,
      noLocal: options.noLocal || false,
      exclusive: options.exclusive || false,
      durable: options.durable !== false
    };
    
    this.consumerInstance = null;
    this.handlers = new Map();
    this.subscriptions = new Map();
    
    // 统计信息
    this.stats = {
      received: 0,
      processed: 0,
      failed: 0,
      requeued: 0
    };
  }
  
  /**
   * 初始化消费者
   * 
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.consumerInstance) {
      if (!this.broker.isConnected()) {
        await this.broker.connect();
      }
      
      this.consumerInstance = await this.broker.createConsumer(this.options);
      logger.info(`消息消费者已初始化: ${this.options.queue || '默认队列'}`);
    }
  }
  
  /**
   * 订阅消息
   * 
   * @param {string} pattern - 订阅模式（路由键或主题）
   * @param {Function|MessageHandler} handler - 消息处理函数或处理器
   * @param {Object} options - 订阅选项
   * @param {string} options.exchange - 交换机名称
   * @param {string} options.queue - 队列名称（覆盖默认队列）
   * @param {boolean} options.autoAck - 是否自动确认
   * @returns {Promise<Object>} 订阅结果
   */
  async subscribe(pattern, handler, options = {}) {
    try {
      // 确保消费者已初始化
      await this.init();
      
      // 创建或获取消息处理器
      const messageHandler = this._createHandler(handler);
      
      // 保存处理器引用
      this.handlers.set(pattern, messageHandler);
      
      // 订阅消息
      const subscriptionId = await this.consumerInstance.subscribe(
        pattern,
        this._handleMessage.bind(this, messageHandler, options),
        options
      );
      
      // 保存订阅信息
      this.subscriptions.set(pattern, {
        id: subscriptionId,
        pattern,
        options
      });
      
      logger.info(`已订阅消息: ${pattern}, exchange=${options.exchange || '默认'}, queue=${options.queue || this.options.queue || '默认'}`);
      
      return { subscriptionId, pattern };
    } catch (err) {
      logger.error(`订阅消息失败: ${err.message}`, {
        stack: err.stack,
        pattern,
        options
      });
      
      throw err;
    }
  }
  
  /**
   * 取消订阅
   * 
   * @param {string} pattern - 订阅模式
   * @returns {Promise<boolean>} 是否成功取消
   */
  async unsubscribe(pattern) {
    try {
      const subscription = this.subscriptions.get(pattern);
      
      if (!subscription) {
        return false;
      }
      
      // 取消订阅
      await this.consumerInstance.unsubscribe(subscription.id);
      
      // 删除处理器和订阅信息
      this.handlers.delete(pattern);
      this.subscriptions.delete(pattern);
      
      logger.info(`已取消订阅: ${pattern}`);
      
      return true;
    } catch (err) {
      logger.error(`取消订阅失败: ${err.message}`, {
        stack: err.stack,
        pattern
      });
      
      return false;
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
   * 关闭消费者
   * 
   * @returns {Promise<void>}
   */
  async close() {
    try {
      // 取消所有订阅
      for (const pattern of this.subscriptions.keys()) {
        await this.unsubscribe(pattern);
      }
      
      // 断开连接
      if (this.consumerInstance) {
        await this.broker.disconnect();
        this.consumerInstance = null;
      }
      
      logger.info('消息消费者已关闭');
    } catch (err) {
      logger.error(`关闭消费者失败: ${err.message}`, {
        stack: err.stack
      });
    }
  }
  
  /**
   * 处理接收到的消息
   * 
   * @private
   * @param {MessageHandler} handler - 消息处理器
   * @param {Object} options - 处理选项
   * @param {Object} message - 接收到的消息
   * @returns {Promise<void>}
   */
  async _handleMessage(handler, options, message) {
    // 更新统计信息
    this.stats.received++;
    
    // 解析消息内容
    let content;
    try {
      content = this._parseMessage(message);
    } catch (err) {
      logger.error(`解析消息失败: ${err.message}`, {
        message
      });
      
      // 如果不是自动确认，拒绝消息
      if (!options.autoAck && !this.options.autoAck) {
        await this._nack(message, false);
      }
      
      this.stats.failed++;
      return;
    }
    
    // 处理上下文
    const context = {
      broker: this.broker,
      consumer: this,
      pattern: message.pattern || message.routingKey,
      exchange: message.exchange,
      queue: message.queue || this.options.queue,
      messageId: message.messageId || message.properties?.messageId,
      timestamp: message.timestamp || message.properties?.timestamp,
      headers: message.headers || message.properties?.headers || {},
      autoAck: options.autoAck !== undefined ? options.autoAck : this.options.autoAck,
      originalMessage: message
    };
    
    try {
      // 处理消息
      const result = await handler.process(content, context);
      
      // 更新统计信息
      this.stats.processed++;
      
      // 如果不是自动确认，确认消息
      if (!context.autoAck) {
        await this._ack(message);
      }
      
      return result;
    } catch (err) {
      // 更新统计信息
      this.stats.failed++;
      
      logger.error(`处理消息失败: ${err.message}`, {
        stack: err.stack,
        messageId: context.messageId,
        pattern: context.pattern
      });
      
      // 如果不是自动确认，拒绝消息并可能重新入队
      if (!context.autoAck) {
        const requeue = err.requeue !== false;
        await this._nack(message, requeue);
        
        if (requeue) {
          this.stats.requeued++;
        }
      }
      
      throw err;
    }
  }
  
  /**
   * 确认消息
   * 
   * @private
   * @param {Object} message - 消息对象
   * @returns {Promise<void>}
   */
  async _ack(message) {
    if (this.consumerInstance && typeof this.consumerInstance.ack === 'function') {
      await this.consumerInstance.ack(message);
    }
  }
  
  /**
   * 拒绝消息
   * 
   * @private
   * @param {Object} message - 消息对象
   * @param {boolean} requeue - 是否重新入队
   * @returns {Promise<void>}
   */
  async _nack(message, requeue = false) {
    if (this.consumerInstance && typeof this.consumerInstance.nack === 'function') {
      await this.consumerInstance.nack(message, requeue);
    }
  }
  
  /**
   * 解析消息内容
   * 
   * @private
   * @param {Object} message - 消息对象
   * @returns {any} 解析后的消息内容
   */
  _parseMessage(message) {
    // 获取消息内容
    const content = message.content || message.value || message.body || message;
    
    // 获取内容类型
    const contentType = message.contentType || message.properties?.contentType;
    
    // 如果消息内容是 Buffer，转换为字符串
    let strContent = content;
    if (Buffer.isBuffer(content)) {
      strContent = content.toString('utf8');
    }
    
    // 根据内容类型解析消息
    if (contentType === 'application/json' || 
        (typeof strContent === 'string' && strContent.startsWith('{'))) {
      try {
        return JSON.parse(strContent);
      } catch (e) {
        // 如果解析失败，返回原始内容
        return strContent;
      }
    }
    
    return content;
  }
  
  /**
   * 创建消息处理器
   * 
   * @private
   * @param {Function|MessageHandler} handler - 处理函数或处理器
   * @returns {MessageHandler} 消息处理器
   */
  _createHandler(handler) {
    if (handler instanceof MessageHandler) {
      return handler;
    }
    
    if (typeof handler === 'function') {
      return new MessageHandler({ handler });
    }
    
    throw new Error('消息处理器必须是函数或MessageHandler实例');
  }
}

module.exports = Consumer; 