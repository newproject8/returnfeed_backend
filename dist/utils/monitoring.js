"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = exports.gracefulShutdown = exports.detectMemoryLeaks = exports.monitorDatabasePool = exports.collectStreamMetrics = exports.getSystemHealth = exports.performanceMonitor = void 0;
const os_1 = __importDefault(require("os"));
const db_1 = __importDefault(require("../db"));
const logger_1 = __importDefault(require("./logger"));
// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
    const start = Date.now();
    // Capture the original end function
    const originalEnd = res.end;
    // Override the end function
    res.end = function (...args) {
        const duration = Date.now() - start;
        // Log slow requests
        if (duration > 1000) { // More than 1 second
            logger_1.default.warn('Slow request detected', {
                method: req.method,
                url: req.url,
                duration,
                statusCode: res.statusCode,
            });
        }
        // Add response time header
        res.setHeader('X-Response-Time', `${duration}ms`);
        // Call the original end function
        originalEnd.apply(res, args);
    };
    next();
};
exports.performanceMonitor = performanceMonitor;
// System health check
const getSystemHealth = async () => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {},
        system: {},
    };
    // Check database connection
    try {
        const result = await db_1.default.query('SELECT 1');
        health.services.database = {
            status: 'connected',
            responseTime: result.rows ? 'fast' : 'slow',
        };
    }
    catch (error) {
        health.status = 'unhealthy';
        health.services.database = {
            status: 'disconnected',
            error: error.message,
        };
    }
    // Check Redis connection (if configured)
    if (process.env.REDIS_URL) {
        // TODO: Implement Redis health check
        health.services.redis = {
            status: 'not_implemented',
        };
    }
    // System metrics
    health.system = {
        platform: os_1.default.platform(),
        architecture: os_1.default.arch(),
        nodeVersion: process.version,
        memory: {
            total: os_1.default.totalmem(),
            free: os_1.default.freemem(),
            used: os_1.default.totalmem() - os_1.default.freemem(),
            percentage: ((os_1.default.totalmem() - os_1.default.freemem()) / os_1.default.totalmem() * 100).toFixed(2) + '%',
        },
        cpu: {
            cores: os_1.default.cpus().length,
            model: os_1.default.cpus()[0]?.model,
            load: os_1.default.loadavg(),
        },
        process: {
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
        },
    };
    return health;
};
exports.getSystemHealth = getSystemHealth;
// Stream metrics collector
const collectStreamMetrics = async (sessionId) => {
    try {
        // Get current viewer count (would be implemented with WebSocket connections)
        const viewerCount = 0; // TODO: Implement actual viewer counting
        // Get system resources
        const cpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        // Calculate CPU percentage (simplified)
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / os_1.default.cpus().length;
        // Calculate memory percentage
        const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        // Insert metrics into database
        await db_1.default.query(`INSERT INTO stream_metrics 
       (session_id, viewer_count, cpu_usage, memory_usage)
       VALUES ($1, $2, $3, $4)`, [sessionId, viewerCount, cpuPercent.toFixed(2), memoryPercent.toFixed(2)]);
        return {
            viewerCount,
            cpuUsage: cpuPercent.toFixed(2) + '%',
            memoryUsage: memoryPercent.toFixed(2) + '%',
        };
    }
    catch (error) {
        logger_1.default.error('Failed to collect stream metrics', error);
        return null;
    }
};
exports.collectStreamMetrics = collectStreamMetrics;
// Database connection pool monitoring
const monitorDatabasePool = () => {
    setInterval(() => {
        const poolStats = {
            total: db_1.default.totalCount,
            idle: db_1.default.idleCount,
            waiting: db_1.default.waitingCount,
        };
        if (poolStats.waiting > 5) {
            logger_1.default.warn('High database connection pool usage', poolStats);
        }
        logger_1.default.debug('Database pool stats', poolStats);
    }, 60000); // Every minute
};
exports.monitorDatabasePool = monitorDatabasePool;
// Memory leak detection
const detectMemoryLeaks = () => {
    let lastHeapUsed = 0;
    let increasingCount = 0;
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsed = memUsage.heapUsed;
        if (heapUsed > lastHeapUsed) {
            increasingCount++;
        }
        else {
            increasingCount = 0;
        }
        // If memory has been increasing for 10 consecutive checks
        if (increasingCount > 10) {
            logger_1.default.warn('Potential memory leak detected', {
                heapUsed: (heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
                rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
                external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB',
            });
        }
        lastHeapUsed = heapUsed;
    }, 300000); // Every 5 minutes
};
exports.detectMemoryLeaks = detectMemoryLeaks;
// Graceful shutdown handler
const gracefulShutdown = (server) => {
    const shutdown = async (signal) => {
        logger_1.default.info(`${signal} received, starting graceful shutdown`);
        // Stop accepting new connections
        server.close(() => {
            logger_1.default.info('HTTP server closed');
        });
        // Close database connections
        try {
            await db_1.default.end();
            logger_1.default.info('Database connections closed');
        }
        catch (error) {
            logger_1.default.error('Error closing database connections', error);
        }
        // Close other resources (Redis, etc.)
        // TODO: Implement cleanup for other resources
        // Exit process
        process.exit(0);
    };
    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};
exports.gracefulShutdown = gracefulShutdown;
// Request ID middleware for tracing
const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
