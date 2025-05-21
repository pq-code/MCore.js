// 设置测试超时时间
jest.setTimeout(10000);

const jwt = require('../../../src/auth/jwt');
const { AppError } = require('../../../src/utils/errors');

describe('JWT 测试', () => {
  let mockCtx;
  let mockConfig;

  beforeEach(() => {
    // 模拟配置
    mockConfig = {
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h'
      }
    };

    // 模拟上下文
    mockCtx = {
      app: {
        config: mockConfig
      }
    };
  });

  describe('generateToken', () => {
    it('应该成功生成令牌', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'user'
      };

      const token = jwt.generateToken(payload, mockCtx);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('应该在缺少配置时抛出错误', () => {
      const payload = { id: 1 };
      mockCtx.app.config = {};

      expect(() => jwt.generateToken(payload, mockCtx)).toThrow(
        new AppError('CONFIG_ERROR', 'JWT配置缺失', 500)
      );
    });
  });

  describe('verifyToken', () => {
    it('应该成功验证有效令牌', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'user'
      };

      const token = jwt.generateToken(payload, mockCtx);
      const decoded = jwt.verifyToken(token, mockCtx);

      expect(decoded).toMatchObject(payload);
    });

    it('应该在令牌无效时抛出错误', () => {
      expect(() => jwt.verifyToken('invalid-token', mockCtx)).toThrow(
        new AppError('INVALID_TOKEN', '无效的令牌', 401)
      );
    });

    it('应该在令牌过期时抛出错误', (done) => {
      // 生成一个已过期的令牌
      const payload = { id: 1 };
      const expiredToken = jwt.generateToken(payload, {
        app: {
          config: {
            jwt: {
              secret: 'test-secret',
              expiresIn: '0s' // 立即过期
            }
          }
        }
      });
      // 等待令牌过期
      setTimeout(() => {
        expect(() => jwt.verifyToken(expiredToken, mockCtx)).toThrow(
          new AppError('TOKEN_EXPIRED', '令牌已过期', 401)
        );
        done();
      }, 1000);
    });

    it('应该在缺少配置时抛出错误', () => {
      const token = 'valid-token';
      mockCtx.app.config = {};

      expect(() => jwt.verifyToken(token, mockCtx)).toThrow(
        new AppError('CONFIG_ERROR', 'JWT配置缺失', 500)
      );
    });
  });

  describe('refreshToken', () => {
    it('应该成功刷新令牌', async () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'user'
      };

      const oldToken = jwt.generateToken(payload, mockCtx);
      // 等待1秒，确保iat不同
      await new Promise(r => setTimeout(r, 1000));
      const newToken = jwt.refreshToken(oldToken, mockCtx);

      expect(newToken).toBeDefined();
      expect(typeof newToken).toBe('string');
      expect(newToken).not.toBe(oldToken);
    });

    it('应该在令牌无效时抛出错误', () => {
      expect(() => jwt.refreshToken('invalid-token', mockCtx)).toThrow(
        new AppError('INVALID_TOKEN', '无效的令牌', 401)
      );
    });

    it('应该在缺少配置时抛出错误', () => {
      const token = 'valid-token';
      mockCtx.app.config = {};

      expect(() => jwt.refreshToken(token, mockCtx)).toThrow(
        new AppError('CONFIG_ERROR', 'JWT配置缺失', 500)
      );
    });
  });
}); 