/**
 * XSS防护模块
 * 提供跨站脚本攻击防御功能
 * 
 * @module security/xss
 */

const logger = require('../logging').logger;

/**
 * HTML字符转义映射
 */
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '/': '&#x2F;'
};

/**
 * HTML反转义映射
 */
const HTML_UNESCAPE_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x60;': '`',
  '&#x2F;': '/'
};

/**
 * 转义HTML特殊字符
 * 
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  return str.replace(/[&<>"'`/]/g, match => HTML_ESCAPE_MAP[match]);
}

/**
 * 反转义HTML特殊字符
 * 
 * @param {string} str - 要反转义的字符串
 * @returns {string} 反转义后的字符串
 */
function unescapeHtml(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  return str.replace(/&(amp|lt|gt|quot|#x27|#x60|#x2F);/g, match => HTML_UNESCAPE_MAP[match]);
}

/**
 * 转义对象中的所有字符串属性
 * 
 * @param {Object|Array} obj - 要处理的对象或数组
 * @returns {Object|Array} 处理后的对象或数组
 */
function escapeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => escapeObject(item));
  }
  
  // 处理普通对象
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = escapeObject(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 创建过滤不安全属性的函数
 * 
 * @param {Array<string>} allowedTags - 允许的HTML标签
 * @param {Array<string>} allowedAttributes - 允许的HTML属性
 * @returns {Function} 过滤函数
 */
function createContentFilter(allowedTags = [], allowedAttributes = []) {
  // 默认允许的安全标签
  const defaultAllowedTags = [
    'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li',
    'nl', 'ol', 'p', 'pre', 'span', 'strike', 'strong', 'table',
    'tbody', 'td', 'th', 'thead', 'tr', 'ul'
  ];
  
  // 默认允许的安全属性
  const defaultAllowedAttributes = [
    'alt', 'class', 'href', 'id', 'src', 'style', 'target', 'title'
  ];
  
  // 合并默认值和自定义值
  const finalAllowedTags = new Set([...defaultAllowedTags, ...allowedTags]);
  const finalAllowedAttributes = new Set([...defaultAllowedAttributes, ...allowedAttributes]);
  
  // 创建简单的HTML解析器（注意：这只是一个非常基础的实现）
  return function filterHtml(html) {
    if (!html || typeof html !== 'string') {
      return html;
    }
    
    try {
      // 替换所有脚本标签
      let filtered = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // 替换所有事件属性（on*）
      filtered = filtered.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
      
      // 替换所有javascript:协议
      filtered = filtered.replace(/javascript\s*:/gi, 'removed:');
      
      // 替换所有data:协议（可能包含恶意内容）
      filtered = filtered.replace(/data\s*:[^;]*base64/gi, 'removed:');
      
      // 这里应该有更复杂的HTML解析和过滤逻辑
      // 注意：这只是一个非常基础的防护实现，真实环境应使用专业的HTML解析库
      
      return filtered;
    } catch (error) {
      logger.error(`HTML过滤失败: ${error.message}`, { stack: error.stack });
      return escapeHtml(html); // 出错时返回完全转义的内容
    }
  };
}

/**
 * 移除URL中的恶意部分
 * 
 * @param {string} url - 要检查的URL
 * @returns {string} 安全的URL
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '#';
  }
  
  // 移除前导空白字符
  const trimmedUrl = url.trim();
  
  // 检查是否是javascript:协议
  if (/^javascript:/i.test(trimmedUrl)) {
    return '#';
  }
  
  // 检查是否是data:协议
  if (/^data:/i.test(trimmedUrl)) {
    // 只允许安全的data:URL，如简单图片
    if (/^data:image\/(gif|png|jpeg|jpg|webp);base64,/i.test(trimmedUrl)) {
      return trimmedUrl;
    }
    return '#';
  }
  
  // 返回原始URL
  return trimmedUrl;
}

/**
 * 创建Koa中间件，用于XSS防护
 * 
 * @param {Object} options - 中间件选项
 * @param {boolean} options.setHeaders - 是否设置安全相关的HTTP头
 * @param {boolean} options.sanitizeParams - 是否净化请求参数
 * @returns {Function} Koa中间件函数
 */
function koaMiddleware(options = {}) {
  const setHeaders = options.setHeaders !== false;
  const sanitizeParams = options.sanitizeParams !== false;
  
  return async (ctx, next) => {
    // 设置安全相关的HTTP头
    if (setHeaders) {
      // 内容安全策略
      ctx.set('Content-Security-Policy', options.csp || 
        "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'");
      
      // 防止浏览器进行MIME类型嗅探
      ctx.set('X-Content-Type-Options', 'nosniff');
      
      // 启用XSS过滤器
      ctx.set('X-XSS-Protection', '1; mode=block');
      
      // 控制iframe的使用
      ctx.set('X-Frame-Options', 'SAMEORIGIN');
    }
    
    // 净化请求参数
    if (sanitizeParams) {
      if (ctx.request.body && typeof ctx.request.body === 'object') {
        ctx.request.body = escapeObject(ctx.request.body);
      }
      
      if (ctx.query && typeof ctx.query === 'object') {
        ctx.query = escapeObject(ctx.query);
      }
      
      if (ctx.params && typeof ctx.params === 'object') {
        ctx.params = escapeObject(ctx.params);
      }
    }
    
    await next();
  };
}

/**
 * 创建Express中间件，用于XSS防护
 * 
 * @param {Object} options - 中间件选项
 * @param {boolean} options.setHeaders - 是否设置安全相关的HTTP头
 * @param {boolean} options.sanitizeParams - 是否净化请求参数
 * @returns {Function} Express中间件函数
 */
function expressMiddleware(options = {}) {
  const setHeaders = options.setHeaders !== false;
  const sanitizeParams = options.sanitizeParams !== false;
  
  return (req, res, next) => {
    // 设置安全相关的HTTP头
    if (setHeaders) {
      // 内容安全策略
      res.set('Content-Security-Policy', options.csp || 
        "default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'");
      
      // 防止浏览器进行MIME类型嗅探
      res.set('X-Content-Type-Options', 'nosniff');
      
      // 启用XSS过滤器
      res.set('X-XSS-Protection', '1; mode=block');
      
      // 控制iframe的使用
      res.set('X-Frame-Options', 'SAMEORIGIN');
    }
    
    // 净化请求参数
    if (sanitizeParams) {
      if (req.body && typeof req.body === 'object') {
        req.body = escapeObject(req.body);
      }
      
      if (req.query && typeof req.query === 'object') {
        req.query = escapeObject(req.query);
      }
      
      if (req.params && typeof req.params === 'object') {
        req.params = escapeObject(req.params);
      }
    }
    
    next();
  };
}

// 导出模块
module.exports = {
  escapeHtml,
  unescapeHtml,
  escapeObject,
  createContentFilter,
  sanitizeUrl,
  middleware: {
    koa: koaMiddleware,
    express: expressMiddleware
  }
}; 