"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("../config/passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Cookie options for JWT
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
};
// Register endpoint with secure password handling
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    // Input validation
    if (!username || !password || !email) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    // Password strength validation
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    try {
        // Check if user exists
        const existingUser = await db_1.default.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'User already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const result = await db_1.default.query('INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id, username, email', [username, hashedPassword, email]);
        const user = result.rows[0];
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // Set httpOnly cookie
        res.cookie('token', token, cookieOptions);
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Login endpoint with httpOnly cookie
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    try {
        // Find user
        const result = await db_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = result.rows[0];
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // Set httpOnly cookie
        res.cookie('token', token, cookieOptions);
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Logout endpoint
router.post('/logout', (req, res) => {
    // Clear the cookie
    res.clearCookie('token', { path: '/' });
    res.json({ message: 'Logout successful' });
});
// Verify token endpoint (for checking auth status)
router.get('/verify', async (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Get user info
        const result = await db_1.default.query('SELECT id, username, email FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ authenticated: false });
        }
        res.json({
            authenticated: true,
            user: result.rows[0]
        });
    }
    catch (error) {
        res.status(401).json({ authenticated: false });
    }
});
// Google OAuth with httpOnly cookie
router.get('/google', passport_1.default.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
}));
// Google callback with secure cookie
router.get('/google/callback', passport_1.default.authenticate('google', { session: false }), (req, res) => {
    // Generate JWT
    const token = jsonwebtoken_1.default.sign({ userId: req.user.id, email: req.user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    // Set httpOnly cookie
    res.cookie('token', token, cookieOptions);
    // Redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
});
// Refresh token endpoint
router.post('/refresh', async (req, res) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Generate new token
        const newToken = jsonwebtoken_1.default.sign({ userId: decoded.userId, username: decoded.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // Set new cookie
        res.cookie('token', newToken, cookieOptions);
        res.json({ message: 'Token refreshed successfully' });
    }
    catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
});
exports.default = router;
