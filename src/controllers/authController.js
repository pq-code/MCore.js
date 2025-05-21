const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class AuthController {
  constructor(ctx) {
    this.ctx = ctx;
    this.businessService = ctx?.app?.service?.business;
    this.authService = ctx?.app?.service?.auth;
  }

  async register() {
    try {
      const userData = this.ctx.request.body;
      if (!userData.username || !userData.password || !userData.email) {
        this.ctx.status = 400;
        this.ctx.body = {
          success: false,
          message: '用户名、密码和邮箱不能为空',
          error: {
            code: 'BAD_REQUEST',
            status: 400,
            message: '用户名、密码和邮箱不能为空'
          },
          timestamp: new Date().toISOString()
        };
        return;
      }
      const result = await this.authService.register(userData);
      this.ctx.status = 201;
      this.ctx.body = {
        success: true,
        data: result,
        message: '注册成功',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      let status = error.status || 500;
      let code = error.code || 'INTERNAL_ERROR';
      let message = error.message;
      if (code === 'USER_EXISTS') status = 409;
      if (code === 'EMAIL_EXISTS') status = 409;
      this.ctx.status = status;
      this.ctx.body = {
        success: false,
        message,
        error: {
          code,
          status,
          message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async login() {
    try {
      const { username, password } = this.ctx.request.body;
      if (!username || !password) {
        this.ctx.status = 400;
        this.ctx.body = {
          success: false,
          message: '用户名和密码不能为空',
          error: {
            code: 'BAD_REQUEST',
            status: 400,
            message: '用户名和密码不能为空'
          },
          timestamp: new Date().toISOString()
        };
        return;
      }
      if (!this.businessService) {
        this.ctx.status = 500;
        this.ctx.body = {
          success: false,
          message: '业务服务未正确配置',
          error: {
            code: 'INTERNAL_ERROR',
            status: 500,
            message: '业务服务未正确配置'
          },
          timestamp: new Date().toISOString()
        };
        return;
      }
      const result = await this.businessService.login({ username, password });
      this.ctx.status = 200;
      this.ctx.body = {
        success: true,
        data: result,
        message: '登录成功',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('登录失败', { error: error.message, username: this.ctx.request.body.username });
      const status = error.status || 401;
      const code = error.code || 'INVALID_CREDENTIALS';
      const message = error.message;
      this.ctx.status = status;
      this.ctx.body = {
        success: false,
        message,
        error: {
          code,
          status,
          message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async logout() {
    try {
      if (!this.ctx.state.user) {
        this.ctx.status = 401;
        this.ctx.body = {
          success: false,
          message: '用户未登录',
          error: {
            code: 'UNAUTHORIZED',
            status: 401,
            message: '用户未登录'
          },
          timestamp: new Date().toISOString()
        };
        return;
      }
      await this.businessService.logout(this.ctx.state.user.id);
      logger.info('用户登出', { username: this.ctx.state.user.username });
      this.ctx.status = 200;
      this.ctx.body = {
        success: true,
        message: '登出成功',
        data: null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('登出失败', { error: error.message });
      const status = error.status || 401;
      const code = error.code || 'LOGOUT_FAILED';
      const message = error.message;
      this.ctx.status = status;
      this.ctx.body = {
        success: false,
        message,
        error: {
          code,
          status,
          message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async resetPassword() {
    try {
      const { token, newPassword } = this.ctx.request.body;
      if (!token || !newPassword) {
        this.ctx.status = 400;
        this.ctx.body = {
          success: false,
          message: '重置令牌和新密码不能为空',
          error: {
            code: 'BAD_REQUEST',
            status: 400,
            message: '重置令牌和新密码不能为空'
          },
          timestamp: new Date().toISOString()
        };
        return;
      }
      await this.authService.resetPassword(token, newPassword);
      this.ctx.status = 200;
      this.ctx.body = {
        success: true,
        message: '密码重置成功',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const status = error.status || 400;
      const code = error.code || 'PASSWORD_RESET_FAILED';
      const message = error.message;
      this.ctx.status = status;
      this.ctx.body = {
        success: false,
        message,
        error: {
          code,
          status,
          message
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  async requestPasswordReset() {
    try {
      const { email } = this.ctx.request.body;
      if (!email) {
        this.ctx.status = 400;
        this.ctx.body = {
          success: false,
          message: '邮箱不能为空',
          error: {
            code: 'BAD_REQUEST',
            status: 400,
            message: '邮箱不能为空'
          },
          timestamp: new Date().toISOString()
        };
        return;
      }
      await this.authService.requestPasswordReset(email);
      this.ctx.status = 200;
      this.ctx.body = {
        success: true,
        message: '密码重置邮件已发送',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const status = error.status || 400;
      const code = error.code || 'PASSWORD_RESET_REQUEST_FAILED';
      const message = error.message;
      this.ctx.status = status;
      this.ctx.body = {
        success: false,
        message,
        error: {
          code,
          status,
          message
        },
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = AuthController; 