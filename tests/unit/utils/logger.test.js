// 设置测试超时时间
jest.setTimeout(10000);

const winston = require('winston');
const { PassThrough } = require('stream');
const logger = require('../../../src/utils/logger');

describe('Logger 测试', () => {
  let testStream;
  let testTransport;
  let logMessages;

  beforeEach(() => {
    logMessages = [];
    testStream = new PassThrough();
    testTransport = new winston.transports.Stream({ stream: testStream });
    testStream.setEncoding('utf8');
    testStream.on('data', (chunk) => {
      // 日志格式通常为 JSON 字符串或带换行符
      chunk.split(/\r?\n/).filter(Boolean).forEach(line => {
        try {
          logMessages.push(JSON.parse(line));
        } catch (e) {
          // 非 JSON 格式日志
        }
      });
    });
    logger.add(testTransport);
  });

  afterEach(() => {
    logger.remove(testTransport);
    logMessages = [];
    testStream.destroy();
  });

  describe('日志级别', () => {
    it('应该正确记录error级别日志', (done) => {
      const message = '错误信息';
      const meta = { error: '测试错误' };
      logger.error(message, meta);
      setImmediate(() => {
        expect(logMessages[0].level).toBe('error');
        expect(logMessages[0].message).toBe(message);
        expect(logMessages[0].error).toBe('测试错误');
        done();
      });
    });

    it('应该正确记录warn级别日志', (done) => {
      const message = '警告信息';
      logger.warn(message);
      setImmediate(() => {
        expect(logMessages[0].level).toBe('warn');
        expect(logMessages[0].message).toBe(message);
        done();
      });
    });

    it('应该正确记录info级别日志', (done) => {
      const message = '信息日志';
      logger.info(message);
      setImmediate(() => {
        expect(logMessages[0].level).toBe('info');
        expect(logMessages[0].message).toBe(message);
        done();
      });
    });

    it('应该正确记录debug级别日志', (done) => {
      const message = '调试信息';
      logger.debug(message);
      setImmediate(() => {
        expect(logMessages[0].level).toBe('debug');
        expect(logMessages[0].message).toBe(message);
        done();
      });
    });
  });

  describe('日志格式', () => {
    it('应该包含时间戳', (done) => {
      logger.info('测试消息');
      setImmediate(() => {
        expect(logMessages[0].timestamp).toBeDefined();
        expect(logMessages[0].timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        done();
      });
    });

    it('应该包含服务名称', (done) => {
      logger.info('测试消息');
      setImmediate(() => {
        expect(logMessages[0].service).toBeDefined();
        expect(logMessages[0].service).toBe('app');
        done();
      });
    });

    it('应该正确处理元数据', (done) => {
      const meta = { user: 'testuser', action: 'login' };
      logger.info('用户操作', meta);
      setImmediate(() => {
        expect(logMessages[0].user).toBe('testuser');
        expect(logMessages[0].action).toBe('login');
        done();
      });
    });
  });

  describe('错误处理', () => {
    it('应该正确处理Error对象', (done) => {
      const error = new Error('测试错误');
      logger.error('发生错误', { error });
      setImmediate(() => {
        expect(logMessages[0].error).toBeDefined();
        expect(logMessages[0].error.message).toBe('测试错误');
        expect(logMessages[0].error.stack).toBeDefined();
        done();
      });
    });

    it('应该处理非Error对象', (done) => {
      const error = '字符串错误';
      logger.error('发生错误', { error });
      setImmediate(() => {
        expect(logMessages[0].error).toBe('字符串错误');
        done();
      });
    });
  });
}); 