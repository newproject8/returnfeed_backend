import { Request, Response, NextFunction } from 'express';
import os from 'os';
import pool from '../db';
import logger from './logger';

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Capture the original end function
  const originalEnd = res.end;
  
  // Override the end function
  (res.end as any) = function(...args: any[]) {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 1000) { // More than 1 second
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
      });
    }
    
    // Add response time header
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Call the original end function
    (originalEnd as any).apply(res, args);
  };
  
  next();
};

// System health check
export const getSystemHealth = async () => {
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
    system: {},
  };

  // Check database connection
  try {
    const result = await pool.query('SELECT 1');
    health.services.database = {
      status: 'connected',
      responseTime: result.rows ? 'fast' : 'slow',
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.services.database = {
      status: 'disconnected',
      error: (error as Error).message,
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
    platform: os.platform(),
    architecture: os.arch(),
    nodeVersion: process.version,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      percentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%',
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model,
      load: os.loadavg(),
    },
    process: {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    },
  };

  return health;
};

// Stream metrics collector
export const collectStreamMetrics = async (sessionId: string) => {
  try {
    // Get current viewer count (would be implemented with WebSocket connections)
    const viewerCount = 0; // TODO: Implement actual viewer counting
    
    // Get system resources
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    // Calculate CPU percentage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / os.cpus().length;
    
    // Calculate memory percentage
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // Insert metrics into database
    await pool.query(
      `INSERT INTO stream_metrics 
       (session_id, viewer_count, cpu_usage, memory_usage)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, viewerCount, cpuPercent.toFixed(2), memoryPercent.toFixed(2)]
    );
    
    return {
      viewerCount,
      cpuUsage: cpuPercent.toFixed(2) + '%',
      memoryUsage: memoryPercent.toFixed(2) + '%',
    };
  } catch (error) {
    logger.error('Failed to collect stream metrics', error);
    return null;
  }
};

// Database connection pool monitoring
export const monitorDatabasePool = () => {
  setInterval(() => {
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
    
    if (poolStats.waiting > 5) {
      logger.warn('High database connection pool usage', poolStats);
    }
    
    logger.debug('Database pool stats', poolStats);
  }, 60000); // Every minute
};

// Memory leak detection
export const detectMemoryLeaks = () => {
  let lastHeapUsed = 0;
  let increasingCount = 0;
  
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    
    if (heapUsed > lastHeapUsed) {
      increasingCount++;
    } else {
      increasingCount = 0;
    }
    
    // If memory has been increasing for 10 consecutive checks
    if (increasingCount > 10) {
      logger.warn('Potential memory leak detected', {
        heapUsed: (heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
        external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB',
      });
    }
    
    lastHeapUsed = heapUsed;
  }, 300000); // Every 5 minutes
};

// Graceful shutdown handler
export const gracefulShutdown = (server: any) => {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown`);
    
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database connections
    try {
      await pool.end();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', error);
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

// Request ID middleware for tracing
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId as string;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};