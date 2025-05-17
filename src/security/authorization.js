/**
 * 授权模块 - 提供通用的访问控制能力
 * 本模块设计为框架性质，不绑定具体业务角色或权限模型
 * 
 * @module security/authorization
 */

const logger = require('../logging').logger;

/**
 * 权限检查接口 - 供具体实现扩展
 */
class AccessControlProvider {
  /**
   * 检查访问权限
   * 
   * @param {any} subject - 访问主体(通常是用户)
   * @param {string} action - 操作
   * @param {any} resource - 资源对象
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否允许访问
   */
  async checkAccess(subject, action, resource, context = {}) {
    // 这是一个抽象方法，子类需要实现
    throw new Error('AccessControlProvider.checkAccess 方法必须被子类实现');
  }
}

/**
 * 简单访问控制提供者 - 基于函数的访问控制
 */
class FunctionBasedProvider extends AccessControlProvider {
  /**
   * 创建基于函数的访问控制提供者
   * 
   * @param {Function} checkFunction - 访问检查函数
   */
  constructor(checkFunction) {
    super();
    if (typeof checkFunction !== 'function') {
      throw new Error('checkFunction 必须是一个函数');
    }
    this.checkFunction = checkFunction;
  }

  /**
   * 检查访问权限
   * 
   * @param {any} subject - 访问主体(通常是用户)
   * @param {string} action - 操作
   * @param {any} resource - 资源对象
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否允许访问
   */
  async checkAccess(subject, action, resource, context = {}) {
    try {
      return await this.checkFunction(subject, action, resource, context);
    } catch (error) {
      logger.error(`访问控制检查失败: ${error.message}`, { stack: error.stack });
      return false;
    }
  }
}

/**
 * 授权守卫 - 用于Web框架中间件
 */
class AuthorizationGuard {
  /**
   * 创建授权守卫
   * 
   * @param {AccessControlProvider} provider - 访问控制提供者
   * @param {Object} options - 配置选项
   */
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      subjectExtractor: (ctx) => ctx.state?.user || ctx.user,
      resourceExtractor: (ctx) => ctx.params?.id ? { id: ctx.params.id } : null,
      failureHandler: null,
      ...options
    };
  }

  /**
   * 创建一个授权检查中间件
   * 
   * @param {string} action - 要检查的操作
   * @param {Object} options - 中间件选项
   * @returns {Function} 中间件函数
   */
  createMiddleware(action, options = {}) {
    const middlewareOptions = { ...this.options, ...options };
    
    // Koa中间件
    const koaMiddleware = async (ctx, next) => {
      const subject = middlewareOptions.subjectExtractor(ctx);
      const resource = typeof middlewareOptions.resourceExtractor === 'function' 
        ? middlewareOptions.resourceExtractor(ctx) 
        : middlewareOptions.resourceExtractor;
      
      const allowed = await this.provider.checkAccess(
        subject, 
        action, 
        resource, 
        { ctx, type: 'koa' }
      );
      
      if (allowed) {
        return next();
      } else {
        if (typeof middlewareOptions.failureHandler === 'function') {
          return middlewareOptions.failureHandler(ctx);
        }
        
        // 默认失败行为
        ctx.status = 403;
        ctx.body = {
          code: 'ACCESS_DENIED',
          message: '权限不足'
        };
      }
    };
    
    // Express中间件
    const expressMiddleware = async (req, res, next) => {
      const ctx = { req, res, ...req };
      const subject = middlewareOptions.subjectExtractor(ctx);
      const resource = typeof middlewareOptions.resourceExtractor === 'function' 
        ? middlewareOptions.resourceExtractor(ctx) 
        : middlewareOptions.resourceExtractor;
      
      const allowed = await this.provider.checkAccess(
        subject, 
        action, 
        resource, 
        { req, res, type: 'express' }
      );
      
      if (allowed) {
        return next();
      } else {
        if (typeof middlewareOptions.failureHandler === 'function') {
          return middlewareOptions.failureHandler(req, res);
        }
        
        // 默认失败行为
        res.status(403).json({
          code: 'ACCESS_DENIED',
          message: '权限不足'
        });
      }
    };
    
    return {
      koa: koaMiddleware,
      express: expressMiddleware
    };
  }
}

/**
 * 基于属性的访问控制 (ABAC) 提供者
 * 更通用的访问控制方式，基于策略评估
 */
class PolicyBasedProvider extends AccessControlProvider {
  /**
   * 创建基于策略的访问控制提供者
   * 
   * @param {Object} options - 配置选项
   * @param {Array<Function>} options.policies - 策略函数数组
   * @param {string} options.combiningAlgorithm - 策略组合算法 ('permitOverrides'|'denyOverrides')
   */
  constructor(options = {}) {
    super();
    this.policies = options.policies || [];
    this.combiningAlgorithm = options.combiningAlgorithm || 'denyOverrides';
  }

  /**
   * 添加策略
   * 
   * @param {Function} policy - 策略函数
   * @returns {PolicyBasedProvider} 当前实例
   */
  addPolicy(policy) {
    if (typeof policy === 'function') {
      this.policies.push(policy);
    }
    return this;
  }

  /**
   * 设置策略组合算法
   * 
   * @param {string} algorithm - 策略组合算法
   * @returns {PolicyBasedProvider} 当前实例
   */
  setCombiningAlgorithm(algorithm) {
    this.combiningAlgorithm = algorithm;
    return this;
  }

  /**
   * 检查访问权限
   * 
   * @param {any} subject - 访问主体(通常是用户)
   * @param {string} action - 操作
   * @param {any} resource - 资源对象
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否允许访问
   */
  async checkAccess(subject, action, resource, context = {}) {
    try {
      if (!this.policies.length) {
        return false;
      }

      const results = await Promise.all(
        this.policies.map(policy => policy(subject, action, resource, context))
      );

      // 策略组合算法
      if (this.combiningAlgorithm === 'permitOverrides') {
        // 任一策略允许则允许
        return results.some(result => result === true);
      } else {
        // 默认使用 denyOverrides: 任一策略拒绝则拒绝
        return !results.some(result => result === false);
      }
    } catch (error) {
      logger.error(`策略评估失败: ${error.message}`, { stack: error.stack });
      return false;
    }
  }
}

/**
 * 创建一个基于函数的访问控制提供者
 * 
 * @param {Function} checkFunction - 访问检查函数
 * @returns {FunctionBasedProvider} 访问控制提供者
 */
function createFunctionBasedProvider(checkFunction) {
  return new FunctionBasedProvider(checkFunction);
}

/**
 * 创建一个基于策略的访问控制提供者
 * 
 * @param {Object} options - 配置选项
 * @returns {PolicyBasedProvider} 访问控制提供者
 */
function createPolicyBasedProvider(options = {}) {
  return new PolicyBasedProvider(options);
}

/**
 * 创建授权守卫
 * 
 * @param {AccessControlProvider} provider - 访问控制提供者
 * @param {Object} options - 配置选项
 * @returns {AuthorizationGuard} 授权守卫
 */
function createAuthorizationGuard(provider, options = {}) {
  return new AuthorizationGuard(provider, options);
}

module.exports = {
  // 基础类
  AccessControlProvider,
  FunctionBasedProvider,
  PolicyBasedProvider,
  AuthorizationGuard,
  
  // 工厂函数
  createFunctionBasedProvider,
  createPolicyBasedProvider,
  createAuthorizationGuard
}; 