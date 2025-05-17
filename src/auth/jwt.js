/**
 * JWT工具
 * 提供令牌生成和验证功能
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * 生成JWT令牌
 * @param {Object} payload 令牌载荷
 * @param {string} secret 密钥
 * @param {Object} options 配置选项
 * @returns {string} JWT令牌
 */
function generateToken(payload, secret, options = {}) {
  try {
    const defaultOptions = {
      expiresIn: '24h' // 默认过期时间为24小时
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    return jwt.sign(payload, secret, mergedOptions);
  } catch (error) {
    logger.error('生成JWT令牌失败', { error: error.message });
    throw new Error(`生成JWT令牌失败: ${error.message}`);
  }
}

/**
 * 验证JWT令牌
 * @param {string} token JWT令牌
 * @param {string} secret 密钥
 * @returns {Object|null} 解码后的载荷，验证失败则返回null
 */
function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('JWT令牌已过期', { error: error.message });
    } else {
      logger.error('JWT令牌验证失败', { error: error.message });
    }
    return null;
  }
}

/**
 * 解码JWT令牌（不验证签名）
 * @param {string} token JWT令牌
 * @returns {Object|null} 解码后的载荷，解码失败则返回null
 */
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error('解码JWT令牌失败', { error: error.message });
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken
}; 