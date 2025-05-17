/**
 * 端口工具模块
 * 提供端口占用检查和进程管理功能
 */

const { exec } = require('child_process');
const util = require('util');
const logger = require('./logger');
const execPromise = util.promisify(exec);

/**
 * 检查端口是否被占用
 * @param {number} port 要检查的端口
 * @returns {Promise<{isOccupied: boolean, pid: number|null}>} 端口占用状态和进程ID
 */
async function checkPortOccupation(port) {
  try {
    // 使用lsof命令检查端口是否被占用
    const { stdout } = await execPromise(`lsof -ti :${port}`);
    
    if (stdout.trim()) {
      const pid = parseInt(stdout.trim(), 10);
      return { isOccupied: true, pid };
    }
    
    return { isOccupied: false, pid: null };
  } catch (error) {
    // 如果lsof命令返回非零退出码，通常意味着端口未被占用
    if (error.code === 1) {
      return { isOccupied: false, pid: null };
    }
    
    logger.error('检查端口占用出错', { error: error.message, port });
    throw error;
  }
}

/**
 * 终止占用端口的进程
 * @param {number} pid 进程ID
 * @returns {Promise<boolean>} 是否成功终止
 */
async function terminateProcess(pid) {
  try {
    // 使用SIGTERM信号尝试优雅终止
    await execPromise(`kill ${pid}`);
    
    // 等待一段时间看是否成功终止
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 再次检查进程是否存在
    try {
      await execPromise(`ps -p ${pid}`);
      // 如果上面的命令没有抛出错误，表示进程仍在运行
      // 使用SIGKILL强制终止
      await execPromise(`kill -9 ${pid}`);
    } catch (e) {
      // 进程已经终止，无需操作
    }
    
    return true;
  } catch (error) {
    logger.error('终止进程失败', { error: error.message, pid });
    return false;
  }
}

/**
 * 查找可用端口
 * @param {number} startPort 起始端口
 * @param {number} endPort 结束端口
 * @returns {Promise<number|null>} 可用端口，如果没有则返回null
 */
async function findAvailablePort(startPort = 3000, endPort = 4000) {
  for (let port = startPort; port <= endPort; port++) {
    const { isOccupied } = await checkPortOccupation(port);
    if (!isOccupied) {
      return port;
    }
  }
  return null;
}

module.exports = {
  checkPortOccupation,
  terminateProcess,
  findAvailablePort
}; 