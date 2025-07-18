import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { validationResult } from 'express-validator';

// Rate limiting configurations for different endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const streamLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: 'Too many streaming requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
export const corsOptions = cors({
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
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
});

// Security headers using helmet
export const securityHeaders = helmet({
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
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
    return;
  }
  next();
};

// API key authentication for PD software
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
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

// Sanitize user input
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remove any potential script tags or SQL injection attempts
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  
  return input;
};

// Middleware to sanitize request body
export const sanitizeRequestBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
};

// Role-based access control
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    
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

// Session validation middleware
export const validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

// IP whitelist middleware for critical endpoints
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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