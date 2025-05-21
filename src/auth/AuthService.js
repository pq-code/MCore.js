/**
 * 认证服务类
 * 提供完整的登录注册认证流程
 */

const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.logger = logger;
    this.config = ctx.app.config;
  }

  /**
   * 用户注册
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 注册结果
   */
  async register(userData) {
    try {
      const { username, email, password } = userData;

      // 验证必填字段
      if (!username || !email || !password) {
        throw new AppError('INVALID_INPUT', '用户名、邮箱和密码不能为空', 400);
      }

      // 检查用户名是否已存在
      const existingUser = await this.app.service.user.findByUsername(username);
      if (existingUser) {
        throw new AppError('USER_EXISTS', '用户名已存在', 409);
      }

      // 检查邮箱是否已存在
      const existingEmail = await this.app.service.user.findByEmail(email);
      if (existingEmail) {
        throw new AppError('EMAIL_EXISTS', '邮箱已被注册', 409);
      }

      // 密码加密
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 创建用户
      const user = await this.app.service.user.create({
        username,
        email,
        password: hashedPassword,
        status: 'active',
        createdAt: new Date()
      });

      // 生成令牌
      const token = this.generateToken(user);

      this.logger.info('用户注册成功', {
        username,
        email,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: {
          token,
          user: this.sanitizeUser(user)
        }
      };
    } catch (error) {
      this.logger.error('用户注册失败', {
        error: error.message,
        userData
      });
      throw error;
    }
  }

  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证
   * @returns {Promise<Object>} 登录结果
   */
  async login(credentials) {
    try {
      const { username, password } = credentials;

      // 验证必填字段
      if (!username || !password) {
        throw new AppError('INVALID_CREDENTIALS', '用户名和密码不能为空', 400);
      }

      // 查找用户
      const user = await this.app.service.user.findByUsername(username);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', '用户不存在', 404);
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new AppError('INVALID_PASSWORD', '密码错误', 401);
      }

      // 检查用户状态
      if (user.status !== 'active') {
        throw new AppError('USER_INACTIVE', '用户账号已被禁用', 403);
      }

      // 更新最后登录时间
      await this.app.service.user.update(user.id, {
        lastLoginAt: new Date()
      });

      // 生成令牌
      const token = this.generateToken(user);

      this.logger.info('用户登录成功', {
        username,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: {
          token,
          user: this.sanitizeUser(user)
        }
      };
    } catch (error) {
      this.logger.error('用户登录失败', {
        error: error.message,
        username: credentials.username
      });
      throw error;
    }
  }

  /**
   * 生成JWT令牌
   * @param {Object} user - 用户对象
   * @returns {string} JWT令牌
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.expiresIn
    });
  }

  /**
   * 验证JWT令牌
   * @param {string} token - JWT令牌
   * @returns {Object} 解码后的令牌数据
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.config.jwt.secret);
    } catch (error) {
      throw new AppError('INVALID_TOKEN', '无效的令牌', 401);
    }
  }

  /**
   * 清理用户敏感信息
   * @param {Object} user - 用户对象
   * @returns {Object} 清理后的用户对象
   */
  sanitizeUser(user) {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

module.exports = AuthService; 