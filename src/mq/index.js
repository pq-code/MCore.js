/**
 * 消息队列模块
 * 提供消息发布/订阅和生产者/消费者模式的统一接口
 * 
 * @module mq
 */

const MessageBrokerFactory = require('./MessageBrokerFactory');
const RabbitMQAdapter = require('./RabbitMQAdapter');
const KafkaAdapter = require('./KafkaAdapter');
const Producer = require('./Producer');
const Consumer = require('./Consumer');
const MessageHandler = require('./MessageHandler');

/**
 * 创建消息代理实例
 * 
 * @param {Object} options - 配置选项
 * @returns {Object} 消息代理实例
 */
function createMessageBroker(options = {}) {
  return MessageBrokerFactory.create(options);
}

/**
 * 创建生产者实例
 * 
 * @param {Object} broker - 消息代理实例
 * @param {Object} options - 配置选项
 * @returns {Producer} 生产者实例
 */
function createProducer(broker, options = {}) {
  return new Producer(broker, options);
}

/**
 * 创建消费者实例
 * 
 * @param {Object} broker - 消息代理实例
 * @param {Object} options - 配置选项
 * @returns {Consumer} 消费者实例
 */
function createConsumer(broker, options = {}) {
  return new Consumer(broker, options);
}

module.exports = {
  createMessageBroker,
  createProducer,
  createConsumer,
  MessageBrokerFactory,
  RabbitMQAdapter,
  KafkaAdapter,
  Producer,
  Consumer,
  MessageHandler
}; 