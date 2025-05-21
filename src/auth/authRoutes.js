/**
 * 认证路由
 */

const { AppError } = require('../utils/errors');
const { validateBody } = require('../utils/validator');
const Router = require('@koa/router');
const { validate } = require('../utils/validator');

// 密码重置验证 schema
const resetPasswordSchema = {
  type: 'object',
  required: ['token', 'newPassword'],
  properties: {
    token: {
      type: 'string'
    },
    newPassword: {
      type: 'string',
      format: 'password',
      minLength: 6
    }
  }
};

// 修改密码验证 schema
const changePasswordSchema = {
  type: 'object',
  required: ['oldPassword', 'newPassword'],
  properties: {
    oldPassword: {
      type: 'string'
    },
    newPassword: {
      type: 'string',
      format: 'password',
      minLength: 6
    }
  }
};

// 验证模式
const schemas = {
  register: {
    type: 'object',
    required: ['username', 'email', 'password'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 30 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 }
    }
  },
  login: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string' },
      password: { type: 'string' }
    }
  }
};

/**
 * 认证路由
 * @param {Object} ctx - 应用上下文
 * @returns {Router} 路由实例
 */
function createAuthRoutes(ctx) {
  const router = new Router({ prefix: '/api/v1/auth' });
  const authService = ctx.app.service.auth;

  // 用户注册
  router.post('/register', async (ctx) => {
    try {
      // 验证请求数据
      const userData = await validate(ctx.request.body, schemas.register);
      
      // 调用注册服务
      const result = await authService.register(userData);
      
      // 返回成功响应
      ctx.body = {
        success: true,
        message: '注册成功',
        data: result.data
      };
    } catch (error) {
      ctx.status = error.status || 500;
      ctx.body = {
        success: false,
        message: error.message,
        error: {
          code: error.code,
          status: error.status
        }
      };
    }
  });

  // 用户登录
  router.post('/login', async (ctx) => {
    try {
      // 验证请求数据
      const credentials = await validate(ctx.request.body, schemas.login);
      
      // 调用登录服务
      const result = await authService.login(credentials);
      
      // 返回成功响应
      ctx.body = {
        success: true,
        message: '登录成功',
        data: result.data
      };
    } catch (error) {
      ctx.status = error.status || 500;
      ctx.body = {
        success: false,
        message: error.message,
        error: {
          code: error.code,
          status: error.status
        }
      };
    }
  });

  // 用户登出
  router.post('/logout', async (ctx) => {
    try {
      // 获取当前用户
      const user = ctx.state.user;
      if (!user) {
        throw new Error('用户未登录');
      }

      // 返回成功响应
      ctx.body = {
        success: true,
        message: '登出成功'
      };
    } catch (error) {
      ctx.status = error.status || 500;
      ctx.body = {
        success: false,
        message: error.message
      };
    }
  });

  return router;
}

module.exports = createAuthRoutes; 