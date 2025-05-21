// 设置测试超时时间
jest.setTimeout(10000);

const createAuthMiddleware = require('../../../src/auth/authMiddleware');
const { AppError } = require('../../../src/utils/errors');

describe('AuthMiddleware 测试', () => {
  let mockCtx;
  let mockNext;
  let mockAuthService;
  let mockUserService;
  let middleware;

  beforeEach(() => {
    // 模拟用户服务
    mockUserService = {
      findById: jest.fn()
    };

    // 模拟认证服务
    mockAuthService = {
      verifyToken: jest.fn()
    };

    // 模拟上下文
    mockCtx = {
      headers: {},
      state: {},
      app: {
        service: {
          user: mockUserService,
          auth: mockAuthService
        }
      }
    };

    // 模拟next函数
    mockNext = jest.fn();

    // 创建中间件实例
    middleware = createAuthMiddleware();
  });

  it('应该在缺少令牌时抛出错误', async () => {
    await expect(middleware(mockCtx, mockNext)).rejects.toThrow(
      new AppError('UNAUTHORIZED', '未提供认证令牌', 401)
    );
  });

  it('应该在令牌无效时抛出错误', async () => {
    mockCtx.headers.authorization = 'Bearer invalid-token';
    mockAuthService.verifyToken.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await expect(middleware(mockCtx, mockNext)).rejects.toThrow(
      new AppError('AUTH_ERROR', '认证失败', 401)
    );
  });

  it('应该在用户不存在时抛出错误', async () => {
    mockCtx.headers.authorization = 'Bearer valid-token';
    mockAuthService.verifyToken.mockReturnValue({ id: 1 });
    mockUserService.findById.mockResolvedValue(null);

    await expect(middleware(mockCtx, mockNext)).rejects.toThrow(
      new AppError('USER_NOT_FOUND', '用户不存在', 404)
    );
  });

  it('应该在用户被禁用时抛出错误', async () => {
    mockCtx.headers.authorization = 'Bearer valid-token';
    mockAuthService.verifyToken.mockReturnValue({ id: 1 });
    mockUserService.findById.mockResolvedValue({
      id: 1,
      status: 'inactive'
    });

    await expect(middleware(mockCtx, mockNext)).rejects.toThrow(
      new AppError('USER_INACTIVE', '用户账号已被禁用', 403)
    );
  });

  it('应该在角色权限不足时抛出错误', async () => {
    const roleMiddleware = createAuthMiddleware({ roles: ['admin'] });
    mockCtx.headers.authorization = 'Bearer valid-token';
    mockAuthService.verifyToken.mockReturnValue({ id: 1 });
    mockUserService.findById.mockResolvedValue({
      id: 1,
      status: 'active',
      role: 'user'
    });

    await expect(roleMiddleware(mockCtx, mockNext)).rejects.toThrow(
      new AppError('FORBIDDEN', '没有访问权限', 403)
    );
  });

  it('应该成功通过认证并设置用户信息', async () => {
    const user = {
      id: 1,
      username: 'testuser',
      status: 'active',
      role: 'user'
    };

    mockCtx.headers.authorization = 'Bearer valid-token';
    mockAuthService.verifyToken.mockReturnValue({ id: 1 });
    mockUserService.findById.mockResolvedValue(user);

    await middleware(mockCtx, mockNext);

    expect(mockCtx.state.user).toEqual(user);
    expect(mockNext).toHaveBeenCalled();
  });

  it('应该在非必需认证时允许无令牌通过', async () => {
    const optionalMiddleware = createAuthMiddleware({ required: false });
    await optionalMiddleware(mockCtx, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
}); 