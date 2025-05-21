// 设置测试超时时间
jest.setTimeout(10000);

const AuthController = require('../../../src/controllers/authController');
const { AppError } = require('../../../src/utils');

describe('AuthController 测试', () => {
  let controller;
  let mockCtx;
  let mockApp;
  let mockBusinessService;
  let mockAuthService;

  beforeEach(() => {
    // 模拟业务服务
    mockBusinessService = {
      login: jest.fn(),
      logout: jest.fn()
    };

    // 模拟认证服务
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      resetPassword: jest.fn(),
      requestPasswordReset: jest.fn()
    };

    // 模拟应用实例
    mockApp = {
      service: {
        business: mockBusinessService,
        auth: mockAuthService
      }
    };

    // 模拟上下文
    mockCtx = {
      request: {
        body: {}
      },
      state: {},
      body: null,
      status: 200,
      app: mockApp
    };

    // 创建控制器实例
    controller = new AuthController(mockCtx);
  });

  describe('register', () => {
    it('应该成功处理注册请求', async () => {
      // 准备测试数据
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };
      const mockResponse = {
        token: 'mock-token',
        user: { id: 1, username: userData.username, email: userData.email }
      };

      mockCtx.request.body = userData;
      mockAuthService.register.mockResolvedValue(mockResponse);

      // 执行注册
      await controller.register();

      // 验证结果
      expect(mockAuthService.register).toHaveBeenCalledWith(userData);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: true,
        data: mockResponse,
        message: '注册成功',
        timestamp: expect.any(String)
      }));
    });

    it('应该在缺少必要字段时抛出错误', async () => {
      mockCtx.request.body = { username: 'testuser' };

      await controller.register();

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '用户名、密码和邮箱不能为空',
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
          status: 400,
          message: '用户名、密码和邮箱不能为空'
        }),
        timestamp: expect.any(String)
      }));
    });

    it('应该在用户名已存在时抛出错误', async () => {
      mockCtx.request.body = {
        username: 'existinguser',
        email: 'test@example.com',
        password: 'password123'
      };
      const error = new AppError('USER_EXISTS', '用户名已存在', 409);
      mockAuthService.register.mockRejectedValue(error);

      await controller.register();

      expect(mockCtx.status).toBe(409);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '用户名已存在',
        error: expect.objectContaining({
          code: 'USER_EXISTS',
          status: 409,
          message: '用户名已存在'
        }),
        timestamp: expect.any(String)
      }));
    });

    it('应该在邮箱已被注册时抛出错误', async () => {
      mockCtx.request.body = {
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123'
      };
      const error = new AppError('EMAIL_EXISTS', '邮箱已被注册', 409);
      mockAuthService.register.mockRejectedValue(error);

      await controller.register();

      expect(mockCtx.status).toBe(409);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '邮箱已被注册',
        error: expect.objectContaining({
          code: 'EMAIL_EXISTS',
          status: 409,
          message: '邮箱已被注册'
        }),
        timestamp: expect.any(String)
      }));
    });
  });

  describe('login', () => {
    it('应该成功处理登录请求', async () => {
      // 准备测试数据
      const username = 'testuser';
      const password = 'password123';
      const mockResponse = {
        token: 'mock-token',
        user: { id: 1, username }
      };

      mockCtx.request.body = { username, password };
      mockBusinessService.login.mockResolvedValue(mockResponse);

      // 执行登录
      await controller.login();

      // 验证结果
      expect(mockBusinessService.login).toHaveBeenCalledWith({ username, password });
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: true,
        data: mockResponse,
        message: '登录成功',
        timestamp: expect.any(String)
      }));
    });

    it('应该在缺少用户名或密码时抛出错误', async () => {
      mockCtx.request.body = { username: 'testuser' };

      await controller.login();

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '用户名和密码不能为空',
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
          status: 400,
          message: '用户名和密码不能为空'
        }),
        timestamp: expect.any(String)
      }));
    });

    it('应该在业务服务未配置时抛出错误', async () => {
      mockCtx.request.body = { username: 'testuser', password: 'password123' };
      mockCtx.app.service.business = undefined;
      controller = new AuthController(mockCtx);
      await controller.login();
      expect(mockCtx.status).toBe(500);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '业务服务未正确配置',
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          status: 500,
          message: '业务服务未正确配置'
        }),
        timestamp: expect.any(String)
      }));
    });

    it('应该处理业务服务抛出的错误', async () => {
      mockCtx.request.body = { username: 'testuser', password: 'password123' };
      const error = new AppError('INVALID_CREDENTIALS', '用户名或密码错误', 401);
      mockBusinessService.login.mockRejectedValue(error);

      await controller.login();

      expect(mockCtx.status).toBe(401);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '用户名或密码错误',
        error: expect.objectContaining({
          code: 'INVALID_CREDENTIALS',
          status: 401,
          message: '用户名或密码错误'
        }),
        timestamp: expect.any(String)
      }));
    });
  });

  describe('logout', () => {
    it('应该成功处理登出请求', async () => {
      mockCtx.state.user = { username: 'testuser', id: 1 };
      mockBusinessService.logout.mockResolvedValue(true);

      await controller.logout();

      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: true,
        message: '登出成功',
        data: null,
        timestamp: expect.any(String)
      }));
    });

    it('应该在用户未登录时抛出错误', async () => {
      await controller.logout();

      expect(mockCtx.status).toBe(401);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        message: '用户未登录',
        error: expect.objectContaining({
          code: 'UNAUTHORIZED',
          status: 401,
          message: '用户未登录'
        }),
        timestamp: expect.any(String)
      }));
    });
  });

  describe('resetPassword', () => {
    it('应该成功重置密码', async () => {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'newPassword123'
      };

      mockCtx.request.body = resetData;
      mockAuthService.resetPassword.mockResolvedValue(true);

      await controller.resetPassword(mockCtx);

      expect(mockCtx.status).toBe(200);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: true,
        message: '密码重置成功'
      }));
    });

    it('应该在令牌无效时返回错误', async () => {
      const resetData = {
        token: 'invalid-token',
        newPassword: 'newPassword123'
      };

      mockCtx.request.body = resetData;
      mockAuthService.resetPassword.mockRejectedValue(
        new AppError('INVALID_TOKEN', '无效的重置令牌', 400)
      );

      await controller.resetPassword(mockCtx);

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_TOKEN',
          message: '无效的重置令牌'
        })
      }));
    });

    it('应该在密码不符合要求时返回错误', async () => {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'weak'
      };

      mockCtx.request.body = resetData;
      mockAuthService.resetPassword.mockRejectedValue(
        new AppError('INVALID_PASSWORD', '密码不符合要求', 400)
      );

      await controller.resetPassword(mockCtx);

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_PASSWORD',
          message: '密码不符合要求'
        })
      }));
    });
  });

  describe('requestPasswordReset', () => {
    it('应该成功发送密码重置邮件', async () => {
      const requestData = {
        email: 'test@example.com'
      };

      mockCtx.request.body = requestData;
      mockAuthService.requestPasswordReset.mockResolvedValue(true);

      await controller.requestPasswordReset(mockCtx);

      expect(mockCtx.status).toBe(200);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: true,
        message: '密码重置邮件已发送'
      }));
    });

    it('应该在邮箱不存在时返回错误', async () => {
      const requestData = {
        email: 'nonexistent@example.com'
      };

      mockCtx.request.body = requestData;
      mockAuthService.requestPasswordReset.mockRejectedValue(
        new AppError('USER_NOT_FOUND', '用户不存在', 404)
      );

      await controller.requestPasswordReset(mockCtx);

      expect(mockCtx.status).toBe(404);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        })
      }));
    });

    it('应该在邮箱格式无效时返回错误', async () => {
      const requestData = {
        email: 'invalid-email'
      };

      mockCtx.request.body = requestData;
      mockAuthService.requestPasswordReset.mockRejectedValue(
        new AppError('INVALID_EMAIL', '邮箱格式无效', 400)
      );

      await controller.requestPasswordReset(mockCtx);

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.body).toEqual(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_EMAIL',
          message: '邮箱格式无效'
        })
      }));
    });
  });
}); 