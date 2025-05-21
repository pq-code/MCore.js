// 设置测试超时时间
jest.setTimeout(10000);

const responseHandler = require('../../../src/middlewares/responseHandler');
const { RESPONSE_CODES } = require('../../../src/constants');

describe('ResponseHandler 中间件测试', () => {
  let mockCtx;
  let mockNext;

  beforeEach(() => {
    // 模拟上下文
    mockCtx = {
      body: undefined,
      status: 200,
      set: jest.fn(),
      response: {
        sendStatus: jest.fn()
      },
      app: {
        emit: jest.fn()
      },
      path: '/test'
    };

    // 模拟next函数
    mockNext = jest.fn();
  });

  it('应该正确处理成功的响应', async () => {
    const data = { id: 1, name: '测试' };
    mockNext = async () => { mockCtx.success(data); };

    await responseHandler()(mockCtx, mockNext);

    expect(mockCtx.body).toEqual({
      code: RESPONSE_CODES.SUCCESS,
      message: '操作成功',
      data
    });
  });

  it('应该正确处理空响应', async () => {
    mockNext = async () => { mockCtx.success(null); };
    mockCtx.body = undefined;

    await responseHandler()(mockCtx, mockNext);

    expect(mockCtx.body).toEqual({
      code: RESPONSE_CODES.SUCCESS,
      message: '操作成功',
      data: null
    });
  });

  it('应该保持错误响应的原始格式', async () => {
    const errorResponse = {
      code: RESPONSE_CODES.VALIDATION_ERROR,
      message: '错误信息',
      data: '详细错误'
    };
    mockCtx.body = errorResponse;

    await responseHandler()(mockCtx, mockNext);

    expect(mockCtx.body).toEqual(errorResponse);
  });

  it('应该调用next函数', async () => {
    await responseHandler()(mockCtx, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('应该正确处理404错误', async () => {
    mockCtx.status = 404;
    mockCtx.body = undefined;

    await responseHandler()(mockCtx, mockNext);

    expect(mockCtx.body).toEqual({
      code: RESPONSE_CODES.NOT_FOUND,
      message: `接口不存在: /test`,
      data: null
    });
  });

  it('应该正确处理服务器错误', async () => {
    const error = new Error('服务器错误');
    error.status = 500;
    mockNext.mockRejectedValue(error);

    await responseHandler()(mockCtx, mockNext);

    expect(mockCtx.status).toBe(500);
    expect(mockCtx.body).toEqual({
      code: RESPONSE_CODES.SERVER_ERROR,
      message: '服务器错误',
      data: expect.any(Object)
    });
    expect(mockCtx.app.emit).toHaveBeenCalledWith('error', error, mockCtx);
  });
}); 