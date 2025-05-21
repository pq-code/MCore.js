// 设置测试超时时间
jest.setTimeout(10000);

const { api } = require('../../../src/utils');
const { AppError } = require('../../../src/utils');

describe('API 工具测试', () => {
  describe('createSuccessResponse', () => {
    it('应该创建标准的成功响应', () => {
      const data = { id: 1, name: '测试' };
      const message = '操作成功';
      const response = api.createSuccessResponse(data, message);

      expect(response).toEqual({
        success: true,
        message,
        data,
        timestamp: expect.any(String)
      });
    });

    it('应该使用默认消息当未提供时', () => {
      const response = api.createSuccessResponse();
      expect(response.message).toBe('操作成功');
    });
  });

  describe('createErrorResponse', () => {
    it('应该创建标准的错误响应', () => {
      const error = new AppError('BAD_REQUEST', '无效的请求', 400);
      const response = api.createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        message: '无效的请求',
        error: {
          code: 'BAD_REQUEST',
          status: 400
        },
        timestamp: expect.any(String)
      });
    });

    it('应该处理普通 Error 对象', () => {
      const error = new Error('未知错误');
      const response = api.createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        message: '未知错误',
        error: {
          code: 'INTERNAL_ERROR',
          status: 500
        },
        timestamp: expect.any(String)
      });
    });

    it('在开发环境下应该包含堆栈信息', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('测试错误');
      const response = api.createErrorResponse(error);

      expect(response.error.stack).toBeDefined();
      process.env.NODE_ENV = 'test';
    });
  });

  describe('handleResponse', () => {
    it('应该正确处理成功的响应', async () => {
      const ctx = {
        body: null
      };
      const handler = jest.fn().mockResolvedValue({ data: '测试数据' });

      await api.handleResponse(ctx, handler);

      expect(ctx.body).toEqual({
        success: true,
        message: '操作成功',
        data: { data: '测试数据' },
        timestamp: expect.any(String)
      });
    });

    it('应该正确处理错误的响应', async () => {
      const ctx = {
        body: null,
        status: 200
      };
      const error = new AppError('BAD_REQUEST', '无效的请求', 400);
      const handler = jest.fn().mockRejectedValue(error);

      await api.handleResponse(ctx, handler);

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({
        success: false,
        message: '无效的请求',
        error: {
          code: 'BAD_REQUEST',
          status: 400
        },
        timestamp: expect.any(String)
      });
    });
  });
}); 