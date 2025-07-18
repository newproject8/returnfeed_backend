import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

interface MediaMTXAuthRequest {
  action: 'read' | 'publish' | 'api';
  user?: string;
  pass?: string;
  path?: string;
  protocol?: string;
  id?: string;
  query?: string;
  ip?: string;
}

/**
 * MediaMTX Authentication Endpoint
 * 
 * This endpoint is called by MediaMTX for every stream access request.
 * It validates credentials and permissions based on the action type.
 */
router.post('/mediamtx/auth', asyncHandler(async (req: Request, res: Response) => {
  try {
    const authReq: MediaMTXAuthRequest = req.body;
    
    console.log('MediaMTX auth request:', {
      action: authReq.action,
      path: authReq.path,
      protocol: authReq.protocol,
      ip: authReq.ip,
      user: authReq.user ? '***' : undefined
    });

    // API access is always allowed from internal network
    if (authReq.action === 'api') {
      // Check if request is from internal Docker network
      if (authReq.ip?.startsWith('172.') || authReq.ip === '127.0.0.1') {
        return res.status(200).json({ authenticated: true });
      }
      return res.status(401).json({ authenticated: false });
    }

    // Parse path to extract stream information
    const pathParts = authReq.path?.split('/').filter(p => p) || [];
    
    // Handle main SRT stream path
    if (authReq.path === 'pgm_srt_raw' || authReq.path === '/pgm_srt_raw') {
      if (authReq.action === 'publish') {
        // Validate stream key for publishing
        const streamKey = authReq.pass || authReq.query;
        
        if (!streamKey) {
          console.log('No stream key provided for publishing');
          return res.status(401).json({ authenticated: false });
        }

        // Verify stream key exists and is active
        const pdUserResult = await pool.query(
          'SELECT user_id, is_active FROM pd_users WHERE stream_key = $1',
          [streamKey]
        );

        if (pdUserResult.rows.length === 0) {
          console.log('Invalid stream key');
          return res.status(401).json({ authenticated: false });
        }

        const pdUser = pdUserResult.rows[0];
        
        if (!pdUser.is_active) {
          console.log('PD user is not active');
          return res.status(401).json({ authenticated: false });
        }

        // Update last stream timestamp
        await pool.query(
          'UPDATE pd_users SET last_stream_at = NOW() WHERE stream_key = $1',
          [streamKey]
        );

        console.log('Publishing authorized for PD user:', pdUser.user_id);
        return res.status(200).json({ authenticated: true });
      }
      
      if (authReq.action === 'read') {
        // Reading main stream requires authentication
        // Check for JWT token in query params or basic auth
        let token = authReq.query?.match(/token=([^&]+)/)?.[1] || authReq.pass;
        
        if (!token) {
          console.log('No authentication token provided for reading');
          return res.status(401).json({ authenticated: false });
        }

        try {
          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
          
          // Check if user has permission to view streams
          const userResult = await pool.query(
            'SELECT id, role FROM users WHERE id = $1',
            [decoded.userId]
          );

          if (userResult.rows.length === 0) {
            return res.status(401).json({ authenticated: false });
          }

          const user = userResult.rows[0];
          
          // Allow admins and staff to view any stream
          if (user.role === 'admin' || user.role === 'staff') {
            console.log('Read access granted to:', user.id);
            return res.status(200).json({ authenticated: true });
          }

          // Regular users need explicit permission
          // You can add more granular permissions here
          console.log('Read access denied - insufficient permissions');
          return res.status(401).json({ authenticated: false });
          
        } catch (error) {
          console.log('Invalid token:', error);
          return res.status(401).json({ authenticated: false });
        }
      }
    }

    // Handle user-specific paths: /user/{userId}/{streamKey}
    if (pathParts[0] === 'user' && pathParts.length >= 3) {
      const userId = pathParts[1];
      const streamKey = pathParts[2];

      if (authReq.action === 'publish') {
        // Verify the stream key belongs to the user
        const pdUserResult = await pool.query(
          'SELECT user_id FROM pd_users WHERE user_id = $1 AND stream_key = $2 AND is_active = true',
          [userId, streamKey]
        );

        if (pdUserResult.rows.length > 0) {
          await pool.query(
            'UPDATE pd_users SET last_stream_at = NOW() WHERE stream_key = $1',
            [streamKey]
          );
          return res.status(200).json({ authenticated: true });
        }
      }

      if (authReq.action === 'read') {
        // Similar token validation as above
        let token = authReq.query?.match(/token=([^&]+)/)?.[1] || authReq.pass;
        
        if (token) {
          try {
            jwt.verify(token, process.env.JWT_SECRET!);
            return res.status(200).json({ authenticated: true });
          } catch (error) {
            // Invalid token
          }
        }
      }
    }

    // Test path is open for development
    if (authReq.path?.includes('test') && process.env.NODE_ENV === 'development') {
      return res.status(200).json({ authenticated: true });
    }

    // Default: deny access
    console.log('Access denied by default');
    return res.status(401).json({ authenticated: false });

  } catch (error) {
    console.error('MediaMTX auth error:', error);
    return res.status(500).json({ authenticated: false, error: 'Internal server error' });
  }
}));

/**
 * Generate a secure WebRTC viewing link
 */
router.post('/mediamtx/generate-viewing-link', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { streamPath, expiresIn = 3600 } = req.body; // Default 1 hour expiry
    
    // Verify user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create a viewing token
    const viewingToken = jwt.sign(
      {
        userId: req.user.id,
        streamPath,
        type: 'stream_view'
      },
      process.env.JWT_SECRET!,
      { expiresIn }
    );

    // Construct the viewing URL
    const viewingUrl = `${req.protocol}://${req.get('host')}/stream/view?path=${encodeURIComponent(streamPath)}&token=${viewingToken}`;

    return res.json({
      success: true,
      viewingUrl,
      token: viewingToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    });

  } catch (error) {
    console.error('Error generating viewing link:', error);
    return res.status(500).json({ error: 'Failed to generate viewing link' });
  }
}));

/**
 * Stream statistics endpoint
 */
router.get('/mediamtx/stats/:streamKey', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { streamKey } = req.params;
    
    // Verify user owns this stream or is admin
    const pdUserResult = await pool.query(
      'SELECT user_id FROM pd_users WHERE stream_key = $1',
      [streamKey]
    );

    if (pdUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    const pdUser = pdUserResult.rows[0];
    
    if (req.user?.id !== pdUser.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Call MediaMTX API for stream stats
    const mediamtxUrl = `http://mediamtx:9997/v3/paths/list`;
    const response = await fetch(mediamtxUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch MediaMTX stats');
    }

    const paths = await response.json();
    
    // Find the specific stream
    const streamPath = paths.items?.find((p: any) => 
      p.name === 'pgm_srt_raw' || p.name.includes(streamKey)
    );

    if (!streamPath) {
      return res.json({
        streamKey,
        isLive: false,
        viewers: 0,
        bytesIn: 0,
        bytesOut: 0
      });
    }

    return res.json({
      streamKey,
      isLive: streamPath.ready || false,
      viewers: streamPath.readers?.length || 0,
      bytesIn: streamPath.bytesIn || 0,
      bytesOut: streamPath.bytesOut || 0,
      source: streamPath.source || null,
      created: streamPath.created || null
    });

  } catch (error) {
    console.error('Error fetching stream stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stream statistics' });
  }
}));

export default router;