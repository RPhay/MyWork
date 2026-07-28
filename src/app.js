import express from 'express';
import session from 'express-session';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/environment.js';
import logger from './utils/logger.js';
import { ValidationError, AppError } from './config/errors.js';
import indexRouter from './routes/index.js';
import { readVersion } from './utils/version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security middleware
if (config.security.helmet) {
  app.use(helmet());
}

// Logging middleware
app.use(morgan('dev'));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.app.env === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: 'strict',
    maxAge: config.session.timeout,
  },
}));

// CSRF protection middleware
if (config.security.csrf) {
  app.use(csrf({ cookie: false })); // Use session instead of cookie
}

// Rate limiting middleware
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static files and health checks
    return req.path === '/health' || req.path.startsWith('/public');
  },
});

if (config.rateLimit.enabled) {
  app.use(globalLimiter);
}

// CSRF token middleware - make token available to all views
app.use((req, res, next) => {
  if (config.security.csrf && req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

// Request ID middleware for logging
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

// Flash message middleware
app.use((req, res, next) => {
  res.locals.flash = {
    error: req.session?.flashError,
    success: req.session?.flashSuccess,
    info: req.session?.flashInfo,
  };

  if (req.session) {
    req.session.flashError = undefined;
    req.session.flashSuccess = undefined;
    req.session.flashInfo = undefined;
  }

  next();
});

// Routes
app.use('/', indexRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  // Log error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).render('error', {
      title: 'Validation Error',
      message: err.message,
      statusCode: err.statusCode,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).render('error', {
      title: 'Error',
      message: err.message,
      statusCode: err.statusCode,
    });
  }

  // CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'CSRF Error',
      message: 'CSRF validation failed',
      statusCode: 403,
    });
  }

  // Default error handler
  const statusCode = err.statusCode || 500;
  const message = config.app.env === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).render('error', {
    title: 'Error',
    message,
    statusCode,
  });
});

export default app;
