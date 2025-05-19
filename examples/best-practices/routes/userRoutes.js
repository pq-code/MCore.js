/**
 * 用户路由
 */

const userService = require('../services/userService');
const { validateQuery, validateBody, validateParams } = require('../utils/validator');

// 查询参数验证 schema
const querySchema = {
  type: 'object',
  properties: {
    page: { type: 'number', minimum: 1 },
    limit: { type: 'number', minimum: 1, maximum: 100 },
    role: { type: 'string', enum: ['user', 'admin'] }
  }
};

// 路径参数验证 schema
const paramsSchema = {
  type: 'object',
  required: ['username'],
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 20 }
  }
};

// 登录请求验证 schema
const loginSchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 20 },
    password: { type: 'string', minLength: 8 }
  }
};

// 用户控制器
const userController = {
  // 获取用户列表
  async getUsers(req, res) {
    const options = validateQuery(req.query, querySchema);
    const result = await userService.getUsers(options);
    res.json(result);
  },
  
  // 创建用户
  async createUser(req, res) {
    const userData = validateBody(req.body, userService.userSchema);
    const user = await userService.createUser(userData);
    res.status(201).json(user);
  },
  
  // 获取用户详情
  async getUser(req, res) {
    const { username } = validateParams(req.params, paramsSchema);
    const user = await userService.getUserByUsername(username);
    res.json(user);
  },
  
  // 更新用户
  async updateUser(req, res) {
    const { username } = validateParams(req.params, paramsSchema);
    const updateData = validateBody(req.body, userService.userSchema);
    const user = await userService.updateUser(username, updateData);
    res.json(user);
  },
  
  // 删除用户
  async deleteUser(req, res) {
    const { username } = validateParams(req.params, paramsSchema);
    await userService.deleteUser(username);
    res.status(204).send();
  },
  
  // 用户登录
  async login(req, res) {
    const { username, password } = validateBody(req.body, loginSchema);
    const result = await userService.login(username, password);
    res.json(result);
  }
};

// 路由中间件
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  
  try {
    req.user = await userService.verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 路由定义
module.exports = (router) => {
  // 公开路由
  router.post('/login', userController.login);
  
  // 需要认证的路由
  router.use(authMiddleware);
  router.get('/', userController.getUsers);
  router.post('/', userController.createUser);
  router.get('/:username', userController.getUser);
  router.put('/:username', userController.updateUser);
  router.delete('/:username', userController.deleteUser);
  
  return router;
}; 