# 消息队列模块

消息队列模块提供了统一的消息发布/订阅接口，支持多种消息中间件，实现微服务间的可靠异步通信。

## 功能特性

- 支持多种消息中间件（RabbitMQ、Kafka）
- 统一的生产者/消费者接口
- 支持消息重试和错误处理
- 批量消息处理
- 自动重连和容错
- 灵活的消息路由

## 快速开始

### 使用RabbitMQ

```javascript
const { mq } = require('@carturns/common-lib');

// 创建消息代理
const broker = mq.createMessageBroker({
  type: 'rabbitmq',
  host: 'localhost',
  port: 5672,
  username: 'guest',
  password: 'guest'
});

// 创建生产者
const producer = mq.createProducer(broker, {
  defaultExchange: 'my-exchange'
});

// 发送消息
await producer.send('user.created', { id: 1, name: '张三' });

// 创建消费者
const consumer = mq.createConsumer(broker, {
  queue: 'user-service'
});

// 订阅消息
await consumer.subscribe('user.*', async (message, context) => {
  console.log('收到消息:', message);
  // 处理消息...
}, {
  exchange: 'my-exchange'
});
```

### 使用Kafka

```javascript
const { mq } = require('@carturns/common-lib');

// 创建消息代理
const broker = mq.createMessageBroker({
  type: 'kafka',
  brokers: ['localhost:9092'],
  clientId: 'my-service'
});

// 创建生产者
const producer = mq.createProducer(broker);

// 发送消息
await producer.send('users', { id: 1, name: '张三' });

// 创建消费者
const consumer = mq.createConsumer(broker, {
  groupId: 'user-service'
});

// 订阅消息
await consumer.subscribe('users', async (message, context) => {
  console.log('收到消息:', message);
  // 处理消息...
});
```

## 高级用法

### 批量发送消息

```javascript
const { mq } = require('@carturns/common-lib');
const broker = mq.createMessageBroker({ type: 'rabbitmq' });
const producer = mq.createProducer(broker);

// 批量发送消息
await producer.sendBatch([
  {
    routingKey: 'user.created',
    content: { id: 1, name: '张三' },
    options: { exchange: 'users' }
  },
  {
    routingKey: 'user.created',
    content: { id: 2, name: '李四' },
    options: { exchange: 'users' }
  }
]);
```

### 消息重试与错误处理

```javascript
const { mq } = require('@carturns/common-lib');
const MessageHandler = mq.MessageHandler;

// 创建带重试的消息处理器
const handler = new MessageHandler({
  async handler(message, context) {
    // 处理消息，可能抛出异常
    await processMessage(message);
  },
  maxRetries: 3,
  retryDelay: 1000,
  async errorHandler(error, message, context) {
    // 所有重试失败后的处理
    await saveToDeadLetterQueue(message, error);
  }
});

// 使用处理器订阅消息
await consumer.subscribe('important-topic', handler);
```

### 创建交换机和队列（RabbitMQ）

```javascript
const { mq } = require('@carturns/common-lib');

async function setupMessageBroker() {
  const broker = mq.createMessageBroker({ type: 'rabbitmq' });
  await broker.connect();
  
  // 创建交换机
  await broker.createExchange('orders', 'topic', { durable: true });
  
  // 创建队列
  const queueInfo = await broker.createQueue('order-processing', { 
    durable: true,
    deadLetterExchange: 'dead-letter'
  });
  
  // 绑定队列到交换机
  await broker.bindQueue('order-processing', 'orders', 'order.#');
  
  return broker;
}
```

## 环境变量配置

模块支持通过环境变量进行配置：

### RabbitMQ配置

- `RABBITMQ_HOST` - RabbitMQ主机地址
- `RABBITMQ_PORT` - RabbitMQ端口
- `RABBITMQ_USERNAME` - 用户名
- `RABBITMQ_PASSWORD` - 密码
- `RABBITMQ_VHOST` - 虚拟主机
- `RABBITMQ_PREFETCH` - 预取数量

### Kafka配置

- `KAFKA_BROKERS` - Kafka代理地址（逗号分隔）
- `KAFKA_CLIENT_ID` - 客户端ID

### 通用配置

- `MQ_TYPE` - 消息队列类型（rabbitmq/kafka）
- `MQ_MAX_RETRIES` - 最大重试次数
- `MQ_RETRY_DELAY` - 重试延迟（毫秒）
- `MQ_PREFETCH` - 消费者预取数量

## 架构说明

消息队列模块采用适配器设计模式，提供统一的接口同时支持不同的消息中间件：

1. **消息代理工厂(MessageBrokerFactory)** - 负责创建不同类型的消息代理实例
2. **适配器(RabbitMQAdapter/KafkaAdapter)** - 适配不同消息中间件的API
3. **生产者(Producer)** - 负责发送消息的统一接口
4. **消费者(Consumer)** - 负责接收和处理消息的统一接口
5. **消息处理器(MessageHandler)** - 处理消息的业务逻辑，支持重试和错误处理

通过这种设计，应用代码无需关心底层消息中间件的差异，只需使用统一的接口即可。同时，在需要切换消息中间件时，只需修改配置，无需改动业务代码。 