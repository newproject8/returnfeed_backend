"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("./config/passport"));
// Import routes
const stream_1 = __importDefault(require("./routes/stream"));
const auth_1 = __importDefault(require("./routes/auth"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const pd_software_1 = __importDefault(require("./routes/pd-software"));
// import healthRoutes from './routes/health';
// Import middleware
const security_1 = require("./middleware/security");
const errorHandler_1 = require("./middleware/errorHandler");
const monitoring_1 = require("./utils/monitoring");
// Import utilities
const logger_1 = __importDefault(require("./utils/logger"));
// Load environment variables
dotenv_1.default.config();
// Initialize express app
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Trust proxy for accurate IP addresses
app.set('trust proxy', true);
// Apply security headers
app.use(security_1.securityHeaders);
// Apply CORS
app.use(security_1.corsOptions);
// Request ID for tracing
app.use(monitoring_1.requestIdMiddleware);
// Performance monitoring
app.use(monitoring_1.performanceMonitor);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Sanitize request body
app.use(security_1.sanitizeRequestBody);
// HTTP request logging
// app.use(morgan('combined', { stream: httpLogStream }));
// Passport initialization
app.use(passport_1.default.initialize());
// Health check endpoint (no rate limiting)
app.get('/api/health', async (req, res) => {
    const { getSystemHealth } = await Promise.resolve().then(() => __importStar(require('./utils/monitoring')));
    const health = await getSystemHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
// Apply rate limiting to auth routes
app.use('/api/auth/login', security_1.authLimiter);
app.use('/api/auth/register', security_1.authLimiter);
// Apply general rate limiting to all API routes
app.use('/api', security_1.apiLimiter);
// API Routes
app.use('/api/stream', stream_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/sessions', sessions_1.default);
app.use('/api/pd-software', pd_software_1.default);
// app.use('/api/health', healthRoutes);
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'ReturnFeed Enterprise API',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
    });
});
// 404 handler
app.use(errorHandler_1.notFoundHandler);
// Global error handler
app.use(errorHandler_1.globalErrorHandler);
// Start server
const server = app.listen(port, () => {
    logger_1.default.info(`🚀 Enterprise API Server is running`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        pid: process.pid,
    });
});
// Initialize monitoring
if (process.env.NODE_ENV === 'production') {
    (0, monitoring_1.monitorDatabasePool)();
    (0, monitoring_1.detectMemoryLeaks)();
}
// Handle uncaught exceptions and rejections
(0, errorHandler_1.uncaughtExceptionHandler)();
(0, errorHandler_1.unhandledRejectionHandler)();
// Graceful shutdown
(0, monitoring_1.gracefulShutdown)(server);
exports.default = app;
