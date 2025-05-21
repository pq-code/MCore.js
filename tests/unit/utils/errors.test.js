// 设置测试超时时间
jest.setTimeout(10000);

const { AppError } = require('../../../src/utils/errors');

describe('AppError 测试', () => {
  describe('构造函数', () => {
    it('应该正确创建错误实例', () => {
      const error = new AppError('TEST_ERROR', '测试错误', 400);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('测试错误');
      expect(error.status).toBe(400);
      expect(error.stack).toBeDefined();
    });

    it('应该使用默认状态码500', () => {
      const error = new AppError('TEST_ERROR', '测试错误');
      expect(error.status).toBe(500);
    });
  });

  describe('静态工厂方法', () => {
    it('badRequest 应该创建400错误', () => {
      const error = AppError.badRequest('无效请求');
      expect(error.status).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('unauthorized 应该创建401错误', () => {
      const error = AppError.unauthorized('未授权');
      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('forbidden 应该创建403错误', () => {
      const error = AppError.forbidden('禁止访问');
      expect(error.status).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('notFound 应该创建404错误', () => {
      const error = AppError.notFound('资源不存在');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('internal 应该创建500错误', () => {
      const error = AppError.internal('服务器错误');
      expect(error.status).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('错误继承', () => {
    it('应该正确继承Error类', () => {
      const error = new AppError('TEST_ERROR', '测试错误');
      expect(error instanceof Error).toBe(true);
    });

    it('应该包含正确的错误名称', () => {
      const error = new AppError('TEST_ERROR', '测试错误');
      expect(error.name).toBe('AppError');
    });
  });

  describe('错误序列化', () => {
    it('toJSON 应该返回正确的错误对象', () => {
      const error = new AppError('TEST_ERROR', '测试错误', 400);
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'TEST_ERROR',
        message: '测试错误',
        status: 400,
        name: 'AppError'
      });
    });
  });
}); 