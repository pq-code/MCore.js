/**
 * 密码处理模块
 * 提供安全的密码哈希和验证功能
 * 
 * @module security/password
 */

const crypto = require('crypto');
const logger = require('../logging').logger;

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  // 默认使用PBKDF2算法
  algorithm: 'pbkdf2',
  // 默认算法选项
  iterations: 10000,
  keylen: 64,
  digest: 'sha512',
  saltSize: 32
};

/**
 * 生成密码哈希
 * 
 * @param {string} password - 明文密码
 * @param {Object} [options] - 哈希选项
 * @param {string} [options.algorithm='pbkdf2'] - 哈希算法
 * @param {number} [options.iterations=10000] - 迭代次数
 * @param {number} [options.keylen=64] - 密钥长度
 * @param {string} [options.digest='sha512'] - 摘要算法
 * @param {Buffer|string} [options.salt] - 指定盐值，未指定时随机生成
 * @param {number} [options.saltSize=32] - 盐值大小（字节）
 * @returns {string} 密码哈希（格式: 算法:参数:salt:hash）
 */
function hashPassword(password, options = {}) {
  try {
    // 合并选项
    const config = { ...DEFAULT_CONFIG, ...options };
    
    // 生成或使用提供的盐值
    const salt = config.salt || crypto.randomBytes(config.saltSize);
    const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'base64');
    
    let hash;
    let params;
    
    // 根据算法生成哈希
    switch (config.algorithm.toLowerCase()) {
      case 'pbkdf2':
        hash = crypto.pbkdf2Sync(
          password,
          saltBuffer,
          config.iterations,
          config.keylen,
          config.digest
        );
        params = `${config.iterations}:${config.keylen}:${config.digest}`;
        break;
        
      case 'scrypt':
        // scrypt更安全但更消耗资源
        const N = config.N || 16384; // CPU/内存开销
        const r = config.r || 8;     // 块大小
        const p = config.p || 1;     // 并行化因子
        
        hash = crypto.scryptSync(
          password,
          saltBuffer,
          config.keylen,
          { N, r, p }
        );
        params = `${N}:${r}:${p}:${config.keylen}`;
        break;
        
      case 'argon2':
        // 注意: Node.js核心不支持argon2，这里需要使用第三方库
        logger.warn('Node.js核心不支持argon2算法，请使用第三方库如argon2');
        throw new Error('不支持的算法：argon2，请使用pbkdf2或scrypt');
        
      default:
        throw new Error(`不支持的算法: ${config.algorithm}`);
    }
    
    // 格式: 算法:参数:salt:hash
    return `${config.algorithm}:${params}:${saltBuffer.toString('base64')}:${hash.toString('base64')}`;
  } catch (error) {
    logger.error(`密码哈希生成失败: ${error.message}`, { stack: error.stack });
    throw new Error(`密码哈希生成失败: ${error.message}`);
  }
}

/**
 * 验证密码
 * 
 * @param {string} password - 明文密码
 * @param {string} hashedPassword - 哈希密码（格式: 算法:参数:salt:hash）
 * @returns {boolean} 验证结果
 */
function verifyPassword(password, hashedPassword) {
  try {
    // 解析哈希字符串
    const parts = hashedPassword.split(':');
    if (parts.length < 4) {
      throw new Error('无效的密码哈希格式');
    }
    
    const algorithm = parts[0].toLowerCase();
    const salt = Buffer.from(parts[parts.length - 2], 'base64');
    const hash = Buffer.from(parts[parts.length - 1], 'base64');
    
    let params;
    let calculatedHash;
    
    // 根据算法验证
    switch (algorithm) {
      case 'pbkdf2':
        params = parts[1].split(':');
        if (params.length !== 3) {
          throw new Error('无效的PBKDF2参数');
        }
        
        const iterations = parseInt(params[0], 10);
        const keylen = parseInt(params[1], 10);
        const digest = params[2];
        
        calculatedHash = crypto.pbkdf2Sync(
          password,
          salt,
          iterations,
          keylen,
          digest
        );
        break;
        
      case 'scrypt':
        params = parts[1].split(':');
        if (params.length !== 4) {
          throw new Error('无效的scrypt参数');
        }
        
        const N = parseInt(params[0], 10);
        const r = parseInt(params[1], 10);
        const p = parseInt(params[2], 10);
        const scryptKeylen = parseInt(params[3], 10);
        
        calculatedHash = crypto.scryptSync(
          password,
          salt,
          scryptKeylen,
          { N, r, p }
        );
        break;
        
      default:
        throw new Error(`不支持的算法: ${algorithm}`);
    }
    
    // 比较哈希值
    return crypto.timingSafeEqual(calculatedHash, hash);
  } catch (error) {
    logger.error(`密码验证失败: ${error.message}`, { stack: error.stack });
    return false;
  }
}

/**
 * 生成安全随机密码
 * 
 * @param {Object} [options] - 密码生成选项
 * @param {number} [options.length=16] - 密码长度
 * @param {boolean} [options.uppercase=true] - 是否包含大写字母
 * @param {boolean} [options.lowercase=true] - 是否包含小写字母
 * @param {boolean} [options.numbers=true] - 是否包含数字
 * @param {boolean} [options.symbols=true] - 是否包含特殊符号
 * @param {string} [options.exclude=''] - 排除的字符
 * @returns {string} 随机密码
 */
function generatePassword(options = {}) {
  const config = {
    length: options.length || 16,
    uppercase: options.uppercase !== false,
    lowercase: options.lowercase !== false,
    numbers: options.numbers !== false,
    symbols: options.symbols !== false,
    exclude: options.exclude || ''
  };
  
  // 构建字符集
  let charset = '';
  
  if (config.uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (config.lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (config.numbers) charset += '0123456789';
  if (config.symbols) charset += '!@#$%^&*()_+~`|}{[]:;?><,./-=';
  
  // 排除指定字符
  if (config.exclude) {
    for (let i = 0; i < config.exclude.length; i++) {
      charset = charset.replace(config.exclude[i], '');
    }
  }
  
  if (charset.length === 0) {
    throw new Error('生成密码的字符集为空');
  }
  
  // 生成随机密码
  let password = '';
  const randBytes = crypto.randomBytes(config.length * 2);
  
  for (let i = 0; i < config.length; i++) {
    const randIndex = randBytes[i] % charset.length;
    password += charset.charAt(randIndex);
  }
  
  return password;
}

/**
 * 检查密码强度
 * 
 * @param {string} password - 要检查的密码
 * @returns {Object} 密码强度信息
 */
function checkPasswordStrength(password) {
  if (!password) {
    return {
      score: 0,
      strength: 'none',
      feedback: '密码为空'
    };
  }
  
  let score = 0;
  const feedback = [];
  
  // 长度得分 (最多5分)
  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 14) score += 1;
  if (password.length >= 16) score += 1;
  
  // 字符多样性得分 (最多4分)
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // 生成反馈
  if (password.length < 8) {
    feedback.push('密码太短');
  }
  
  if (!/[a-z]/.test(password)) {
    feedback.push('应包含小写字母');
  }
  
  if (!/[A-Z]/.test(password)) {
    feedback.push('应包含大写字母');
  }
  
  if (!/[0-9]/.test(password)) {
    feedback.push('应包含数字');
  }
  
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('应包含特殊字符');
  }
  
  // 定义强度级别
  let strength;
  if (score <= 3) {
    strength = 'weak';
  } else if (score <= 6) {
    strength = 'medium';
  } else if (score <= 8) {
    strength = 'strong';
  } else {
    strength = 'very_strong';
  }
  
  return {
    score,
    strength,
    feedback: feedback.length > 0 ? feedback : ['密码强度良好']
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generatePassword,
  checkPasswordStrength
}; 