/**
 * 分页器类
 * 处理列表数据分页
 * 
 * @class Paginator
 */

class Paginator {
  /**
   * 创建分页器实例
   * 
   * @param {Object} options - 分页选项
   * @param {number} options.page - 当前页码
   * @param {number} options.pageSize - 每页大小
   * @param {number} options.total - 总记录数
   * @param {Array} options.data - 分页数据
   * @param {Object} options.links - 页面链接
   */
  constructor(options = {}) {
    this.page = options.page && options.page > 0 ? parseInt(options.page, 10) : 1;
    this.pageSize = options.pageSize && options.pageSize > 0 ? parseInt(options.pageSize, 10) : 20;
    this.total = options.total !== undefined ? parseInt(options.total, 10) : 0;
    this.data = options.data || [];
    this.links = options.links || {};
    
    // 计算总页数
    this.totalPages = this.total > 0 ? Math.ceil(this.total / this.pageSize) : 0;
    
    // 计算是否有前一页和后一页
    this.hasPrevPage = this.page > 1;
    this.hasNextPage = this.page < this.totalPages;
    
    // 计算前一页和后一页页码
    this.prevPage = this.hasPrevPage ? this.page - 1 : null;
    this.nextPage = this.hasNextPage ? this.page + 1 : null;
  }
  
  /**
   * 从数据库查询结果创建分页器
   * 
   * @static
   * @param {Object} result - 数据库查询结果（例如Sequelize分页结果）
   * @param {Object} options - 分页选项
   * @returns {Paginator} 分页器实例
   */
  static fromDbResult(result, options = {}) {
    // 处理Sequelize的findAndCountAll结果
    if (result && typeof result === 'object' && result.rows && result.count !== undefined) {
      return new Paginator({
        page: options.page,
        pageSize: options.pageSize,
        total: result.count,
        data: result.rows,
        links: options.links
      });
    }
    
    // 处理自定义分页结果
    if (result && typeof result === 'object' && result.data && result.total !== undefined) {
      return new Paginator({
        page: options.page,
        pageSize: options.pageSize,
        total: result.total,
        data: result.data,
        links: options.links
      });
    }
    
    // 处理普通数组
    if (Array.isArray(result)) {
      return new Paginator({
        page: options.page,
        pageSize: options.pageSize,
        total: result.length,
        data: result.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
        links: options.links
      });
    }
    
    return new Paginator(options);
  }
  
  /**
   * 创建请求查询的分页参数
   * 
   * @static
   * @param {Object} query - HTTP请求查询参数
   * @returns {Object} 分页参数
   */
  static createPaginationParams(query = {}) {
    const page = query.page && query.page > 0 ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? parseInt(query.pageSize, 10) : 20;
    
    // 计算偏移量
    const offset = (page - 1) * pageSize;
    
    return {
      page,
      pageSize,
      offset,
      limit: pageSize
    };
  }
  
  /**
   * 为分页结果生成Links
   * 
   * @static
   * @param {Object} params - 参数
   * @param {number} params.page - 当前页码
   * @param {number} params.pageSize - 每页大小
   * @param {number} params.total - 总记录数
   * @param {string} params.baseUrl - 基础URL
   * @returns {Object} 链接对象
   */
  static generateLinks({ page, pageSize, total, baseUrl }) {
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const links = {};
    
    // 确保baseUrl以'?'结尾，用于添加查询参数
    const url = baseUrl.includes('?') ? 
      (baseUrl.endsWith('&') ? baseUrl : baseUrl + '&') : 
      baseUrl + '?';
    
    // 首页链接
    links.first = `${url}page=1&pageSize=${pageSize}`;
    
    // 末页链接
    if (totalPages > 0) {
      links.last = `${url}page=${totalPages}&pageSize=${pageSize}`;
    }
    
    // 上一页链接
    if (page > 1) {
      links.prev = `${url}page=${page - 1}&pageSize=${pageSize}`;
    }
    
    // 下一页链接
    if (page < totalPages) {
      links.next = `${url}page=${page + 1}&pageSize=${pageSize}`;
    }
    
    return links;
  }
  
  /**
   * 转换为请求响应对象
   * 
   * @returns {Object} 分页响应对象
   */
  toResponse() {
    return {
      data: this.data,
      pagination: {
        total: this.total,
        page: this.page,
        pageSize: this.pageSize,
        totalPages: this.totalPages,
        hasPrevPage: this.hasPrevPage,
        hasNextPage: this.hasNextPage,
        prevPage: this.prevPage,
        nextPage: this.nextPage
      },
      links: this.links
    };
  }
}

module.exports = Paginator; 