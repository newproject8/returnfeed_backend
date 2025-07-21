/**
 * ReturnFeed Backend Server - Email-Only Authentication
 * Clean implementation without username fields
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import email-based routes
import authRoutes from './routes/auth-clean';
import pdAuthRoutes from './routes/pd-auth-clean';
import streamingRoutes from './routes/streaming';
import mediaRoutes from './routes/media';
import sessionsRoutes from './routes/sessions';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: any) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://returnfeed.net',
      'http://returnfeed.net',
      'http://192.168.0.242:8092'
    ];
    
    // Allow requests with no origin (like mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
app.use('/api/auth', rateLimiter);
app.use('/api/pd-auth', rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ReturnFeed Backend (Email-Only)'
  });
});

// API Routes - Email-based authentication
app.use('/api/auth', authRoutes);
app.use('/api/pd-auth', pdAuthRoutes);

// Other API routes
app.use('/api/streaming', streamingRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/sessions', sessionsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Catch all handler
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ReturnFeed Backend (Email-Only) running on port ${PORT}`);
  console.log(`📧 Email-based authentication enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔗 API available at http://localhost:${PORT}`);
    console.log(`📝 Auth endpoints:`);
    console.log(`   - POST /api/auth/register (email, password, displayName?)`);
    console.log(`   - POST /api/auth/login (email, password)`);
    console.log(`   - GET  /api/auth/me`);
    console.log(`   - POST /api/auth/logout`);
    console.log(`📺 PD endpoints:`);
    console.log(`   - POST /api/pd-auth/register-pd`);
    console.log(`   - POST /api/pd-auth/login-pd`);
    console.log(`   - GET  /api/pd-auth/stream-info`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.listen(PORT).close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;