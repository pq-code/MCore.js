/**
 * 加密模块
 * 提供对称和非对称加密功能
 * 
 * @module security/encryption
 */

const crypto = require('crypto');
const logger = require('../logging').logger;

/**
 * 默认加密算法
 */
const DEFAULT_ALGORITHM = 'aes-256-gcm';

/**
 * 使用AES-GCM进行加密
 * 
 * @param {string|Buffer} data - 要加密的数据
 * @param {string|Buffer} key - 密钥，必须是32字节
 * @param {string|Buffer} [iv] - 初始化向量，如果不提供则随机生成
 * @returns {Object} 包含密文、iv和authTag的对象
 */
function aesEncrypt(data, key, iv) {
  try {
    // 确保key长度为32字节
    const normalizedKey = normalizeKey(key, 32);
    
    // 如果未提供iv，随机生成一个
    const initVector = iv ? iv : crypto.randomBytes(16);
    
    // 创建加密器
    const cipher = crypto.createCipheriv(DEFAULT_ALGORITHM, normalizedKey, initVector);
    
    // 加密数据
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // 获取认证标签 (GCM模式)
    const authTag = cipher.getAuthTag().toString('base64');
    
    return {
      encrypted,
      iv: initVector.toString('base64'),
      authTag
    };
  } catch (error) {
    logger.error(`加密失败: ${error.message}`, { stack: error.stack });
    throw new Error(`加密失败: ${error.message}`);
  }
}

/**
 * 使用AES-GCM进行解密
 * 
 * @param {string} encrypted - 密文
 * @param {string|Buffer} key - 密钥，必须是32字节
 * @param {string|Buffer} iv - 初始化向量
 * @param {string|Buffer} authTag - 认证标签
 * @returns {string} 解密后的数据
 */
function aesDecrypt(encrypted, key, iv, authTag) {
  try {
    // 确保key长度为32字节
    const normalizedKey = normalizeKey(key, 32);
    
    // 确保iv和authTag是Buffer类型
    const initVector = typeof iv === 'string' ? Buffer.from(iv, 'base64') : iv;
    const tag = typeof authTag === 'string' ? Buffer.from(authTag, 'base64') : authTag;
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(DEFAULT_ALGORITHM, normalizedKey, initVector);
    
    // 设置认证标签 (GCM模式)
    decipher.setAuthTag(tag);
    
    // 解密数据
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error(`解密失败: ${error.message}`, { stack: error.stack });
    throw new Error(`解密失败: ${error.message}`);
  }
}

/**
 * 使用RSA公钥加密数据
 * 
 * @param {string|Buffer} data - 要加密的数据
 * @param {string|Buffer} publicKey - RSA公钥
 * @returns {string} Base64编码的密文
 */
function rsaEncrypt(data, publicKey) {
  try {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(data)
    );
    
    return encrypted.toString('base64');
  } catch (error) {
    logger.error(`RSA加密失败: ${error.message}`, { stack: error.stack });
    throw new Error(`RSA加密失败: ${error.message}`);
  }
}

/**
 * 使用RSA私钥解密数据
 * 
 * @param {string|Buffer} encrypted - 要解密的数据
 * @param {string|Buffer} privateKey - RSA私钥
 * @returns {string} 解密后的数据
 */
function rsaDecrypt(encrypted, privateKey) {
  try {
    const encryptedBuffer = typeof encrypted === 'string' 
      ? Buffer.from(encrypted, 'base64') 
      : encrypted;
    
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    );
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error(`RSA解密失败: ${error.message}`, { stack: error.stack });
    throw new Error(`RSA解密失败: ${error.message}`);
  }
}

/**
 * 生成RSA密钥对
 * 
 * @param {number} [keySize=2048] - 密钥大小，默认2048位
 * @returns {Object} 包含公钥和私钥的对象
 */
function generateRSAKeyPair(keySize = 2048) {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return { publicKey, privateKey };
  } catch (error) {
    logger.error(`生成RSA密钥对失败: ${error.message}`, { stack: error.stack });
    throw new Error(`生成RSA密钥对失败: ${error.message}`);
  }
}

/**
 * 生成随机加密密钥
 * 
 * @param {number} [length=32] - 密钥长度（字节）
 * @returns {Buffer} 随机密钥
 */
function generateRandomKey(length = 32) {
  return crypto.randomBytes(length);
}

/**
 * 标准化密钥长度
 * 
 * @private
 * @param {string|Buffer} key - 原始密钥
 * @param {number} length - 需要的长度（字节）
 * @returns {Buffer} 标准化后的密钥
 */
function normalizeKey(key, length) {
  let buffer;
  
  if (typeof key === 'string') {
    buffer = Buffer.from(key);
  } else if (Buffer.isBuffer(key)) {
    buffer = key;
  } else {
    throw new Error('密钥必须是字符串或Buffer');
  }
  
  // 如果密钥长度已经正确，直接返回
  if (buffer.length === length) {
    return buffer;
  }
  
  // 如果密钥太短，使用PBKDF2派生一个合适长度的密钥
  if (buffer.length < length) {
    return crypto.pbkdf2Sync(buffer, 'salt', 10000, length, 'sha512');
  }
  
  // 如果密钥太长，截断
  return buffer.slice(0, length);
}

module.exports = {
  aesEncrypt,
  aesDecrypt,
  rsaEncrypt,
  rsaDecrypt,
  generateRSAKeyPair,
  generateRandomKey
}; 