/**
 * 错误处理工具
 */

class AppError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      name: this.name
    };
  }

  static badRequest(message) {
    return new AppError('BAD_REQUEST', message, 400);
  }

  static unauthorized(message) {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message) {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message) {
    return new AppError('NOT_FOUND', message, 404);
  }

  static conflict(message) {
    return new AppError('CONFLICT', message, 409);
  }

  static internal(message) {
    return new AppError('INTERNAL_ERROR', message, 500);
  }

  static validation(message) {
    return new AppError('VALIDATION_ERROR', message, 400);
  }

  static authentication(message) {
    return new AppError('AUTHENTICATION_ERROR', message, 401);
  }

  static authorization(message) {
    return new AppError('AUTHORIZATION_ERROR', message, 403);
  }
}

module.exports = {
  AppError
}; 