"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDatabaseQuery = exports.logSecurityEvent = exports.logStreamMetrics = exports.logPerformance = exports.logError = exports.auditLog = exports.httpLogStream = void 0;
const winston_1 = require("winston");
const path_1 = require("path");
const fs_1 = require("fs");
// Ensure log directory exists
const logDir = path_1.default.join(__dirname, '../../logs');
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
// Tell winston about the colors
winston_1.default.addColors(colors);
// Define format
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
// Define console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`));
// Define transports
const transports = [
    // Console transport for all environments
    new winston_1.default.transports.Console({
        format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
    }),
    // File transport for errors
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true,
    }),
    // File transport for all logs
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'combined.log'),
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 10,
        tailable: true,
    }),
];
// Add specific transports for production
if (process.env.NODE_ENV === 'production') {
    // Separate file for HTTP logs
    transports.push(new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'http.log'),
        level: 'http',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        tailable: true,
    }));
    // Separate file for audit logs
    transports.push(new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'audit.log'),
        level: 'info',
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 30,
        tailable: true,
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
            if (info.audit) {
                return JSON.stringify({
                    timestamp: info.timestamp,
                    level: info.level,
                    userId: info.userId,
                    action: info.action,
                    resource: info.resource,
                    ip: info.ip,
                    userAgent: info.userAgent,
                    result: info.result,
                    details: info.details,
                });
            }
            return '';
        })),
    }));
}
// Create logger instance
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    levels,
    format,
    transports,
    exitOnError: false,
});
// Create stream for Morgan HTTP logger
exports.httpLogStream = {
    write: (message) => {
        logger.http(message.trim());
    },
};
// Audit logging helper
const auditLog = (userId, action, resource, ip, userAgent, result, details) => {
    logger.info('Audit log', {
        audit: true,
        userId,
        action,
        resource,
        ip,
        userAgent,
        result,
        details,
    });
};
exports.auditLog = auditLog;
// Error logging helper with context
const logError = (error, context) => {
    logger.error({
        message: error.message,
        stack: error.stack,
        context,
    });
};
exports.logError = logError;
// Performance logging helper
const logPerformance = (operation, duration, metadata) => {
    logger.info('Performance metric', {
        operation,
        duration,
        metadata,
    });
};
exports.logPerformance = logPerformance;
// Stream metrics logging helper
const logStreamMetrics = (sessionId, metrics) => {
    logger.info('Stream metrics', {
        sessionId,
        metrics,
        timestamp: new Date().toISOString(),
    });
};
exports.logStreamMetrics = logStreamMetrics;
// Security event logging
const logSecurityEvent = (event, severity, details) => {
    logger.warn('Security event', {
        event,
        severity,
        details,
        timestamp: new Date().toISOString(),
    });
};
exports.logSecurityEvent = logSecurityEvent;
// Database query logging for debugging
const logDatabaseQuery = (query, params, duration) => {
    if (process.env.LOG_DB_QUERIES === 'true') {
        logger.debug('Database query', {
            query,
            params,
            duration,
        });
    }
};
exports.logDatabaseQuery = logDatabaseQuery;
exports.default = logger;
