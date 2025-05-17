/**
 * 认证中间件
 * 提供基于JWT的认证流程
 */

const jwt = require('./jwt');
const logger = require('../utils/logger');

/**
 * 创建认证中间件
 * @param {Object} options 配置选项
 * @param {string} options.secret JWT密钥，默认使用环境变量 JWT_SECRET
 * @param {boolean} options.fetchUser 是否从用户服务获取用户信息
 * @param {Function} options.userFetcher 用户信息获取函数
 * @returns {Function} Koa中间件函数
 */
function createAuthMiddleware(options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
  const fetchUser = options.fetchUser !== false;
  const userFetcher = options.userFetcher;
  
  if (!secret) {
    throw new Error('JWT密钥未设置，请配置环境变量JWT_SECRET或在选项中提供secret');
  }
  
  return async function authMiddleware(ctx, next) {
    try {
      // 从请求头或查询参数中获取令牌
      const token = getTokenFromRequest(ctx);
      
      if (!token) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: '未提供认证令牌',
          data: null
        };
        return;
      }
      
      // 验证令牌
      const payload = jwt.verifyToken(token, secret);
      
      if (!payload) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: '认证令牌无效或已过期',
          data: null
        };
        return;
      }
      
      // 将解码后的载荷保存到上下文状态
      ctx.state.user = payload;
      
      // 如果需要，从用户服务获取完整的用户信息
      if (fetchUser && userFetcher && typeof userFetcher === 'function') {
        try {
          const userInfo = await userFetcher(payload.userId || payload.sub);
          if (userInfo) {
            ctx.state.userInfo = userInfo;
          }
        } catch (error) {
          logger.warn('获取用户信息失败', { 
            error: error.message, 
            userId: payload.userId || payload.sub 
          });
          // 获取用户信息失败不阻止请求继续进行
        }
      }
      
      // 继续处理请求
      await next();
    } catch (error) {
      logger.error('认证中间件出错', { error: error.message });
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '认证处理过程中发生错误',
        data: null
      };
    }
  };
}

/**
 * 从请求中获取令牌
 * @param {Object} ctx Koa上下文
 * @returns {string|null} JWT令牌
 */
function getTokenFromRequest(ctx) {
  // 首先从Authorization头获取
  const authHeader = ctx.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // 然后从查询参数中获取
  if (ctx.query && ctx.query.token) {
    return ctx.query.token;
  }
  
  // 最后从cookie中获取
  if (ctx.cookies && ctx.cookies.get('token')) {
    return ctx.cookies.get('token');
  }
  
  return null;
}

module.exports = createAuthMiddleware; 