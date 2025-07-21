/**
 * Clean Email-Only Authentication Routes
 * No username field, only email-based authentication
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import crypto from 'crypto';

const router = Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
};

/**
 * Normalize email address
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Generate profile slug from email or display name
 */
async function generateProfileSlug(base: string): Promise<string> {
  // Clean the base string
  let slug = base
    .toLowerCase()
    .replace(/@.*$/, '') // Remove domain part if email
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Ensure minimum length
  if (slug.length < 3) {
    slug = 'user-' + slug;
  }
  
  // Check uniqueness
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
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;
    
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
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.'
      });
    }
    
    // Generate profile slug
    const profileSlug = await generateProfileSlug(displayName || email);
    
    // Generate stream key
    const streamKey = crypto.randomBytes(20).toString('hex');
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (
        email, 
        password_hash, 
        display_name,
        profile_slug,
        stream_key,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, email, display_name, profile_slug, stream_key, role`,
      [normalizedEmail, passwordHash, displayName || null, profileSlug, streamKey]
    );
    
    const user = result.rows[0];
    
    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profileSlug: user.profile_slug,
        streamKey: user.stream_key
      },
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }
    
    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profileSlug: user.profile_slug,
        role: user.role,
        isPd: user.is_pd
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Logout user
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * Get current user
 */
router.get('/me', async (req: Request, res: Response) => {
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
    
    // Get user details
    const result = await pool.query(
      'SELECT id, email, display_name, profile_slug, role, is_pd, created_at FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

/**
 * Check email availability
 */
router.post('/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    res.json({
      success: true,
      available: result.rows.length === 0
    });
    
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Password reset request
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    // Check if user exists
    const result = await pool.query(
      'SELECT id, display_name FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (result.rows.length > 0) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour
      
      // Store reset token (you'd need to add these columns to the database)
      // await pool.query(
      //   'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE email = $3',
      //   [resetToken, resetExpires, normalizedEmail]
      // );
      
      // TODO: Send email with reset link
      // sendResetEmail(normalizedEmail, resetToken);
    }
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.'
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;