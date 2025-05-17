/**
 * RabbitMQ适配器
 * 提供与RabbitMQ的集成
 * 
 * @module mq/RabbitMQAdapter
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logging').logger;

/**
 * RabbitMQ适配器类
 */
class RabbitMQAdapter {
  /**
   * 创建RabbitMQ适配器实例
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.url - RabbitMQ连接URL
   * @param {string} options.host - RabbitMQ主机
   * @param {number} options.port - RabbitMQ端口
   * @param {string} options.username - 用户名
   * @param {string} options.password - 密码
   * @param {string} options.vhost - 虚拟主机
   * @param {boolean} options.ssl - 是否使用SSL
   */
  constructor(options = {}) {
    // 连接URL
    this.url = options.url || this._buildConnectionUrl(options);
    
    // 连接选项
    this.connectionOptions = {
      heartbeat: options.heartbeat || 60,
      ...options.connectionOptions
    };
    
    // 连接和通道
    this.connection = null;
    this.channel = null;
    
    // 消费者和订阅ID映射
    this.consumerTags = new Map();
    
    // 重连配置
    this.reconnect = options.reconnect !== false;
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    
    // 关闭标志
    this.closing = false;
  }
  
  /**
   * 连接到RabbitMQ
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connection) {
      return;
    }
    
    try {
      // 创建连接
      this.connection = await amqp.connect(this.url, this.connectionOptions);
      
      // 重置重连计数
      this.reconnectAttempts = 0;
      
      // 处理连接关闭
      this.connection.on('close', () => {
        if (!this.closing) {
          logger.warn('RabbitMQ连接已关闭，尝试重新连接');
          this._reconnect();
        }
      });
      
      // 处理连接错误
      this.connection.on('error', (err) => {
        logger.error(`RabbitMQ连接错误: ${err.message}`, {
          stack: err.stack
        });
        
        if (!this.closing) {
          this._reconnect();
        }
      });
      
      // 创建通道
      this.channel = await this.connection.createChannel();
      
      // 设置通道预取数量
      const prefetch = parseInt(process.env.RABBITMQ_PREFETCH, 10) || 10;
      await this.channel.prefetch(prefetch);
      
      logger.info(`已连接到RabbitMQ: ${this.url}`);
    } catch (err) {
      logger.error(`连接RabbitMQ失败: ${err.message}`, {
        stack: err.stack,
        url: this._sanitizeUrl(this.url)
      });
      
      if (this.reconnect) {
        this._reconnect();
      } else {
        throw err;
      }
    }
  }
  
  /**
   * 断开RabbitMQ连接
   * 
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.closing = true;
    
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      logger.info('已断开RabbitMQ连接');
    } catch (err) {
      logger.error(`断开RabbitMQ连接失败: ${err.message}`, {
        stack: err.stack
      });
    } finally {
      this.closing = false;
    }
  }
  
  /**
   * 检查是否已连接
   * 
   * @returns {boolean} 是否已连接
   */
  isConnected() {
    return !!this.channel && !!this.connection;
  }
  
  /**
   * 创建交换机
   * 
   * @param {string} exchange - 交换机名称
   * @param {string} type - 交换机类型: direct, topic, fanout, headers
   * @param {Object} options - 交换机选项
   * @returns {Promise<Object>} 交换机信息
   */
  async createExchange(exchange, type = 'direct', options = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }
    
    const opts = {
      durable: options.durable !== false,
      internal: options.internal || false,
      autoDelete: options.autoDelete || false,
      alternateExchange: options.alternateExchange,
      arguments: options.arguments || {}
    };
    
    await this.channel.assertExchange(exchange, type, opts);
    
    logger.info(`已创建RabbitMQ交换机: ${exchange} (${type})`);
    
    return { exchange, type, options: opts };
  }
  
  /**
   * 创建队列
   * 
   * @param {string} queue - 队列名称，为空则创建临时队列
   * @param {Object} options - 队列选项
   * @returns {Promise<Object>} 队列信息
   */
  async createQueue(queue = '', options = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }
    
    const opts = {
      exclusive: options.exclusive || false,
      durable: options.durable !== false,
      autoDelete: options.autoDelete || false,
      messageTtl: options.messageTtl,
      expires: options.expires,
      deadLetterExchange: options.deadLetterExchange,
      deadLetterRoutingKey: options.deadLetterRoutingKey,
      maxLength: options.maxLength,
      maxPriority: options.maxPriority,
      arguments: options.arguments || {}
    };
    
    // 添加死信队列相关参数
    if (options.deadLetterExchange) {
      opts.arguments['x-dead-letter-exchange'] = options.deadLetterExchange;
    }
    
    if (options.deadLetterRoutingKey) {
      opts.arguments['x-dead-letter-routing-key'] = options.deadLetterRoutingKey;
    }
    
    const result = await this.channel.assertQueue(queue, opts);
    
    logger.info(`已创建RabbitMQ队列: ${result.queue}`);
    
    return { 
      queue: result.queue,
      messageCount: result.messageCount,
      consumerCount: result.consumerCount,
      options: opts
    };
  }
  
  /**
   * 绑定队列到交换机
   * 
   * @param {string} queue - 队列名称
   * @param {string} exchange - 交换机名称
   * @param {string} pattern - 绑定模式
   * @param {Object} args - 绑定参数
   * @returns {Promise<Object>} 绑定信息
   */
  async bindQueue(queue, exchange, pattern = '#', args = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }
    
    await this.channel.bindQueue(queue, exchange, pattern, args);
    
    logger.info(`已绑定队列到交换机: ${queue} -> ${exchange} (${pattern})`);
    
    return { queue, exchange, pattern, args };
  }
  
  /**
   * 创建生产者
   * 
   * @param {Object} options - 生产者选项
   * @returns {Object} 生产者实例
   */
  async createProducer(options = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }
    
    // 创建生产者
    const producer = {
      /**
       * 发送消息
       * 
       * @param {string} routingKey - 路由键
       * @param {Object} message - 消息内容
       * @param {Object} options - 发送选项
       * @returns {Promise<boolean>} 是否发送成功
       */
      send: async (routingKey, message, options = {}) => {
        // 确保连接可用
        if (!this.isConnected()) {
          await this.connect();
        }
        
        const exchange = options.exchange || '';
        const content = Buffer.from(message.content);
        
        const publishOptions = {
          persistent: message.persistent !== false,
          messageId: message.messageId,
          timestamp: message.timestamp,
          contentType: message.contentType || 'application/json',
          contentEncoding: options.contentEncoding || 'utf-8',
          headers: message.headers || {},
          expiration: options.expiration,
          priority: options.priority,
          correlationId: options.correlationId,
          replyTo: options.replyTo,
          type: options.type,
          appId: options.appId
        };
        
        try {
          const result = this.channel.publish(exchange, routingKey, content, publishOptions);
          return result;
        } catch (err) {
          logger.error(`发送RabbitMQ消息失败: ${err.message}`, {
            stack: err.stack,
            exchange,
            routingKey
          });
          throw err;
        }
      },
      
      /**
       * 批量发送消息
       * 
       * @param {Array<Object>} messages - 消息列表
       * @returns {Promise<Array>} 发送结果
       */
      sendBatch: async (messages) => {
        // 确保连接可用
        if (!this.isConnected()) {
          await this.connect();
        }
        
        try {
          const results = [];
          
          // RabbitMQ没有批量API，逐个发送
          for (const msg of messages) {
            const result = await producer.send(
              msg.routingKey,
              msg.message,
              msg.options
            );
            
            results.push(result);
          }
          
          return results;
        } catch (err) {
          logger.error(`批量发送RabbitMQ消息失败: ${err.message}`, {
            stack: err.stack
          });
          throw err;
        }
      }
    };
    
    return producer;
  }
  
  /**
   * 创建消费者
   * 
   * @param {Object} options - 消费者选项
   * @returns {Object} 消费者实例
   */
  async createConsumer(options = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }
    
    const defaultQueue = options.queue || '';
    
    // 创建消费者
    const consumer = {
      /**
       * 订阅消息
       * 
       * @param {string} pattern - 路由键
       * @param {Function} handler - 消息处理函数
       * @param {Object} subOptions - 订阅选项
       * @returns {Promise<string>} 消费者标签
       */
      subscribe: async (pattern, handler, subOptions = {}) => {
        // 确保连接可用
        if (!this.isConnected()) {
          await this.connect();
        }
        
        const exchange = subOptions.exchange || '';
        const queue = subOptions.queue || defaultQueue;
        
        // 如果没有指定队列，创建临时队列
        let queueInfo;
        if (!queue) {
          queueInfo = await this.createQueue('', {
            exclusive: true,
            autoDelete: true,
            ...subOptions
          });
        } else {
          queueInfo = await this.createQueue(queue, subOptions);
        }
        
        // 如果指定了交换机，绑定队列
        if (exchange) {
          await this.bindQueue(queueInfo.queue, exchange, pattern);
        }
        
        // 消费回调
        const onMessage = async (msg) => {
          if (!msg) return;
          
          try {
            // 构造消息对象
            const message = {
              content: msg.content,
              properties: msg.properties,
              fields: msg.fields,
              exchange: msg.fields.exchange,
              routingKey: msg.fields.routingKey,
              deliveryTag: msg.fields.deliveryTag,
              queue: queueInfo.queue
            };
            
            // 调用处理函数
            await handler(message);
            
            // 如果不是自动确认，由处理函数负责确认
            if (!subOptions.autoAck && !options.autoAck) {
              // 消息自动确认
            }
          } catch (err) {
            logger.error(`处理RabbitMQ消息失败: ${err.message}`, {
              stack: err.stack,
              pattern,
              queue: queueInfo.queue
            });
            
            // 如果不是自动确认，拒绝消息
            if (!subOptions.autoAck && !options.autoAck) {
              try {
                await consumer.nack(msg, err.requeue !== false);
              } catch (nackErr) {
                logger.error(`拒绝RabbitMQ消息失败: ${nackErr.message}`);
              }
            }
          }
        };
        
        // 订阅配置
        const consumeOptions = {
          noAck: subOptions.autoAck !== false && options.autoAck !== false,
          exclusive: subOptions.exclusive || false,
          priority: subOptions.priority,
          arguments: subOptions.arguments || {}
        };
        
        // 开始消费
        const consumerTag = await this.channel.consume(
          queueInfo.queue,
          onMessage,
          consumeOptions
        );
        
        // 保存消费者标签
        this.consumerTags.set(consumerTag.consumerTag, {
          queue: queueInfo.queue,
          pattern,
          exchange
        });
        
        logger.info(`已订阅RabbitMQ消息: ${queueInfo.queue} [${pattern}]`);
        
        return consumerTag.consumerTag;
      },
      
      /**
       * 取消订阅
       * 
       * @param {string} consumerTag - 消费者标签
       * @returns {Promise<boolean>} 是否成功取消
       */
      unsubscribe: async (consumerTag) => {
        if (!this.isConnected() || !this.consumerTags.has(consumerTag)) {
          return false;
        }
        
        try {
          await this.channel.cancel(consumerTag);
          this.consumerTags.delete(consumerTag);
          return true;
        } catch (err) {
          logger.error(`取消RabbitMQ订阅失败: ${err.message}`, {
            stack: err.stack,
            consumerTag
          });
          return false;
        }
      },
      
      /**
       * 确认消息
       * 
       * @param {Object} message - 消息对象
       * @returns {Promise<void>}
       */
      ack: async (message) => {
        if (!this.isConnected()) {
          throw new Error('RabbitMQ连接已关闭');
        }
        
        try {
          const deliveryTag = message.deliveryTag || message.fields?.deliveryTag;
          await this.channel.ack(message, false);
        } catch (err) {
          logger.error(`确认RabbitMQ消息失败: ${err.message}`, {
            stack: err.stack
          });
          throw err;
        }
      },
      
      /**
       * 拒绝消息
       * 
       * @param {Object} message - 消息对象
       * @param {boolean} requeue - 是否重新入队
       * @returns {Promise<void>}
       */
      nack: async (message, requeue = false) => {
        if (!this.isConnected()) {
          throw new Error('RabbitMQ连接已关闭');
        }
        
        try {
          const deliveryTag = message.deliveryTag || message.fields?.deliveryTag;
          await this.channel.nack(message, false, requeue);
        } catch (err) {
          logger.error(`拒绝RabbitMQ消息失败: ${err.message}`, {
            stack: err.stack
          });
          throw err;
        }
      },
      
      /**
       * 获取队列信息
       * 
       * @param {string} queue - 队列名称
       * @returns {Promise<Object>} 队列信息
       */
      getQueueInfo: async (queue) => {
        if (!this.isConnected()) {
          await this.connect();
        }
        
        try {
          return await this.channel.checkQueue(queue);
        } catch (err) {
          logger.error(`获取RabbitMQ队列信息失败: ${err.message}`, {
            stack: err.stack,
            queue
          });
          throw err;
        }
      }
    };
    
    return consumer;
  }
  
  /**
   * 构建连接URL
   * 
   * @private
   * @param {Object} options - 连接选项
   * @returns {string} 连接URL
   */
  _buildConnectionUrl(options) {
    const protocol = options.ssl ? 'amqps' : 'amqp';
    const host = options.host || process.env.RABBITMQ_HOST || 'localhost';
    const port = options.port || process.env.RABBITMQ_PORT || 5672;
    const username = options.username || process.env.RABBITMQ_USERNAME || 'guest';
    const password = options.password || process.env.RABBITMQ_PASSWORD || 'guest';
    const vhost = options.vhost || process.env.RABBITMQ_VHOST || '/';
    
    return `${protocol}://${username}:${password}@${host}:${port}/${encodeURIComponent(vhost)}`;
  }
  
  /**
   * 清理URL中的敏感信息（用于日志）
   * 
   * @private
   * @param {string} url - 连接URL
   * @returns {string} 清理后的URL
   */
  _sanitizeUrl(url) {
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }
  
  /**
   * 重新连接逻辑
   * 
   * @private
   */
  _reconnect() {
    if (this.closing || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(`已达到最大重连尝试次数(${this.maxReconnectAttempts})，停止重连RabbitMQ`);
      }
      return;
    }
    
    this.connection = null;
    this.channel = null;
    this.reconnectAttempts++;
    
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 10);
    
    logger.info(`尝试在${delay}ms后重新连接RabbitMQ (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(err => {
        logger.error(`RabbitMQ重连失败: ${err.message}`, {
          stack: err.stack,
          attempt: this.reconnectAttempts
        });
      });
    }, delay);
  }
}

module.exports = RabbitMQAdapter; 