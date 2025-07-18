import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
// import morgan from 'morgan';
import pool from './db';
import passport from './config/passport';

// Import routes
import streamRoutes from './routes/stream';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import pdSoftwareRoutes from './routes/pd-software';
// import healthRoutes from './routes/health';

// Import middleware
import { 
  corsOptions, 
  securityHeaders, 
  apiLimiter, 
  authLimiter,
  sanitizeRequestBody 
} from './middleware/security';
import { 
  globalErrorHandler, 
  notFoundHandler, 
  unhandledRejectionHandler,
  uncaughtExceptionHandler 
} from './middleware/errorHandler';
import { 
  performanceMonitor, 
  requestIdMiddleware,
  gracefulShutdown,
  monitorDatabasePool,
  detectMemoryLeaks
} from './utils/monitoring';

// Import utilities
import logger, { httpLogStream } from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Apply security headers
app.use(securityHeaders);

// Apply CORS
app.use(corsOptions);

// Request ID for tracing
app.use(requestIdMiddleware);

// Performance monitoring
app.use(performanceMonitor);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize request body
app.use(sanitizeRequestBody);

// HTTP request logging
// app.use(morgan('combined', { stream: httpLogStream }));

// Passport initialization
app.use(passport.initialize());

// Health check endpoint (no rate limiting)
app.get('/api/health', async (req: Request, res: Response) => {
  const { getSystemHealth } = await import('./utils/monitoring');
  const health = await getSystemHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Apply rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// API Routes
app.use('/api/stream', streamRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/pd-software', pdSoftwareRoutes);
// app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'ReturnFeed Enterprise API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// Start server
const server = app.listen(port, () => {
  logger.info(`🚀 Enterprise API Server is running`, {
    port,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid,
  });
});

// Initialize monitoring
if (process.env.NODE_ENV === 'production') {
  monitorDatabasePool();
  detectMemoryLeaks();
}

// Handle uncaught exceptions and rejections
uncaughtExceptionHandler();
unhandledRejectionHandler();

// Graceful shutdown
gracefulShutdown(server);

export default app;