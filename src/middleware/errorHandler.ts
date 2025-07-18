import { Request, Response, NextFunction } from 'express';
import logger, { logError, logSecurityEvent } from '../utils/logger';
import pool from '../db';

// Custom error classes
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, isOperational = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, false, 'DATABASE_ERROR');
  }
}

// Async error catcher
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler
export const globalErrorHandler = async (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let error = { ...err };
  error.message = err.message;

  // Log the error
  logError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Database errors
  if (err.code === '23505') {
    error = new ConflictError('Duplicate value');
  } else if (err.code === '23503') {
    error = new ValidationError('Invalid reference');
  } else if (err.code === '23502') {
    error = new ValidationError('Required field missing');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  } else if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  // Mongoose/Database connection errors
  if (err.name === 'MongoError' || err.name === 'DatabaseError') {
    error = new DatabaseError();
  }

  // Default to 500 server error
  if (!error.statusCode) {
    error.statusCode = 500;
  }

  // Send error response
  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  // Log to audit table for critical errors
  if (statusCode >= 500 || (statusCode === 403 && error.code === 'AUTHORIZATION_ERROR')) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, status, error_message, ip_address, user_agent, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          (req as any).user?.id || null,
          req.method + ' ' + req.path,
          'api_error',
          'error',
          message,
          req.ip,
          req.get('user-agent'),
          JSON.stringify({
            statusCode,
            errorCode: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          }),
        ]
      );
    } catch (dbError) {
      logger.error('Failed to log error to audit table', dbError);
    }
  }

  // Log security events
  if (statusCode === 401 || statusCode === 403) {
    logSecurityEvent(
      'unauthorized_access_attempt',
      'medium',
      {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        error: message,
      }
    );
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error,
      }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.headers['x-request-id'] || 'N/A',
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Unhandled rejection handler
export const unhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    // Don't exit in development
    if (process.env.NODE_ENV === 'production') {
      // Close server & exit process
      process.exit(1);
    }
  });
};

// Uncaught exception handler
export const uncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    // Exit process
    process.exit(1);
  });
};