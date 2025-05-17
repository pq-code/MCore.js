/**
 * 消息代理工厂类
 * 创建不同类型的消息队列适配器
 * 
 * @module mq/MessageBrokerFactory
 */

const RabbitMQAdapter = require('./RabbitMQAdapter');
const KafkaAdapter = require('./KafkaAdapter');
const logger = require('../logging').logger;

/**
 * 消息队列类型枚举
 */
const BROKER_TYPES = {
  RABBITMQ: 'rabbitmq',
  KAFKA: 'kafka',
  NONE: 'none'
};

/**
 * 消息代理工厂类
 */
class MessageBrokerFactory {
  /**
   * 创建消息代理实例
   * 
   * @static
   * @param {Object} options - 配置选项
   * @param {string} options.type - 消息队列类型，可选值：rabbitmq, kafka, none
   * @returns {Object} 消息代理实例
   */
  static create(options = {}) {
    // 默认使用RabbitMQ
    const type = (options.type || process.env.MQ_TYPE || BROKER_TYPES.RABBITMQ).toLowerCase();
    
    switch (type) {
    case BROKER_TYPES.RABBITMQ:
      return new RabbitMQAdapter(options);
    case BROKER_TYPES.KAFKA:
      return new KafkaAdapter(options);
    case BROKER_TYPES.NONE:
      return MessageBrokerFactory.createNoneBroker();
    default:
      logger.warn(`未知的消息队列类型: ${type}，将使用RabbitMQ`);
      return new RabbitMQAdapter(options);
    }
  }
  
  /**
   * 创建空消息代理实例
   * 
   * @static
   * @returns {Object} 空消息代理实例
   */
  static createNoneBroker() {
    return {
      connect: async () => Promise.resolve(),
      disconnect: async () => Promise.resolve(),
      createProducer: () => ({
        send: async () => Promise.resolve(),
        sendBatch: async () => Promise.resolve()
      }),
      createConsumer: () => ({
        subscribe: async () => Promise.resolve(),
        unsubscribe: async () => Promise.resolve()
      }),
      createExchange: async () => Promise.resolve(),
      createQueue: async () => Promise.resolve(),
      bindQueue: async () => Promise.resolve(),
      isConnected: () => false
    };
  }
}

module.exports = MessageBrokerFactory;
module.exports.BROKER_TYPES = BROKER_TYPES; 