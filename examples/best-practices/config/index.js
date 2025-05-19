/**
 * 应用配置文件
 */

const env = process.env.NODE_ENV || 'development';

const config = {
  // 基础配置
  port: process.env.PORT || 3000,
  env,
  
  // 数据库配置
  database: {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/demo',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // 缓存配置
  cache: {
    type: 'redis',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    options: {
      ttl: 3600 // 默认缓存时间（秒）
    }
  },
  
  // 服务注册配置
  registry: {
    type: 'consul',
    host: process.env.CONSUL_HOST || 'localhost',
    port: process.env.CONSUL_PORT || 8500
  },
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  
  // 安全配置
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: '1d'
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100 // 限制每个IP 15分钟内最多100个请求
    }
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined',
    dir: 'logs'
  }
};

// 环境特定配置
const envConfig = {
  development: {
    database: {
      url: 'mongodb://localhost:27017/demo-dev'
    },
    logging: {
      level: 'debug'
    }
  },
  
  test: {
    port: 3001,
    database: {
      url: 'mongodb://localhost:27017/demo-test'
    },
    logging: {
      level: 'error'
    }
  },
  
  production: {
    database: {
      url: process.env.DATABASE_URL
    },
    cache: {
      url: process.env.REDIS_URL
    },
    logging: {
      level: 'info'
    }
  }
};

// 合并环境特定配置
module.exports = {
  ...config,
  ...envConfig[env]
}; 