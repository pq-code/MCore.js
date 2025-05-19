/**
 * 用户路由
 */

const userService = require('../services/userService');
const { auth, role, validate } = require('../middlewares');

// 验证 schema
const schemas = {
  query: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100 },
      role: { type: 'string', enum: ['user', 'admin'] }
    }
  },
  
  params: {
    type: 'object',
    required: ['username'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 20 }
    }
  },
  
  login: {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 20 },
        password: { type: 'string', minLength: 8 }
      }
    }
  },
  
  create: {
    body: userService.userSchema
  },
  
  update: {
    body: {
      ...userService.userSchema,
      required: [] // 更新时所有字段都是可选的
    }
  }
};

// 用户控制器
const userController = {
  // 获取用户列表
  async getUsers(ctx) {
    const result = await userService.getUsers(ctx.query);
    ctx.body = result;
  },
  
  // 创建用户
  async createUser(ctx) {
    const user = await userService.createUser(ctx.request.body);
    ctx.status = 201;
    ctx.body = user;
  },
  
  // 获取用户详情
  async getUser(ctx) {
    const user = await userService.getUserByUsername(ctx.params.username);
    ctx.body = user;
  },
  
  // 更新用户
  async updateUser(ctx) {
    const user = await userService.updateUser(ctx.params.username, ctx.request.body);
    ctx.body = user;
  },
  
  // 删除用户
  async deleteUser(ctx) {
    await userService.deleteUser(ctx.params.username);
    ctx.status = 204;
  },
  
  // 用户登录
  async login(ctx) {
    const { username, password } = ctx.request.body;
    const result = await userService.login(username, password);
    ctx.body = result;
  }
};

// 路由定义
module.exports = (router) => {
  // 公开路由
  router.post('/login', 
    validate(schemas.login),
    userController.login
  );
  
  // 需要认证的路由
  router.use(auth());
  
  router.get('/',
    validate({ query: schemas.query }),
    userController.getUsers
  );
  
  router.post('/',
    validate(schemas.create),
    role(['admin']), // 只有管理员可以创建用户
    userController.createUser
  );
  
  router.get('/:username',
    validate({ params: schemas.params }),
    userController.getUser
  );
  
  router.put('/:username',
    validate({
      params: schemas.params,
      body: schemas.update
    }),
    userController.updateUser
  );
  
  router.delete('/:username',
    validate({ params: schemas.params }),
    role(['admin']), // 只有管理员可以删除用户
    userController.deleteUser
  );
  
  return router;
}; 