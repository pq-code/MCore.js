/**
 * 哈希模块
 * 提供安全的哈希计算功能
 * 
 * @module security/hash
 */

const crypto = require('crypto');
const logger = require('../logging').logger;

/**
 * 计算MD5哈希值（不推荐用于安全场景）
 * 
 * @param {string|Buffer} data - 要计算哈希的数据
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} MD5哈希值
 */
function md5(data, encoding = 'hex') {
  try {
    return crypto.createHash('md5').update(data).digest(encoding);
  } catch (error) {
    logger.error(`计算MD5哈希失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算MD5哈希失败: ${error.message}`);
  }
}

/**
 * 计算SHA-1哈希值（不推荐用于安全场景）
 * 
 * @param {string|Buffer} data - 要计算哈希的数据
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} SHA-1哈希值
 */
function sha1(data, encoding = 'hex') {
  try {
    return crypto.createHash('sha1').update(data).digest(encoding);
  } catch (error) {
    logger.error(`计算SHA-1哈希失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算SHA-1哈希失败: ${error.message}`);
  }
}

/**
 * 计算SHA-256哈希值
 * 
 * @param {string|Buffer} data - 要计算哈希的数据
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} SHA-256哈希值
 */
function sha256(data, encoding = 'hex') {
  try {
    return crypto.createHash('sha256').update(data).digest(encoding);
  } catch (error) {
    logger.error(`计算SHA-256哈希失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算SHA-256哈希失败: ${error.message}`);
  }
}

/**
 * 计算SHA-512哈希值
 * 
 * @param {string|Buffer} data - 要计算哈希的数据
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} SHA-512哈希值
 */
function sha512(data, encoding = 'hex') {
  try {
    return crypto.createHash('sha512').update(data).digest(encoding);
  } catch (error) {
    logger.error(`计算SHA-512哈希失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算SHA-512哈希失败: ${error.message}`);
  }
}

/**
 * 使用指定算法计算哈希值
 * 
 * @param {string} algorithm - 哈希算法，如'md5', 'sha256'等
 * @param {string|Buffer} data - 要计算哈希的数据
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} 哈希值
 */
function hash(algorithm, data, encoding = 'hex') {
  try {
    return crypto.createHash(algorithm).update(data).digest(encoding);
  } catch (error) {
    logger.error(`计算${algorithm}哈希失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算${algorithm}哈希失败: ${error.message}`);
  }
}

/**
 * 计算HMAC值
 * 
 * @param {string} algorithm - 哈希算法，如'md5', 'sha256'等
 * @param {string|Buffer} data - 要计算HMAC的数据
 * @param {string|Buffer} key - 密钥
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} HMAC值
 */
function hmac(algorithm, data, key, encoding = 'hex') {
  try {
    return crypto.createHmac(algorithm, key).update(data).digest(encoding);
  } catch (error) {
    logger.error(`计算HMAC(${algorithm})失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算HMAC(${algorithm})失败: ${error.message}`);
  }
}

/**
 * 计算HMAC-SHA256值
 * 
 * @param {string|Buffer} data - 要计算HMAC的数据
 * @param {string|Buffer} key - 密钥
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} HMAC-SHA256值
 */
function hmacSha256(data, key, encoding = 'hex') {
  return hmac('sha256', data, key, encoding);
}

/**
 * 计算SHA-3-256哈希值（更安全的哈希算法）
 * 
 * @param {string|Buffer} data - 要计算哈希的数据
 * @param {string} [encoding='hex'] - 输出编码，可选：hex, base64, binary
 * @returns {string} SHA-3-256哈希值
 */
function sha3_256(data, encoding = 'hex') {
  try {
    return crypto.createHash('sha3-256').update(data).digest(encoding);
  } catch (error) {
    // SHA-3在较旧版本的Node.js中可能不支持
    logger.error(`计算SHA-3-256哈希失败: ${error.message}`, { stack: error.stack });
    throw new Error(`计算SHA-3-256哈希失败: ${error.message}. 可能当前Node.js版本不支持SHA-3算法`);
  }
}

/**
 * 计算文件哈希
 * 
 * @param {string} filePath - 文件路径
 * @param {string} [algorithm='sha256'] - 哈希算法
 * @param {string} [encoding='hex'] - 输出编码
 * @returns {Promise<string>} 哈希值
 */
async function fileHash(filePath, algorithm = 'sha256', encoding = 'hex') {
  const fs = require('fs');
  
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest(encoding));
      });
      
      stream.on('error', error => {
        logger.error(`计算文件哈希失败: ${error.message}`, { stack: error.stack });
        reject(new Error(`计算文件哈希失败: ${error.message}`));
      });
    } catch (error) {
      logger.error(`计算文件哈希失败: ${error.message}`, { stack: error.stack });
      reject(new Error(`计算文件哈希失败: ${error.message}`));
    }
  });
}

module.exports = {
  md5,
  sha1,
  sha256,
  sha512,
  sha3_256,
  hash,
  hmac,
  hmacSha256,
  fileHash
}; 