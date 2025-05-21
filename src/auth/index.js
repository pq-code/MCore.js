/**
 * 认证模块
 * 提供用户认证、授权和标准的 OAuth2.0 功能
 */

const jwt = require('./jwt');
const authMiddleware = require('./authMiddleware');
const authRoutes = require('./authRoutes');
const oauthRoutes = require('./oauthRoutes');
const OAuth2ServerService = require('./OAuth2Server');
const AuthService = require('./AuthService');

// 创建 OAuth2.0 路由
const createOAuthRoutes = (ctx) => {
  const oauthService = new OAuth2ServerService(ctx);
  return {
    prefix: '/oauth',
    routes: {
      // 标准 OAuth2.0 端点
      'GET /authorize': oauthRoutes(oauthService).authorize,
      'POST /token': oauthRoutes(oauthRoutes).token,
      'POST /revoke': oauthRoutes(oauthRoutes).revoke,
      'POST /introspect': oauthRoutes(oauthRoutes).introspect
    }
  };
};

/**
 * 认证模块
 * @param {Object} ctx - 应用上下文
 * @returns {Object} 认证模块组件
 */
function createAuthModule(ctx) {
  // 创建认证服务
  const authService = new AuthService(ctx);
  
  // 创建认证路由
  const authRoutes = createAuthRoutes(ctx);
  
  // 创建认证中间件
  const authMiddleware = createAuthMiddleware();

  return {
    service: authService,
    routes: authRoutes,
    middleware: authMiddleware
  };
}

module.exports = {
  jwt,
  authMiddleware,
  authRoutes,
  createOAuthRoutes,
  OAuth2ServerService,
  createAuthModule,
  AuthService,
  createAuthRoutes,
  createAuthMiddleware
}; 