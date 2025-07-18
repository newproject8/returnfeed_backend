"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uncaughtExceptionHandler = exports.unhandledRejectionHandler = exports.notFoundHandler = exports.globalErrorHandler = exports.catchAsync = exports.DatabaseError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = __importStar(require("../utils/logger"));
const db_1 = __importDefault(require("../db"));
// Custom error classes
class AppError extends Error {
    constructor(message, statusCode, isOperational = true, code) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, true, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, true, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, true, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, true, 'CONFLICT');
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
    }
}
exports.RateLimitError = RateLimitError;
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, false, 'DATABASE_ERROR');
    }
}
exports.DatabaseError = DatabaseError;
// Async error catcher
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.catchAsync = catchAsync;
// Global error handler
const globalErrorHandler = async (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    // Log the error
    (0, logger_1.logError)(err, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
    });
    // Database errors
    if (err.code === '23505') {
        error = new ConflictError('Duplicate value');
    }
    else if (err.code === '23503') {
        error = new ValidationError('Invalid reference');
    }
    else if (err.code === '23502') {
        error = new ValidationError('Required field missing');
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AuthenticationError('Invalid token');
    }
    else if (err.name === 'TokenExpiredError') {
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
            await db_1.default.query(`INSERT INTO audit_logs (user_id, action, resource_type, status, error_message, ip_address, user_agent, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                req.user?.id || null,
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
            ]);
        }
        catch (dbError) {
            logger_1.default.error('Failed to log error to audit table', dbError);
        }
    }
    // Log security events
    if (statusCode === 401 || statusCode === 403) {
        (0, logger_1.logSecurityEvent)('unauthorized_access_attempt', 'medium', {
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            error: message,
        });
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
exports.globalErrorHandler = globalErrorHandler;
// 404 handler
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
};
exports.notFoundHandler = notFoundHandler;
// Unhandled rejection handler
const unhandledRejectionHandler = () => {
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.default.error('Unhandled Rejection at:', { promise, reason });
        // Don't exit in development
        if (process.env.NODE_ENV === 'production') {
            // Close server & exit process
            process.exit(1);
        }
    });
};
exports.unhandledRejectionHandler = unhandledRejectionHandler;
// Uncaught exception handler
const uncaughtExceptionHandler = () => {
    process.on('uncaughtException', (error) => {
        logger_1.default.error('Uncaught Exception:', error);
        // Exit process
        process.exit(1);
    });
};
exports.uncaughtExceptionHandler = uncaughtExceptionHandler;
