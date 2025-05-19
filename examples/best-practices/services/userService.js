/**
 * 用户服务
 */

const BaseService = require('./BaseService');
const { AppError } = require('../utils/errors');
const { validateBody } = require('../utils/validator');

// 用户数据验证 schema
const userSchema = {
  type: 'object',
  required: ['username', 'email', 'password'],
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 20
    },
    email: {
      type: 'string',
      format: 'email'
    },
    password: {
      type: 'string',
      format: 'password'
    },
    phone: {
      type: 'string',
      format: 'phone'
    },
    role: {
      type: 'string',
      enum: ['user', 'admin']
    }
  }
};

class UserService extends BaseService {
  constructor(ctx) {
    super(ctx);
    this.model = this.app.services.database.model('User');
  }
  
  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 创建的用户
   */
  async createUser(userData) {
    // 验证用户数据
    const validatedData = validateBody(userData, userSchema);
    
    // 检查用户名是否已存在
    const existingUser = await this.model.findOne({ username: validatedData.username });
    if (existingUser) {
      throw AppError.conflict('用户名已存在');
    }
    
    // 创建用户
    const user = await this.model.create(validatedData);
    
    // 记录操作日志
    await this.logAction('create_user', {
      userId: user.id,
      username: user.username
    });
    
    return user;
  }
  
  /**
   * 获取用户列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 用户列表
   */
  async getUsers(options = {}) {
    const pagination = this.getPagination(options);
    
    // 构建查询条件
    const query = {};
    if (options.role) {
      query.role = options.role;
    }
    
    // 获取总数
    const total = await this.model.countDocuments(query);
    
    // 获取数据
    const users = await this.model
      .find(query)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 });
    
    return this.createPaginationResponse(users, total, pagination);
  }
  
  /**
   * 获取用户详情
   * @param {string} username - 用户名
   * @returns {Promise<Object>} 用户详情
   */
  async getUserByUsername(username) {
    // 尝试从缓存获取
    return this.cache(`username:${username}`, async () => {
      const user = await this.model.findOne({ username });
      if (!user) {
        throw AppError.notFound('用户不存在');
      }
      return user;
    });
  }
  
  /**
   * 更新用户
   * @param {string} username - 用户名
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的用户
   */
  async updateUser(username, updateData) {
    // 验证更新数据
    const validatedData = validateBody(updateData, {
      ...userSchema,
      required: [] // 更新时所有字段都是可选的
    });
    
    // 更新用户
    const user = await this.model.findOneAndUpdate(
      { username },
      { $set: validatedData },
      { new: true }
    );
    
    if (!user) {
      throw AppError.notFound('用户不存在');
    }
    
    // 清除缓存
    await this.clearCache(`username:${username}`);
    
    // 记录操作日志
    await this.logAction('update_user', {
      userId: user.id,
      username: user.username,
      updates: validatedData
    });
    
    return user;
  }
  
  /**
   * 删除用户
   * @param {string} username - 用户名
   * @returns {Promise<Object>} 删除的用户
   */
  async deleteUser(username) {
    const user = await this.model.findOneAndDelete({ username });
    
    if (!user) {
      throw AppError.notFound('用户不存在');
    }
    
    // 清除缓存
    await this.clearCache(`username:${username}`);
    
    // 记录操作日志
    await this.logAction('delete_user', {
      userId: user.id,
      username: user.username
    });
    
    return user;
  }
  
  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object>} 登录结果
   */
  async login(username, password) {
    const user = await this.getUserByUsername(username);
    
    // 验证密码
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw AppError.unauthorized('密码错误');
    }
    
    // 生成 token
    const token = await this.app.services.auth.generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });
    
    // 记录操作日志
    await this.logAction('user_login', {
      userId: user.id,
      username: user.username
    });
    
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  }
}

module.exports = UserService; 