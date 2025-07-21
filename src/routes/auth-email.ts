/**
 * Email-based Authentication Routes
 * Transition implementation for email login
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Email normalization helper
 */
function normalizeEmail(email: string): string {
  email = email.toLowerCase().trim();
  
  // Handle Gmail dot and plus normalization
  const [localPart, domain] = email.split('@');
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Remove dots and everything after +
    const cleanLocal = localPart.replace(/\./g, '').split('+')[0];
    return `${cleanLocal}@gmail.com`;
  }
  
  return email;
}

/**
 * Generate unique stream slug
 */
async function generateStreamSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  let counter = 0;
  let finalSlug = slug;
  
  while (true) {
    const existing = await pool.query(
      'SELECT id FROM users WHERE stream_slug = $1',
      [finalSlug]
    );
    
    if (existing.rows.length === 0) {
      return finalSlug;
    }
    
    counter++;
    finalSlug = `${slug}-${counter}`;
  }
}

/**
 * Unified login endpoint (supports both email and username during transition)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Validate input
    if (!password || (!email && !username)) {
      return res.status(400).json({
        success: false,
        message: 'Email/username and password are required.'
      });
    }
    
    // Find user by email or username
    let query: string;
    let params: any[];
    
    if (email) {
      query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)';
      params = [normalizeEmail(email)];
    } else {
      query = 'SELECT * FROM users WHERE username = $1';
      params = [username];
    }
    
    const result = await pool.query(query, params);
    
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
    
    // Update login method tracking
    await pool.query(
      `UPDATE users 
       SET last_email_login = NOW(), 
           login_method = $2 
       WHERE id = $1`,
      [user.id, email ? 'email' : 'username']
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        displayName: user.display_name || user.username,
        streamSlug: user.stream_slug
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Return success with migration prompt if using username
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.username,
        streamSlug: user.stream_slug
      },
      token,
      migrationPrompt: !email ? {
        message: '보안 강화를 위해 다음 로그인부터는 이메일을 사용해 주세요.',
        email: user.email
      } : null
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
 * Register with email
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    // Validate input
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
    
    // Normalize email
    const normalizedEmail = normalizeEmail(email);
    
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.'
      });
    }
    
    // Generate stream slug
    const baseSlug = displayName || email.split('@')[0];
    const streamSlug = await generateStreamSlug(baseSlug);
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (
        email, 
        password_hash, 
        display_name, 
        stream_slug,
        login_method,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, 'email', NOW(), NOW())
      RETURNING id, email, display_name, stream_slug`,
      [normalizedEmail, passwordHash, displayName || null, streamSlug]
    );
    
    const newUser = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        email: newUser.email,
        displayName: newUser.display_name,
        streamSlug: newUser.stream_slug
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.display_name,
        streamSlug: newUser.stream_slug
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
 * Check email availability
 */
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    const result = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );
    
    res.json({
      success: true,
      available: result.rows.length === 0,
      normalized: normalizedEmail !== email ? normalizedEmail : undefined
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
 * Update profile (for email migration)
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { displayName, email } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    // Update display name
    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }
    
    // Update email (with verification in production)
    if (email && email !== req.user.email) {
      // Check if new email is available
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
        [normalizeEmail(email), userId]
      );
      
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use.'
        });
      }
      
      updates.push(`email = $${paramCount++}`);
      values.push(normalizeEmail(email));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided.'
      });
    }
    
    // Add updated_at
    updates.push(`updated_at = NOW()`);
    
    // Execute update
    values.push(userId);
    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, display_name, stream_slug`,
      values
    );
    
    res.json({
      success: true,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Migration status endpoint (admin only)
 */
router.get('/migration-status', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (implement your admin check)
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: 'Forbidden' });
    // }
    
    const status = await pool.query('SELECT * FROM email_migration_status');
    const issues = await pool.query('SELECT * FROM email_migration_issues');
    
    res.json({
      success: true,
      status: status.rows[0],
      issues: issues.rows
    });
    
  } catch (error) {
    console.error('Migration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;