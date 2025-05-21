/**
 * OAuth2.0 路由处理
 * 实现标准的 OAuth2.0 端点
 */

const { AppError } = require('../utils/errors');
const { validate } = require('../utils/validator');
const logger = require('../utils/logger');

// 标准 OAuth2.0 请求验证模式
const oauthRequestSchema = {
  type: 'object',
  required: ['grant_type', 'client_id', 'client_secret'],
  properties: {
    // 标准 OAuth2.0 参数
    grant_type: { 
      type: 'string', 
      enum: ['authorization_code', 'password', 'client_credentials', 'refresh_token'] 
    },
    client_id: { type: 'string' },
    client_secret: { type: 'string' },
    code: { type: 'string' },
    redirect_uri: { type: 'string', format: 'uri' },
    username: { type: 'string' },
    password: { type: 'string' },
    refresh_token: { type: 'string' },
    scope: { type: 'string' },
    state: { type: 'string' }
  }
};

// 创建路由处理函数
const createOAuthRoutes = (oauthService) => {
  return {
    // 授权端点 - 处理授权请求
    async authorize(ctx) {
      try {
        const { 
          response_type,
          client_id,
          redirect_uri,
          scope,
          state
        } = ctx.query;

        // 验证必要参数
        if (!response_type || !client_id || !redirect_uri) {
          throw new AppError('INVALID_REQUEST', '缺少必要参数', 400);
        }

        // 验证响应类型
        if (response_type !== 'code') {
          throw new AppError('UNSUPPORTED_RESPONSE_TYPE', '不支持的响应类型', 400);
        }

        // 处理授权请求
        const result = await oauthService.handleOAuthRequest('authorize');
        
        // 构建重定向 URL
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', result.code);
        if (state) {
          redirectUrl.searchParams.set('state', state);
        }

        ctx.redirect(redirectUrl.toString());
      } catch (error) {
        logger.error('OAuth2.0 授权请求失败', error);
        throw error;
      }
    },

    // 令牌端点 - 处理令牌请求
    async token(ctx) {
      try {
        // 验证请求参数
        const validatedData = await validate(ctx.request.body, oauthRequestSchema);
        
        // 处理不同类型的授权请求
        switch (validatedData.grant_type) {
          case 'authorization_code':
            if (!validatedData.code || !validatedData.redirect_uri) {
              throw new AppError('INVALID_REQUEST', '授权码和重定向URI不能为空', 400);
            }
            break;
            
          case 'password':
            if (!validatedData.username || !validatedData.password) {
              throw new AppError('INVALID_REQUEST', '用户名和密码不能为空', 400);
            }
            break;
            
          case 'client_credentials':
            // 客户端凭证模式不需要额外参数
            break;
            
          case 'refresh_token':
            if (!validatedData.refresh_token) {
              throw new AppError('INVALID_REQUEST', '刷新令牌不能为空', 400);
            }
            break;
            
          default:
            throw new AppError('UNSUPPORTED_GRANT_TYPE', '不支持的授权类型', 400);
        }
        
        // 处理 OAuth 请求
        const token = await oauthService.handleOAuthRequest('token');
        
        // 记录日志
        logger.info('OAuth2.0 令牌生成成功', {
          grantType: validatedData.grant_type,
          clientId: validatedData.client_id
        });
        
        ctx.body = token;
      } catch (error) {
        logger.error('OAuth2.0 令牌生成失败', error);
        throw error;
      }
    },
    
    // 令牌撤销端点
    async revoke(ctx) {
      try {
        const { token, token_type_hint } = ctx.request.body;
        if (!token) {
          throw new AppError('INVALID_REQUEST', '令牌不能为空', 400);
        }
        
        await oauthService.revokeToken(token, token_type_hint);
        
        logger.info('OAuth2.0 令牌撤销成功', { token, token_type_hint });
        
        ctx.status = 200;
      } catch (error) {
        logger.error('OAuth2.0 令牌撤销失败', error);
        throw error;
      }
    },
    
    // 令牌信息端点
    async introspect(ctx) {
      try {
        const { token, token_type_hint } = ctx.request.body;
        if (!token) {
          throw new AppError('INVALID_REQUEST', '令牌不能为空', 400);
        }
        
        const tokenInfo = await oauthService.getAccessToken(token);
        if (!tokenInfo) {
          ctx.body = { active: false };
          return;
        }
        
        ctx.body = {
          active: true,
          scope: tokenInfo.scope,
          client_id: tokenInfo.client.id,
          username: tokenInfo.user?.username,
          exp: Math.floor(tokenInfo.accessTokenExpiresAt.getTime() / 1000),
          iat: Math.floor(tokenInfo.createdAt.getTime() / 1000)
        };
      } catch (error) {
        logger.error('OAuth2.0 令牌信息获取失败', error);
        throw error;
      }
    }
  };
};

module.exports = createOAuthRoutes; 