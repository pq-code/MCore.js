/**
 * 认证中间件
 * 提供基于JWT的认证流程
 */

const jwt = require('./jwt');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 创建认证中间件
 * @param {Object} options - 配置选项
 * @returns {Function} 中间件函数
 */
function createAuthMiddleware(options = {}) {
  const {
    required = true,
    roles = []
  } = options;

  return async (ctx, next) => {
    try {
      // 获取认证令牌
      const token = ctx.headers.authorization?.split(' ')[1];
      
      if (!token) {
        if (required) {
          throw new AppError('UNAUTHORIZED', '未提供认证令牌', 401);
        }
        return await next();
      }
      
      // 验证令牌
      const authService = ctx.app.service.auth;
      const decoded = authService.verifyToken(token);

      // 获取用户信息
      const user = await ctx.app.service.user.findById(decoded.id);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', '用户不存在', 404);
      }
      
      // 检查用户状态
      if (user.status !== 'active') {
        throw new AppError('USER_INACTIVE', '用户账号已被禁用', 403);
      }

      // 检查角色权限
      if (roles.length > 0 && !roles.includes(user.role)) {
        throw new AppError('FORBIDDEN', '没有访问权限', 403);
      }

      // 将用户信息添加到上下文
      ctx.state.user = user;
      ctx.state.token = decoded;

      await next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('AUTH_ERROR', '认证失败', 401);
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