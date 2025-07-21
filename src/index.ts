import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import pool from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import streamRoutes from './routes/stream';
import passport from './config/passport';
import authRoutes from './routes/auth-clean';
import sessionRoutes from './routes/sessions';
import pdSoftwareRoutes from './routes/pd-software';
import pdAuthRoutes from './routes/pd-auth-clean';
import browserLaunchRoutes from './routes/browser-launch';
import mediamtxAuthRoutes from './routes/mediamtx-auth';
// import mediamtxRoutes from './routes/mediamtx';
// import bitrateRoutes, { initializeBitrateManager } from './routes/bitrate';
// import { BitrateManager } from './services/bitrateManager';
// import { BitrateWebSocketHandler } from './websocket/bitrateHandler';
import { ReturnFeedWebSocketServer } from './websocket/server';
import { LatencyMonitor } from './services/latencyMonitor';

dotenv.config();
 
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(passport.initialize());

// Initialize bitrate manager
// const bitrateManager = new BitrateManager();
// initializeBitrateManager(bitrateManager);

// Initialize latency monitor (v4.0)
const latencyMonitor = new LatencyMonitor(process.env.MEDIAMTX_API_URL || 'http://localhost:9997');

// Async Error Handling Wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// 서버 상태 확인을 위한 기본 라우트
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'API server is running' });
});

// 데이터베이스 연결 테스트를 위한 라우트
app.get('/api/db-test', asyncHandler(async (req: Request, res: Response) => {
  const client = await pool.connect();
  const result = await client.query('SELECT NOW()');
  res.status(200).json({
    status: 'ok',
    message: 'Database connection successful!',
    db_time: result.rows[0].now,
  });
  client.release();
}));

// Email-based authentication routes are now handled in auth-clean.ts

// Root route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Welcome to ReturnFeed API' });
});

// MediaMTX auth routes (no JWT required)
app.use('/api', mediamtxAuthRoutes);

// MediaMTX event routes (no JWT required)
// app.use('/api/mediamtx', mediamtxRoutes);

// Protected routes
app.use('/api/stream', streamRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/pd-software', pdSoftwareRoutes);
app.use('/api/pd-auth', pdAuthRoutes);
app.use('/api/browser', browserLaunchRoutes);
// app.use('/api/bitrate', bitrateRoutes);
 
// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error(err);

  // Unique constraint violation (duplicate username/email)
  if (err && err.code === '23505') {
    res.status(409).json({ message: 'Username or email already exists.' });
    return;
  }

  // Generic server error
  res.status(500).json({ message: 'Internal Server Error' });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wsServer = new ReturnFeedWebSocketServer(server);

// Initialize bitrate WebSocket handler
// const bitrateWsHandler = new BitrateWebSocketHandler(bitrateManager);

// Add WebSocket server to global scope for API access
declare global {
  var wsServer: ReturnFeedWebSocketServer;
  // var bitrateWsHandler: BitrateWebSocketHandler;
  var latencyMonitor: LatencyMonitor;
}
global.wsServer = wsServer;
// global.bitrateWsHandler = bitrateWsHandler;
global.latencyMonitor = latencyMonitor;

server.listen(port, () => {
  console.log(`[server]: API Server is running at http://localhost:${port}`);
  console.log(`[server]: WebSocket Server is running at ws://localhost:${port}/ws`);
});