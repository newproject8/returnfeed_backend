import express, { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();

// Helper to generate unique session keys
const generateSessionKey = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Create a new session
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const userId = (req as any).user.id;

  if (!name) {
    return res.status(400).json({ message: 'Session name is required' });
  }

  const sessionKey = generateSessionKey();
  
  const result = await pool.query(
    `INSERT INTO sessions (session_key, name, owner_id) 
     VALUES ($1, $2, $3) 
     RETURNING id, session_key, name, owner_id, is_active, created_at`,
    [sessionKey, name, userId]
  );

  // Add owner as participant with 'pd' role
  await pool.query(
    `INSERT INTO session_participants (session_id, user_id, role) 
     VALUES ($1, $2, $3)`,
    [result.rows[0].id, userId, 'pd']
  );

  res.status(201).json(result.rows[0]);
}));

// Get all sessions for a user
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const result = await pool.query(
    `SELECT DISTINCT s.*, 
            u.username as owner_username,
            sp.role as user_role
     FROM sessions s
     JOIN users u ON s.owner_id = u.id
     LEFT JOIN session_participants sp ON s.id = sp.session_id AND sp.user_id = $1
     WHERE s.owner_id = $1 OR sp.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );

  res.json(result.rows);
}));

// Get session details
router.get('/:sessionKey', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const userId = (req as any).user.id;

  // Get session info
  const sessionResult = await pool.query(
    `SELECT s.*, u.username as owner_username
     FROM sessions s
     JOIN users u ON s.owner_id = u.id
     WHERE s.session_key = $1`,
    [sessionKey]
  );

  if (sessionResult.rows.length === 0) {
    return res.status(404).json({ message: 'Session not found' });
  }

  const session = sessionResult.rows[0];

  // Check if user is participant
  const participantResult = await pool.query(
    `SELECT role FROM session_participants 
     WHERE session_id = $1 AND user_id = $2`,
    [session.id, userId]
  );

  if (participantResult.rows.length === 0 && session.owner_id !== userId) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Get all participants
  const participantsResult = await pool.query(
    `SELECT u.id, u.username, u.email, sp.role, sp.joined_at
     FROM session_participants sp
     JOIN users u ON sp.user_id = u.id
     WHERE sp.session_id = $1
     ORDER BY sp.joined_at`,
    [session.id]
  );

  // Get current tally state
  const tallyResult = await pool.query(
    `SELECT program_input, preview_input, inputs, updated_at
     FROM tally_states
     WHERE session_id = $1`,
    [session.id]
  );

  res.json({
    ...session,
    user_role: participantResult.rows[0]?.role || (session.owner_id === userId ? 'pd' : null),
    participants: participantsResult.rows,
    tally_state: tallyResult.rows[0] || null
  });
}));

// Join a session
router.post('/:sessionKey/join', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const { role } = req.body;
  const userId = (req as any).user.id;

  if (!role || !['camera', 'staff', 'viewer'].includes(role)) {
    return res.status(400).json({ message: 'Valid role is required (camera, staff, viewer)' });
  }

  // Get session
  const sessionResult = await pool.query(
    'SELECT id, is_active FROM sessions WHERE session_key = $1',
    [sessionKey]
  );

  if (sessionResult.rows.length === 0) {
    return res.status(404).json({ message: 'Session not found' });
  }

  const session = sessionResult.rows[0];

  if (!session.is_active) {
    return res.status(400).json({ message: 'Session is not active' });
  }

  // Add participant
  await pool.query(
    `INSERT INTO session_participants (session_id, user_id, role) 
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, user_id) 
     DO UPDATE SET role = $3`,
    [session.id, userId, role]
  );

  res.json({ message: 'Joined session successfully', role });
}));

// Update session status
router.patch('/:sessionKey', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const { is_active } = req.body;
  const userId = (req as any).user.id;

  // Check ownership
  const result = await pool.query(
    `UPDATE sessions SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE session_key = $2 AND owner_id = $3
     RETURNING *`,
    [is_active, sessionKey, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Session not found or unauthorized' });
  }

  res.json(result.rows[0]);
}));

// Delete a session (owner only)
router.delete('/:sessionKey', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const userId = (req as any).user.id;

  const result = await pool.query(
    'DELETE FROM sessions WHERE session_key = $1 AND owner_id = $2 RETURNING id',
    [sessionKey, userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Session not found or unauthorized' });
  }

  res.json({ message: 'Session deleted successfully' });
}));

export default router;