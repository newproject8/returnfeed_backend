/**
 * PD Authentication Routes - Email Only
 * Special authentication for PD Software users
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import crypto from 'crypto';

const router = Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '30d'; // Longer for PD software

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/'
};

/**
 * Normalize email address
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Generate session key for streaming
 */
function generateSessionKey(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate profile slug for PD
 */
async function generatePdSlug(base: string): Promise<string> {
  // PD slugs are prefixed with 'pd-'
  let slug = 'pd-' + base
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  let finalSlug = slug;
  let counter = 0;
  
  while (true) {
    const existing = await pool.query(
      'SELECT id FROM users WHERE profile_slug = $1',
      [finalSlug]
    );
    
    if (existing.rows.length === 0) break;
    
    counter++;
    finalSlug = `${slug}-${counter}`;
  }
  
  return finalSlug;
}

/**
 * Register PD user
 */
router.post('/register-pd', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, pdSoftwareVersion } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.'
      });
    }
    
    // Password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    // Check if email exists
    const existingUser = await pool.query(
      'SELECT id, is_pd FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.is_pd) {
        return res.status(409).json({
          success: false,
          message: 'PD account already exists with this email.'
        });
      } else {
        return res.status(409).json({
          success: false,
          message: 'Email already registered. Please use a different email for PD account.'
        });
      }
    }
    
    // Generate unique identifiers
    const profileSlug = await generatePdSlug(displayName || email);
    const streamKey = crypto.randomBytes(20).toString('hex');
    const sessionKey = generateSessionKey();
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create PD user
    const userResult = await pool.query(
      `INSERT INTO users (
        email, 
        password_hash, 
        display_name,
        profile_slug,
        stream_key,
        role,
        is_pd,
        pd_software_version,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'pd', true, $6, NOW(), NOW())
      RETURNING id, email, display_name, profile_slug, stream_key`,
      [normalizedEmail, passwordHash, displayName || null, profileSlug, streamKey, pdSoftwareVersion || null]
    );
    
    const user = userResult.rows[0];
    
    // Create initial stream session
    const sessionResult = await pool.query(
      `INSERT INTO stream_sessions (
        user_id,
        session_key,
        rtmp_url,
        srt_url,
        staff_url,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING session_key`,
      [
        user.id,
        sessionKey,
        `rtmp://returnfeed.net/live/${streamKey}`,
        `srt://returnfeed.net:8890?streamid=${sessionKey}`,
        `https://returnfeed.net/staff/${sessionKey}`
      ]
    );
    
    // Generate JWT with extended expiration
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: 'pd',
        isPd: true
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);
    
    res.status(201).json({
      success: true,
      message: 'PD account created successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profileSlug: user.profile_slug
      },
      config: {
        streamKey: user.stream_key,
        sessionKey: sessionResult.rows[0].session_key,
        rtmpUrl: `rtmp://returnfeed.net/live/${user.stream_key}`,
        srtUrl: `srt://returnfeed.net:8890?streamid=${sessionResult.rows[0].session_key}`,
        staffUrl: `https://returnfeed.net/staff/${sessionResult.rows[0].session_key}`,
        websocketUrl: 'wss://returnfeed.net/ws'
      },
      token
    });
    
  } catch (error) {
    console.error('PD registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PD Login
 */
router.post('/login-pd', async (req: Request, res: Response) => {
  try {
    const { email, password, pdSoftwareVersion } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    // Find PD user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_pd = true',
      [normalizedEmail]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or not a PD user.'
      });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or not a PD user.'
      });
    }
    
    // Update last PD login and version
    await pool.query(
      'UPDATE users SET last_pd_login = NOW(), pd_software_version = $2 WHERE id = $1',
      [user.id, pdSoftwareVersion || user.pd_software_version]
    );
    
    // Get or create active session
    let sessionResult = await pool.query(
      'SELECT * FROM stream_sessions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );
    
    let sessionKey;
    if (sessionResult.rows.length === 0) {
      // Create new session
      sessionKey = generateSessionKey();
      await pool.query(
        `INSERT INTO stream_sessions (
          user_id,
          session_key,
          rtmp_url,
          srt_url,
          staff_url,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          user.id,
          sessionKey,
          `rtmp://returnfeed.net/live/${user.stream_key}`,
          `srt://returnfeed.net:8890?streamid=${sessionKey}`,
          `https://returnfeed.net/staff/${sessionKey}`
        ]
      );
    } else {
      sessionKey = sessionResult.rows[0].session_key;
    }
    
    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: 'pd',
        isPd: true
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);
    
    res.json({
      success: true,
      message: 'PD login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profileSlug: user.profile_slug
      },
      config: {
        streamKey: user.stream_key,
        sessionKey: sessionKey,
        rtmpUrl: `rtmp://returnfeed.net/live/${user.stream_key}`,
        srtUrl: `srt://returnfeed.net:8890?streamid=${sessionKey}`,
        staffUrl: `https://returnfeed.net/staff/${sessionKey}`,
        websocketUrl: 'wss://returnfeed.net/ws'
      },
      token
    });
    
  } catch (error) {
    console.error('PD login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get stream configuration
 */
router.get('/stream-info', async (req: Request, res: Response) => {
  try {
    // Get token from cookie or header
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (!decoded.isPd) {
      return res.status(403).json({
        success: false,
        message: 'Not a PD user'
      });
    }
    
    // Get user and session info
    const userResult = await pool.query(
      'SELECT stream_key, display_name, profile_slug FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Get active session
    const sessionResult = await pool.query(
      'SELECT * FROM stream_sessions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
      [decoded.id]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active session found'
      });
    }
    
    const session = sessionResult.rows[0];
    
    res.json({
      success: true,
      stream: {
        streamKey: user.stream_key,
        sessionKey: session.session_key,
        rtmpUrl: session.rtmp_url,
        srtUrl: session.srt_url,
        staffUrl: session.staff_url,
        websocketUrl: 'wss://returnfeed.net/ws',
        displayName: user.display_name,
        profileSlug: user.profile_slug
      }
    });
    
  } catch (error) {
    console.error('Stream info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * End stream session
 */
router.post('/end-stream', async (req: Request, res: Response) => {
  try {
    // Get token
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (!decoded.isPd) {
      return res.status(403).json({
        success: false,
        message: 'Not a PD user'
      });
    }
    
    // End active sessions
    await pool.query(
      'UPDATE stream_sessions SET is_active = false, ended_at = NOW() WHERE user_id = $1 AND is_active = true',
      [decoded.id]
    );
    
    res.json({
      success: true,
      message: 'Stream session ended'
    });
    
  } catch (error) {
    console.error('End stream error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;