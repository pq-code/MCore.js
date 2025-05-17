/**
 * Kafka适配器
 * 提供与Kafka的集成
 * 
 * @module mq/KafkaAdapter
 */

const { Kafka, logLevel } = require('kafkajs');
const logger = require('../logging').logger;

/**
 * Kafka适配器类
 */
class KafkaAdapter {
  /**
   * 创建Kafka适配器实例
   * 
   * @param {Object} options - 配置选项
   * @param {string|Array<string>} options.brokers - Kafka代理地址
   * @param {string} options.clientId - 客户端ID
   * @param {Object} options.ssl - SSL配置
   * @param {Object} options.sasl - SASL认证配置
   */
  constructor(options = {}) {
    // Kafka代理地址
    this.brokers = options.brokers || 
      (process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092']);
    
    // 客户端ID
    this.clientId = options.clientId || process.env.KAFKA_CLIENT_ID || 'carturns-client';
    
    // 创建Kafka客户端
    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      ssl: options.ssl,
      sasl: options.sasl,
      retry: options.retry || {
        initialRetryTime: 300,
        retries: 10
      },
      logLevel: options.logLevel || logLevel.ERROR
    });
    
    // 生产者与消费者实例
    this.producer = null;
    this.consumers = new Map();
    
    // 是否已连接
    this.connected = false;
    
    // Kafka管理客户端
    this.admin = this.kafka.admin();
  }
  
  /**
   * 连接到Kafka
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      return;
    }
    
    try {
      // 连接管理客户端
      await this.admin.connect();
      
      // 创建并连接生产者
      this.producer = this.kafka.producer();
      await this.producer.connect();
      
      this.connected = true;
      
      logger.info(`已连接到Kafka: ${this.brokers.join(', ')}`);
    } catch (err) {
      logger.error(`连接Kafka失败: ${err.message}`, {
        stack: err.stack,
        brokers: this.brokers
      });
      
      this.connected = false;
      throw err;
    }
  }
  
  /**
   * 断开Kafka连接
   * 
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      // 断开所有消费者
      for (const [groupId, consumer] of this.consumers.entries()) {
        try {
          await consumer.disconnect();
          logger.info(`已断开Kafka消费者: ${groupId}`);
        } catch (err) {
          logger.error(`断开Kafka消费者失败: ${groupId}: ${err.message}`);
        }
      }
      
      // 清空消费者映射
      this.consumers.clear();
      
      // 断开生产者
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }
      
      // 断开管理客户端
      if (this.admin) {
        await this.admin.disconnect();
      }
      
      this.connected = false;
      
      logger.info('已断开Kafka连接');
    } catch (err) {
      logger.error(`断开Kafka连接失败: ${err.message}`, {
        stack: err.stack
      });
    }
  }
  
  /**
   * 检查是否已连接
   * 
   * @returns {boolean} 是否已连接
   */
  isConnected() {
    return this.connected && this.producer !== null;
  }
  
  /**
   * 创建主题
   * 
   * @param {string} topic - 主题名称
   * @param {Object} options - 主题选项
   * @param {number} options.numPartitions - 分区数
   * @param {number} options.replicationFactor - 复制因子
   * @returns {Promise<Object>} 主题信息
   */
  async createTopic(topic, options = {}) {
    if (!this.isConnected()) {
      await this.connect();
    }
    
    const topicConfig = {
      topic,
      numPartitions: options.numPartitions || 1,
      replicationFactor: options.replicationFactor || 1,
      configEntries: options.configEntries || []
    };
    
    try {
      await this.admin.createTopics({
        topics: [topicConfig],
        waitForLeaders: true
      });
      
      logger.info(`已创建Kafka主题: ${topic}`);
      
      return { 
        topic,
        numPartitions: topicConfig.numPartitions,
        replicationFactor: topicConfig.replicationFactor
      };
    } catch (err) {
      // 如果主题已存在，不视为错误
      if (err.message.includes('already exists')) {
        logger.info(`Kafka主题已存在: ${topic}`);
        
        return { 
          topic,
          exists: true
        };
      }
      
      logger.error(`创建Kafka主题失败: ${err.message}`, {
        stack: err.stack,
        topic
      });
      
      throw err;
    }
  }
  
  /**
   * 创建交换机（在Kafka中，这个概念对应的是主题）
   * 
   * @param {string} exchange - 交换机名称（主题）
   * @param {string} type - 交换机类型（在Kafka中无意义）
   * @param {Object} options - 交换机选项
   * @returns {Promise<Object>} 交换机信息
   */
  async createExchange(exchange, type, options = {}) {
    return this.createTopic(exchange, options);
  }
  
  /**
   * 创建队列（在Kafka中，这个概念对应的是消费者组）
   * 
   * @param {string} queue - 队列名称（消费者组ID）
   * @param {Object} options - 队列选项
   * @returns {Promise<Object>} 队列信息
   */
  async createQueue(queue, options = {}) {
    // 在Kafka中，队列概念对应消费者组，无需预先创建
    return { queue };
  }
  
  /**
   * 绑定队列到交换机（在Kafka中通过订阅主题实现）
   * 
   * @param {string} queue - 队列名称（消费者组ID）
   * @param {string} exchange - 交换机名称（主题）
   * @param {string} pattern - 绑定模式（在Kafka中无意义）
   * @returns {Promise<Object>} 绑定信息
   */
  async bindQueue(queue, exchange, pattern) {
    // 在Kafka中，绑定是通过订阅主题实现的，这里只返回信息
    return { queue, topic: exchange };
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
       * @param {string} routingKey - 路由键（在Kafka中是主题）
       * @param {Object} message - 消息内容
       * @param {Object} options - 发送选项
       * @returns {Promise<Object>} 发送结果
       */
      send: async (routingKey, message, options = {}) => {
        // 确保连接可用
        if (!this.isConnected()) {
          await this.connect();
        }
        
        // 在Kafka中，routingKey对应主题，exchange被忽略
        const topic = options.exchange || routingKey;
        
        // 准备消息
        const kafkaMessage = {
          key: options.key || message.messageId || null,
          value: message.content,
          headers: message.headers || {},
          timestamp: message.timestamp ? new Date(message.timestamp).getTime().toString() : undefined
        };
        
        try {
          // 发送消息
          const result = await this.producer.send({
            topic,
            messages: [kafkaMessage],
            acks: options.acks !== undefined ? options.acks : -1,
            timeout: options.timeout || 30000,
            compression: options.compression || 0
          });
          
          return result;
        } catch (err) {
          logger.error(`发送Kafka消息失败: ${err.message}`, {
            stack: err.stack,
            topic,
            key: kafkaMessage.key
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
      sendBatch: async messages => {
        // 确保连接可用
        if (!this.isConnected()) {
          await this.connect();
        }
        
        // 按主题分组消息
        const messagesByTopic = {};
        
        for (const msg of messages) {
          const topic = (msg.options && msg.options.exchange) || msg.routingKey;
          
          if (!messagesByTopic[topic]) {
            messagesByTopic[topic] = [];
          }
          
          messagesByTopic[topic].push({
            key: (msg.options && msg.options.key) || msg.message.messageId || null,
            value: msg.message.content,
            headers: msg.message.headers || {},
            timestamp: msg.message.timestamp ? new Date(msg.message.timestamp).getTime().toString() : undefined
          });
        }
        
        // 批量发送
        try {
          const topicMessages = Object.entries(messagesByTopic).map(([topic, messages]) => ({
            topic,
            messages
          }));
          
          const result = await this.producer.sendBatch({
            topicMessages,
            acks: options.acks !== undefined ? options.acks : -1,
            timeout: options.timeout || 30000,
            compression: options.compression || 0
          });
          
          return result;
        } catch (err) {
          logger.error(`批量发送Kafka消息失败: ${err.message}`, {
            stack: err.stack,
            topics: Object.keys(messagesByTopic)
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
    
    // 消费者组ID
    const groupId = options.queue || options.groupId || `${this.clientId}-${Date.now()}`;
    
    // 如果已有该消费者组的消费者，直接返回
    if (this.consumers.has(groupId)) {
      return this._createConsumerInterface(this.consumers.get(groupId), groupId, options);
    }
    
    // 创建Kafka消费者
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: options.sessionTimeout || 30000,
      heartbeatInterval: options.heartbeatInterval || 3000,
      maxBytesPerPartition: options.maxBytesPerPartition,
      maxWaitTimeInMs: options.maxWaitTimeInMs || 5000,
      autoCommit: options.autoCommit !== false,
      autoCommitInterval: options.autoCommitInterval || 5000,
      autoCommitThreshold: options.autoCommitThreshold || 100
    });
    
    // 连接消费者
    await consumer.connect();
    
    // 保存消费者实例
    this.consumers.set(groupId, consumer);
    
    logger.info(`已创建Kafka消费者: ${groupId}`);
    
    // 创建消费者接口
    return this._createConsumerInterface(consumer, groupId, options);
  }
  
  /**
   * 创建消费者接口
   * 
   * @private
   * @param {Object} consumer - Kafka消费者实例
   * @param {string} groupId - 消费者组ID
   * @param {Object} options - 消费者选项
   * @returns {Object} 消费者接口
   */
  _createConsumerInterface(consumer, groupId, options) {
    // 订阅映射
    const subscriptions = new Map();
    
    // 创建消费者接口
    const consumerInterface = {
      /**
       * 订阅主题
       * 
       * @param {string} pattern - 订阅模式（主题名称）
       * @param {Function} handler - 消息处理函数
       * @param {Object} subOptions - 订阅选项
       * @returns {Promise<string>} 订阅ID
       */
      subscribe: async (pattern, handler, subOptions = {}) => {
        // 在Kafka中，pattern对应主题名称，exchange被忽略
        const topic = (subOptions.exchange || pattern);
        
        // 确认主题存在
        try {
          await this.createTopic(topic, {
            numPartitions: subOptions.numPartitions || 1,
            replicationFactor: subOptions.replicationFactor || 1
          });
        } catch (err) {
          // 主题已存在或者无法创建，但仍然可以尝试订阅
          logger.warn(`订阅前创建Kafka主题失败: ${err.message}，尝试直接订阅`);
        }
        
        // 订阅主题
        await consumer.subscribe({
          topic,
          fromBeginning: subOptions.fromBeginning || false
        });
        
        // 生成订阅ID
        const subscriptionId = `${topic}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // 保存订阅信息
        subscriptions.set(subscriptionId, { topic, handler });
        
        // 如果这是第一个订阅，启动消费
        if (subscriptions.size === 1) {
          // 执行消费
          await consumer.run({
            partitionsConsumedConcurrently: subOptions.concurrency || 1,
            eachMessage: async ({ topic, partition, message }) => {
              // 查找处理该主题的所有订阅
              const handlers = Array.from(subscriptions.entries())
                .filter(([, sub]) => sub.topic === topic)
                .map(([, sub]) => sub.handler);
              
              if (handlers.length === 0) {
                return;
              }
              
              // 构造消息对象
              const kafkaMessage = {
                topic,
                partition,
                offset: message.offset,
                key: message.key ? message.key.toString() : null,
                value: message.value,
                headers: message.headers,
                timestamp: message.timestamp,
                routingKey: topic,
                content: message.value,
                properties: {
                  messageId: message.key ? message.key.toString() : null,
                  headers: message.headers,
                  timestamp: message.timestamp
                },
                originalMessage: message
              };
              
              // 并行调用所有处理函数
              await Promise.all(handlers.map(h => h(kafkaMessage)));
            }
          });
        }
        
        logger.info(`已订阅Kafka主题: ${topic} (${groupId})`);
        
        return subscriptionId;
      },
      
      /**
       * 取消订阅
       * 
       * @param {string} subscriptionId - 订阅ID
       * @returns {Promise<boolean>} 是否成功取消
       */
      unsubscribe: async subscriptionId => {
        if (!subscriptions.has(subscriptionId)) {
          return false;
        }
        
        const { topic } = subscriptions.get(subscriptionId);
        
        // 移除订阅
        subscriptions.delete(subscriptionId);
        
        // 检查是否还有对该主题的其他订阅
        const hasMoreSubscriptionsForTopic = Array.from(subscriptions.values())
          .some(sub => sub.topic === topic);
        
        // 如果没有其他订阅，停止消费该主题
        if (!hasMoreSubscriptionsForTopic) {
          try {
            await consumer.stop();
            await consumer.disconnect();
            
            // 移除消费者实例
            this.consumers.delete(groupId);
            
            logger.info(`已取消订阅并停止Kafka消费者: ${topic} (${groupId})`);
          } catch (err) {
            logger.error(`停止Kafka消费者失败: ${err.message}`, {
              stack: err.stack,
              topic,
              groupId
            });
          }
        } else {
          logger.info(`已取消订阅Kafka主题: ${topic} (${groupId}), 保留其他订阅`);
        }
        
        return true;
      },
      
      /**
       * 确认消息（Kafka使用自动提交或手动提交）
       * 
       * @param {Object} message - 消息对象
       * @returns {Promise<void>}
       */
      ack: async message => {
        if (options.autoCommit === false) {
          await consumer.commitOffsets([{
            topic: message.topic,
            partition: message.partition,
            offset: (parseInt(message.offset, 10) + 1).toString()
          }]);
        }
      },
      
      /**
       * 拒绝消息（Kafka没有拒绝的概念，这里只是不提交偏移量）
       * 
       * @param {Object} message - 消息对象
       * @param {boolean} requeue - 是否重新入队（在Kafka中无意义）
       * @returns {Promise<void>}
       */
      nack: async (message, requeue = false) => {
        // Kafka没有显式的拒绝消息的API，只能不提交偏移量
        // 如果是自动提交模式，这个操作实际上没有效果
      }
    };
    
    return consumerInterface;
  }
}

module.exports = KafkaAdapter; 