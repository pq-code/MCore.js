/**
 * 数据清理模块
 * 提供输入数据清理功能，防止XSS和注入攻击
 * 
 * @module security/sanitizer
 */

/**
 * 清理HTML字符串，移除潜在的危险标签和属性
 * 
 * @param {string} html - 要清理的HTML字符串
 * @param {Object} options - 清理选项
 * @returns {string} 清理后的HTML字符串
 */
function sanitizeHtml(html, options = {}) {
  if (!html) return '';
  
  const defaultOptions = {
    allowedTags: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'span'],
    allowedAttributes: {
      'a': ['href', 'target', 'rel'],
      'span': ['class'],
      'p': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto']
  };
  
  const sanitizeOptions = { ...defaultOptions, ...options };
  
  try {
    const createDOMPurify = require('dompurify');
    const { JSDOM } = require('jsdom');
    const window = new JSDOM('').window;
    const DOMPurify = createDOMPurify(window);
    
    return DOMPurify.sanitize(html, sanitizeOptions);
  } catch (error) {
    // 如果DOMPurify不可用，使用简单的转义
    return escapeHtml(html);
  }
}

/**
 * 转义HTML特殊字符，防止XSS攻击
 * 
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 清理SQL查询参数，防止SQL注入
 * 
 * @param {string} sql - SQL查询字符串
 * @returns {string} 清理后的SQL字符串
 */
function sanitizeSql(sql) {
  if (!sql) return '';
  
  // 简单替换常见的SQL注入模式
  return sql
    .replace(/--/g, '')
    .replace(/;/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/g, '')
    .replace(/union\s+select/gi, '')
    .replace(/insert\s+into/gi, '')
    .replace(/drop\s+table/gi, '')
    .replace(/alter\s+table/gi, '')
    .replace(/delete\s+from/gi, '')
    .replace(/update\s+set/gi, '');
}

/**
 * 清理JavaScript代码，移除潜在的危险内容
 * 
 * @param {string} js - JavaScript代码
 * @returns {string} 清理后的JavaScript代码
 */
function sanitizeJs(js) {
  if (!js) return '';
  
  // 对于JavaScript代码，最安全的方式是不允许执行
  return escapeHtml(js);
}

/**
 * 清理对象中的所有字符串属性
 * 
 * @param {Object} obj - 要清理的对象
 * @param {function} sanitizer - 清理函数，默认为escapeHtml
 * @returns {Object} 清理后的对象
 */
function sanitizeObject(obj, sanitizer = escapeHtml) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        result[key] = sanitizer(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value, sanitizer);
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

module.exports = {
  sanitizeHtml,
  escapeHtml,
  sanitizeSql,
  sanitizeJs,
  sanitizeObject
}; 