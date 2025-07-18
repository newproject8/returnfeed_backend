"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipWhitelist = exports.validateSession = exports.requireRole = exports.sanitizeRequestBody = exports.sanitizeInput = exports.authenticateApiKey = exports.validateRequest = exports.securityHeaders = exports.corsOptions = exports.streamLimiter = exports.apiLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_validator_1 = require("express-validator");
// Rate limiting configurations for different endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.streamLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute
    message: 'Too many streaming requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
// CORS configuration
exports.corsOptions = (0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'https://returnfeed.net',
            'https://www.returnfeed.net',
            'http://localhost:3000',
            'http://localhost:5173', // Vite dev server
        ].filter(Boolean); // Remove undefined values
        // Allow requests with no origin (like mobile apps)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
});
// Security headers using helmet
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'wss:', 'https:'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
});
// Request validation middleware
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            errors: errors.array()
        });
        return;
    }
    next();
};
exports.validateRequest = validateRequest;
// API key authentication for PD software
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.status(401).json({
            success: false,
            message: 'API key required'
        });
        return;
    }
    // In production, validate against database
    // For now, check against environment variable
    if (apiKey !== process.env.PD_SOFTWARE_API_KEY) {
        res.status(403).json({
            success: false,
            message: 'Invalid API key'
        });
        return;
    }
    next();
};
exports.authenticateApiKey = authenticateApiKey;
// Sanitize user input
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        // Remove any potential script tags or SQL injection attempts
        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .trim();
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const key in input) {
            if (input.hasOwnProperty(key)) {
                sanitized[key] = (0, exports.sanitizeInput)(input[key]);
            }
        }
        return sanitized;
    }
    return input;
};
exports.sanitizeInput = sanitizeInput;
// Middleware to sanitize request body
const sanitizeRequestBody = (req, res, next) => {
    if (req.body) {
        req.body = (0, exports.sanitizeInput)(req.body);
    }
    next();
};
exports.sanitizeRequestBody = sanitizeRequestBody;
// Role-based access control
const requireRole = (roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Session validation middleware
const validateSession = async (req, res, next) => {
    const sessionKey = req.params.sessionKey || req.body.sessionKey;
    if (!sessionKey) {
        res.status(400).json({
            success: false,
            message: 'Session key required'
        });
        return;
    }
    // Additional session validation logic can be added here
    next();
};
exports.validateSession = validateSession;
// IP whitelist middleware for critical endpoints
const ipWhitelist = (allowedIPs) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        if (!clientIP || !allowedIPs.includes(clientIP)) {
            res.status(403).json({
                success: false,
                message: 'Access denied'
            });
            return;
        }
        next();
    };
};
exports.ipWhitelist = ipWhitelist;
