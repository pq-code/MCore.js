/**
 * 用户服务
 */

const { AppError } = require('../utils/errors');
const { validateBody } = require('../utils/validator');

// 模拟数据库
const users = new Map();

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

class UserService {
  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @returns {Object} 创建的用户
   */
  async createUser(userData) {
    // 验证用户数据
    const validatedData = validateBody(userData, userSchema);
    
    // 检查用户名是否已存在
    if (users.has(validatedData.username)) {
      throw AppError.conflict('用户名已存在');
    }
    
    // 创建用户
    const user = {
      id: Date.now().toString(),
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    users.set(user.username, user);
    return user;
  }
  
  /**
   * 获取用户列表
   * @param {Object} options - 查询选项
   * @returns {Array} 用户列表
   */
  async getUsers(options = {}) {
    const { page = 1, limit = 10, role } = options;
    
    let userList = Array.from(users.values());
    
    // 按角色过滤
    if (role) {
      userList = userList.filter(user => user.role === role);
    }
    
    // 分页
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      total: userList.length,
      page,
      limit,
      data: userList.slice(start, end)
    };
  }
  
  /**
   * 获取用户详情
   * @param {string} username - 用户名
   * @returns {Object} 用户详情
   */
  async getUserByUsername(username) {
    const user = users.get(username);
    if (!user) {
      throw AppError.notFound('用户不存在');
    }
    return user;
  }
  
  /**
   * 更新用户
   * @param {string} username - 用户名
   * @param {Object} updateData - 更新数据
   * @returns {Object} 更新后的用户
   */
  async updateUser(username, updateData) {
    const user = await this.getUserByUsername(username);
    
    // 验证更新数据
    const validatedData = validateBody(updateData, {
      ...userSchema,
      required: [] // 更新时所有字段都是可选的
    });
    
    // 更新用户
    const updatedUser = {
      ...user,
      ...validatedData,
      updatedAt: new Date()
    };
    
    users.set(username, updatedUser);
    return updatedUser;
  }
  
  /**
   * 删除用户
   * @param {string} username - 用户名
   */
  async deleteUser(username) {
    const user = await this.getUserByUsername(username);
    users.delete(username);
    return user;
  }
  
  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Object} 登录结果
   */
  async login(username, password) {
    const user = await this.getUserByUsername(username);
    
    if (user.password !== password) {
      throw AppError.unauthorized('密码错误');
    }
    
    // 生成 token（实际应用中应该使用 JWT）
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
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

module.exports = new UserService(); 