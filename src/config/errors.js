class AppError extends Error {
  constructor(message, statusCode = 500, context = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();
  }
}

class ValidationError extends AppError {
  constructor(message, context = {}) {
    super(message, 400, context);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message, context = {}) {
    super(message, 404, context);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message, context = {}) {
    super(message, 401, context);
    this.name = 'UnauthorizedError';
  }
}

class ConflictError extends AppError {
  constructor(message, context = {}) {
    super(message, 409, context);
    this.name = 'ConflictError';
  }
}

class DatabaseError extends AppError {
  constructor(message, context = {}) {
    super(message, 500, context);
    this.name = 'DatabaseError';
  }
}

export { AppError, ValidationError, NotFoundError, UnauthorizedError, ConflictError, DatabaseError };
