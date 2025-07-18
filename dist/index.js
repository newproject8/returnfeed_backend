"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const http_1 = require("http");
const dotenv_1 = require("dotenv");
const db_1 = require("./db");
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = require("jsonwebtoken");
const stream_1 = require("./routes/stream");
const passport_1 = require("./config/passport");
const auth_1 = require("./routes/auth");
const sessions_1 = require("./routes/sessions");
const pd_software_1 = require("./routes/pd-software");
const pd_auth_1 = require("./routes/pd-auth");
const browser_launch_1 = require("./routes/browser-launch");
const server_1 = require("./websocket/server");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use(express_1.default.json());
app.use(passport_1.default.initialize());
// Async Error Handling Wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// 서버 상태 확인을 위한 기본 라우트
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API server is running' });
});
// 데이터베이스 연결 테스트를 위한 라우트
app.get('/api/db-test', asyncHandler(async (req, res) => {
    const client = await db_1.default.connect();
    const result = await client.query('SELECT NOW()');
    res.status(200).json({
        status: 'ok',
        message: 'Database connection successful!',
        db_time: result.rows[0].now,
    });
    client.release();
}));
// 사용자 회원가입
app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        // This will be caught by the global error handler, but returning early is fine.
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    // Generate email from username for simplicity
    const email = `${username}@returnfeed.local`;
    const saltRounds = 10;
    const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
    const newUser = await db_1.default.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at', [username, email, passwordHash]);
    res.status(201).json(newUser.rows[0]);
}));
// 사용자 로그인
app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    const result = await db_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'default-secret', // Fallback for safety, but secret should be set
    { expiresIn: '1h' });
    res.json({ token });
}));
// Root route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Welcome to ReturnFeed API' });
});
app.use('/api/stream', stream_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/sessions', sessions_1.default);
app.use('/api/pd-software', pd_software_1.default);
app.use('/api/pd-auth', pd_auth_1.default);
app.use('/api/browser', browser_launch_1.default);
// Global Error Handler Middleware
app.use((err, req, res, next) => {
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
const server = (0, http_1.createServer)(app);
// Initialize WebSocket server
const wsServer = new server_1.ReturnFeedWebSocketServer(server);
global.wsServer = wsServer;
server.listen(port, () => {
    console.log(`[server]: API Server is running at http://localhost:${port}`);
    console.log(`[server]: WebSocket Server is running at ws://localhost:${port}/ws`);
});
