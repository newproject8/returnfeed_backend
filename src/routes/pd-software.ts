import express, { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Generate stream key for PD software
const generateStreamKey = () => {
  return crypto.randomBytes(20).toString('hex');
};

// PD Software registration/authentication endpoint
router.post('/register', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { softwareVersion, vmixPort } = req.body;
  const userId = (req as any).user.id;

  // Check if user has PD role
  const userResult = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows[0]?.role !== 'pd' && userResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ message: 'Only PD users can register software' });
  }

  // Generate unique stream key
  const streamKey = generateStreamKey();

  // Update user with stream key
  await pool.query(
    'UPDATE users SET stream_key = $1 WHERE id = $2',
    [streamKey, userId]
  );

  // Generate special PD token with extended expiry
  const pdToken = jwt.sign(
    { 
      id: userId, 
      isPD: true,
      streamKey: streamKey,
      softwareVersion: softwareVersion 
    },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' } // Long-lived token for PD software
  );

  res.json({
    streamKey,
    pdToken,
    websocketUrl: `wss://${req.get('host')}/ws`,
    mediaMtxUrl: `srt://${req.get('host')}:8890`,
    vmixTallyPort: 8099 // Default vMix tally port
  });
}));

// Get stream configuration for PD software
router.get('/stream-config/:sessionKey', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const userId = (req as any).user.id;

  // Verify session ownership or PD role
  const sessionResult = await pool.query(
    `SELECT s.*, sp.role as user_role
     FROM sessions s
     LEFT JOIN session_participants sp ON s.id = sp.session_id AND sp.user_id = $2
     WHERE s.session_key = $1`,
    [sessionKey, userId]
  );

  if (sessionResult.rows.length === 0) {
    return res.status(404).json({ message: 'Session not found' });
  }

  const session = sessionResult.rows[0];

  if (session.owner_id !== userId && session.user_role !== 'pd') {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Generate stream-specific configuration
  const streamId = `session_${sessionKey}`;
  const streamPath = `live/${streamId}`;

  res.json({
    sessionKey,
    streamId,
    srt: {
      publishUrl: `srt://${req.get('host')}:8890`,
      streamId: streamPath,
      passphrase: session.session_key // Use session key as passphrase
    },
    webrtc: {
      whepEndpoint: `https://${req.get('host')}/whep/${streamPath}`,
      whipEndpoint: `https://${req.get('host')}/whip/${streamPath}`
    },
    hls: {
      playbackUrl: `https://${req.get('host')}/hls/${streamPath}/index.m3u8`
    },
    websocket: {
      url: `wss://${req.get('host')}/ws`,
      sessionId: sessionKey
    }
  });
}));

// Update inputs list from PD software (vMix camera inputs)
router.post('/inputs/:sessionKey', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const { inputs, timestamp, vmixVersion } = req.body;
  const userId = (req as any).user.id;

  // Verify PD role
  const sessionResult = await pool.query(
    `SELECT s.id, sp.role
     FROM sessions s
     JOIN session_participants sp ON s.id = sp.session_id
     WHERE s.session_key = $1 AND sp.user_id = $2`,
    [sessionKey, userId]
  );

  if (sessionResult.rows.length === 0 || sessionResult.rows[0].role !== 'pd') {
    return res.status(403).json({ message: 'Only PD can update inputs' });
  }

  const sessionId = sessionResult.rows[0].id;

  // Update or insert inputs data into stream_configs
  await pool.query(
    `INSERT INTO stream_configs (session_id, input_list, vmix_version, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (session_id) 
     DO UPDATE SET 
       input_list = EXCLUDED.input_list,
       vmix_version = EXCLUDED.vmix_version,
       updated_at = NOW()`,
    [sessionId, JSON.stringify(inputs), vmixVersion || 'unknown']
  );

  // Broadcast inputs update via WebSocket
  if (global.wsServer) {
    try {
      global.wsServer.broadcastToSession(sessionKey, {
        type: 'inputs_update',
        inputs: inputs,
        timestamp: timestamp || new Date().toISOString(),
        vmixVersion: vmixVersion
      });
    } catch (error) {
      console.error('Failed to broadcast inputs update:', error);
    }
  }

  res.json({ 
    message: 'Inputs updated successfully',
    inputCount: Object.keys(inputs).length
  });
}));

// Update tally state from PD software
router.post('/tally/:sessionKey', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const { programInput, previewInput, inputs } = req.body;
  const userId = (req as any).user.id;

  // Verify PD role
  const sessionResult = await pool.query(
    `SELECT s.id, sp.role
     FROM sessions s
     JOIN session_participants sp ON s.id = sp.session_id
     WHERE s.session_key = $1 AND sp.user_id = $2`,
    [sessionKey, userId]
  );

  if (sessionResult.rows.length === 0 || sessionResult.rows[0].role !== 'pd') {
    return res.status(403).json({ message: 'Only PD can update tally' });
  }

  const sessionId = sessionResult.rows[0].id;

  // Update stream_configs with tally data (통일된 스키마 사용)
  await pool.query(
    `INSERT INTO stream_configs (session_id, tally_program, tally_preview, input_list, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (session_id)
     DO UPDATE SET 
       tally_program = EXCLUDED.tally_program,
       tally_preview = EXCLUDED.tally_preview,
       input_list = EXCLUDED.input_list,
       updated_at = NOW()`,
    [sessionId, programInput, previewInput, JSON.stringify(inputs || {})]
  );

  // Broadcast tally update via WebSocket
  if (global.wsServer) {
    try {
      global.wsServer.broadcastTallyUpdate(sessionKey, {
        program: programInput,
        preview: previewInput,
        inputs: inputs || {}
      });
    } catch (error) {
      console.error('Failed to broadcast tally update:', error);
    }
  }

  res.json({ message: 'Tally state updated successfully' });
}));

// Get vMix connection info
router.get('/vmix-config', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  // Check PD role
  const userResult = await pool.query(
    'SELECT role, stream_key FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows[0]?.role !== 'pd' && userResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ message: 'Only PD users can access vMix config' });
  }

  res.json({
    vmixTcpPort: 8099,
    vmixApiPort: 8088,
    tallyProtocol: 'TCP',
    apiEndpoints: {
      inputs: '/api/inputs',
      tally: '/api/tally',
      activeinputs: '/api/activeinputs'
    },
    pollingInterval: 100, // milliseconds
    reconnectDelay: 5000 // milliseconds
  });
}));

// Health check for PD software
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const dbHealthy = await pool.query('SELECT 1').then(() => true).catch(() => false);
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: 'operational', // Assume operational if this endpoint is reachable
      version: '1.0.0'
    }
  });
}));

export default router;