import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure log directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
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
winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  ),
);

// Define transports
const transports = [
  // Console transport for all environments
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 10,
    tailable: true,
  }),
];

// Add specific transports for production
if (process.env.NODE_ENV === 'production') {
  // Separate file for HTTP logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      level: 'http',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true,
    })
  );
  
  // Separate file for audit logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      level: 'info',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 30,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf((info) => {
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
        })
      ),
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create stream for Morgan HTTP logger
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Audit logging helper
export const auditLog = (
  userId: number | null,
  action: string,
  resource: string,
  ip: string,
  userAgent: string,
  result: 'success' | 'failure',
  details?: any
) => {
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

// Error logging helper with context
export const logError = (error: Error, context?: any) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    context,
  });
};

// Performance logging helper
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info('Performance metric', {
    operation,
    duration,
    metadata,
  });
};

// Stream metrics logging helper
export const logStreamMetrics = (sessionId: string, metrics: any) => {
  logger.info('Stream metrics', {
    sessionId,
    metrics,
    timestamp: new Date().toISOString(),
  });
};

// Security event logging
export const logSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any
) => {
  logger.warn('Security event', {
    event,
    severity,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Database query logging for debugging
export const logDatabaseQuery = (query: string, params: any[], duration: number) => {
  if (process.env.LOG_DB_QUERIES === 'true') {
    logger.debug('Database query', {
      query,
      params,
      duration,
    });
  }
};

export default logger;