"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const db_1 = require("../db");
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Helper to generate unique stream key
const generateStreamKey = () => {
    return crypto_1.default.randomBytes(20).toString('hex');
};
// Helper to generate staff URL
const generateStaffUrl = (sessionKey) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://returnfeed.net';
    return `${baseUrl}/staff/${sessionKey}`;
};
// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// PD Software specific registration
router.post('/register-pd', asyncHandler(async (req, res) => {
    const { username, password, email, isPDSoftware } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({
            success: false,
            message: 'Username, email and password are required.'
        });
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
        // Generate stream key
        const streamKey = generateStreamKey();
        // Create user with PD role
        const userResult = await client.query(`INSERT INTO users (username, email, password_hash, role, stream_key, is_pd) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, username, email, role, stream_key, created_at`, [username, email, passwordHash, 'pd', streamKey, true]);
        const newUser = userResult.rows[0];
        // Create default session for PD
        const sessionKey = crypto_1.default.randomBytes(16).toString('hex');
        const sessionResult = await client.query(`INSERT INTO sessions (session_key, name, owner_id) 
       VALUES ($1, $2, $3) 
       RETURNING id, session_key`, [`pd_${sessionKey}`, `${username}'s Studio`, newUser.id]);
        const session = sessionResult.rows[0];
        // Add PD as participant
        await client.query(`INSERT INTO session_participants (session_id, user_id, role) 
       VALUES ($1, $2, $3)`, [session.id, newUser.id, 'pd']);
        // Register PD software if flag is set
        if (isPDSoftware) {
            await client.query(`INSERT INTO pd_software_registrations 
         (user_id, software_version, ip_address, vmix_port) 
         VALUES ($1, $2, $3, $4)`, [newUser.id, req.body.softwareVersion || '1.0.0', req.ip, req.body.vmixPort || 8088]);
        }
        await client.query('COMMIT');
        // Generate tokens
        const authToken = jsonwebtoken_1.default.sign({
            id: newUser.id,
            username: newUser.username,
            role: 'pd',
            email: newUser.email
        }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '7d' });
        const pdToken = jsonwebtoken_1.default.sign({
            id: newUser.id,
            isPD: true,
            streamKey: streamKey,
            sessionKey: session.session_key
        }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '30d' });
        // Audit log
        if (req.ip) {
            (0, logger_1.auditLog)(newUser.id, 'pd_registration', 'user', req.ip, req.get('user-agent') || '', 'success', { username, isPDSoftware });
        }
        res.status(201).json({
            success: true,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            },
            tokens: {
                authToken,
                pdToken
            },
            streamConfig: {
                streamKey: newUser.stream_key,
                sessionKey: session.session_key,
                staffUrl: generateStaffUrl(session.session_key),
                srtUrl: `srt://${req.get('host')}:8890?streamid=${session.session_key}`,
                websocketUrl: `wss://${req.get('host')}/ws`
            }
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        // Check for duplicate user
        if (error.code === '23505') {
            if (error.constraint === 'users_username_key') {
                return res.status(409).json({
                    success: false,
                    message: 'Username already exists.'
                });
            }
            else if (error.constraint === 'users_email_key') {
                return res.status(409).json({
                    success: false,
                    message: 'Email already exists.'
                });
            }
        }
        throw error;
    }
    finally {
        client.release();
    }
}));
// Get registration URL for PD software
router.get('/registration-url', asyncHandler(async (req, res) => {
    const { source } = req.query;
    const baseUrl = process.env.FRONTEND_URL || 'https://returnfeed.net';
    // Generate unique registration token
    const registrationToken = crypto_1.default.randomBytes(16).toString('hex');
    // Store token temporarily (in production, use Redis)
    // For now, we'll encode it in the URL
    const registrationUrl = `${baseUrl}/register?pd=true&token=${registrationToken}&source=${source || 'pd_software'}`;
    res.json({
        success: true,
        registrationUrl,
        expiresIn: 3600 // 1 hour
    });
}));
// Login for PD users with enhanced response
router.post('/login-pd', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username and password are required.'
        });
    }
    const result = await db_1.default.query('SELECT * FROM users WHERE username = $1 AND role = $2', [username, 'pd']);
    const user = result.rows[0];
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials or not a PD user.'
        });
    }
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!isPasswordValid) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials.'
        });
    }
    // Get user's session
    const sessionResult = await db_1.default.query(`SELECT s.* FROM sessions s 
     WHERE s.owner_id = $1 AND s.is_active = true 
     ORDER BY s.created_at DESC 
     LIMIT 1`, [user.id]);
    const session = sessionResult.rows[0];
    // Generate tokens
    const authToken = jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
    }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '7d' });
    const pdToken = jsonwebtoken_1.default.sign({
        id: user.id,
        isPD: true,
        streamKey: user.stream_key,
        sessionKey: session?.session_key
    }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '30d' });
    // Update last login
    await db_1.default.query('UPDATE users SET last_pd_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    // Audit log
    if (req.ip) {
        (0, logger_1.auditLog)(user.id, 'pd_login', 'authentication', req.ip, req.get('user-agent') || '', 'success', { username });
    }
    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        },
        tokens: {
            authToken,
            pdToken
        },
        streamConfig: {
            streamKey: user.stream_key,
            sessionKey: session?.session_key,
            staffUrl: session ? generateStaffUrl(session.session_key) : null,
            srtUrl: session ? `srt://${req.get('host')}:8890?streamid=${session.session_key}` : null,
            websocketUrl: `wss://${req.get('host')}/ws`
        }
    });
}));
// Get current stream configuration for PD
router.get('/stream-info', asyncHandler(async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default-secret');
        if (!decoded.isPD) {
            return res.status(403).json({
                success: false,
                message: 'Not a PD user'
            });
        }
        // Get user's active session
        const sessionResult = await db_1.default.query(`SELECT s.* FROM sessions s 
       WHERE s.owner_id = $1 AND s.is_active = true 
       ORDER BY s.created_at DESC 
       LIMIT 1`, [decoded.id]);
        const session = sessionResult.rows[0];
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'No active session found'
            });
        }
        res.json({
            success: true,
            streamConfig: {
                streamKey: decoded.streamKey,
                sessionKey: session.session_key,
                staffUrl: generateStaffUrl(session.session_key),
                srtUrl: `srt://${req.get('host')}:8890?streamid=${session.session_key}`,
                websocketUrl: `wss://${req.get('host')}/ws`,
                session: {
                    id: session.id,
                    name: session.name,
                    isActive: session.is_active,
                    createdAt: session.created_at
                }
            }
        });
    }
    catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid token'
        });
    }
}));
exports.default = router;
