/**
 * JWT工具
 * 提供令牌生成和验证功能
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class JWT {
  static generateToken(payload, ctx) {
  try {
      const jwtConfig = ctx.app && ctx.app.config && ctx.app.config.jwt;
      if (!jwtConfig || !jwtConfig.secret) {
        throw new AppError('CONFIG_ERROR', 'JWT配置缺失', 500);
      }
      const { secret, expiresIn } = jwtConfig;
      return jwt.sign(payload, secret, { expiresIn });
  } catch (error) {
    logger.error('生成JWT令牌失败', { error: error.message });
      throw new AppError('TOKEN_GENERATION_ERROR', error.message, 500);
  }
}

  static verifyToken(token, ctx) {
    try {
      const jwtConfig = ctx.app && ctx.app.config && ctx.app.config.jwt;
      if (!jwtConfig || !jwtConfig.secret) {
        throw new AppError('CONFIG_ERROR', 'JWT配置缺失', 500);
      }
      const { secret } = jwtConfig;
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
        throw new AppError('TOKEN_EXPIRED', '令牌已过期', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('INVALID_TOKEN', '无效的令牌', 401);
      }
      logger.error('JWT令牌验证失败', { error: error.message });
      throw new AppError('TOKEN_VERIFICATION_ERROR', error.message, 500);
  }
}

  static refreshToken(token, ctx) {
    try {
      const decoded = this.verifyToken(token, ctx);
      // 删除时间戳相关字段，确保生成新令牌
      const payload = { ...decoded };
      delete payload.iat;
      delete payload.exp;
      return this.generateToken(payload, ctx);
  } catch (error) {
      logger.error('刷新JWT令牌失败', { error: error.message });
      throw new AppError('TOKEN_REFRESH_ERROR', error.message, 401);
    }
  }
}

module.exports = JWT; 