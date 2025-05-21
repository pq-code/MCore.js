const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class BusinessService {
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.logger = logger;
  }

  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证
   * @param {string} credentials.username - 用户名
   * @param {string} credentials.password - 密码
   * @returns {Promise<Object>} 登录结果
   */
  async login(credentials) {
    try {
      // 验证登录凭证
      if (!credentials.username || !credentials.password) {
        throw AppError.badRequest('用户名和密码不能为空');
      }

      // 调用认证服务进行登录
      const authService = this.app.service.auth;
      if (!authService || typeof authService.login !== 'function') {
        throw AppError.internal('认证服务未正确配置');
      }

      const result = await authService.login(credentials);

      // 记录登录日志
      this.logger.info('用户登录成功', {
        username: credentials.username,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: {
          token: result.data.token,
          user: result.data.user
        }
      };
    } catch (error) {
      this.logger.error('登录失败', {
        error: error.message,
        username: credentials.username
      });
      throw error;
    }
  }
}

module.exports = BusinessService; 