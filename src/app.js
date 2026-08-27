import express from "express";
import session from "express-session";
import csrf from "csurf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/environment.js";
import logger from "./utils/logger.js";
import { ValidationError, AppError } from "./config/errors.js";
import indexRouter from "./routes/index.js";
import { checkDbHealth } from "./utils/dbHealth.js";
import { resolveSsoState } from "./services/ssoModeService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security middleware
if (config.security.helmet) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": ["'self'", "https://cdn.jsdelivr.net"],
          "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
          "font-src": ["'self'", "https://cdn.jsdelivr.net"],
        },
      },
    }),
  );
}

// Logging middleware
app.use(morgan("dev"));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: false }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Session middleware
app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.app.env === "production", // HTTPS only in production
      httpOnly: true,
      sameSite: "strict",
      maxAge: config.session.timeout,
    },
  }),
);

// CSRF protection middleware
if (config.security.csrf) {
  app.use(csrf({ cookie: false })); // Use session instead of cookie
}

// Rate limiting middleware
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static files and health checks
    return req.path === "/health" || req.path.startsWith("/public");
  },
});

if (config.rateLimit.enabled) {
  app.use(globalLimiter);
}

// CSRF token middleware - make token available to all views. Always set,
// even when CSRF protection is disabled (falls back to '') - every view
// (setup.ejs, dashboard.ejs, settings.ejs, ...) references <%= csrfToken %>
// unconditionally, so on a machine where CSRF_ENABLED was never configured
// (e.g. a fresh install with no .env.local yet) leaving this unset makes
// EJS throw "csrfToken is not defined" and 500 the whole page.
app.use((req, res, next) => {
  res.locals.csrfToken =
    config.security.csrf && req.csrfToken ? req.csrfToken() : "";
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

// Single sign-on gate.
//
// With SSO_MODE=off - the home machine, and the default - resolveSsoState()
// returns enabled:false and this middleware does NOTHING. That is the point:
// the app behaves exactly as it did before SSO existed, with no login screen
// and no auth on any route.
//
// With it enabled, an unauthenticated page load goes to /auth/login and an
// unauthenticated API call gets 401 rather than a redirect, because a fetch()
// following a 302 to an HTML login page produces a parse error somewhere far
// away from the actual cause.
app.use(async (req, res, next) => {
  let ssoState;
  try {
    ssoState = await resolveSsoState();
  } catch (error) {
    // A gate that throws must not lock the app. Failing OPEN is deliberate
    // and is the correct direction HERE, where the alternative is bricking a
    // local single-user app that had no authentication yesterday.
    logger.warn("SSO gate could not resolve state, continuing without it", {
      error: error.message,
    });
    return next();
  }

  res.locals.sso = {
    enabled: ssoState.enabled,
    reason: ssoState.reason,
    signedIn: Boolean(req.session?.ssoUser),
    displayName: req.session?.ssoUser?.displayName || null,
  };

  if (!ssoState.enabled) return next();
  if (req.session?.ssoUser) return next();

  // Paths that must stay reachable while signed out, or the gate locks its
  // own door: the sign-in flow itself, the health probe, static assets, and
  // /setup (a database that is not configured yet cannot resolve a profile).
  const openPaths = ["/auth", "/health", "/setup", "/favicon"];
  if (openPaths.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({
      success: false,
      message: "Sign-in required",
    });
  }

  return res.redirect("/auth/login");
});

// First-run database gate: page loads (not API calls) redirect to /setup
// until both a working database connection and schema exist.
app.use(async (req, res, next) => {
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/setup") ||
    req.path === "/health"
  ) {
    return next();
  }

  const health = await checkDbHealth();
  res.locals.dbHealth = health;
  if (!health.connected || !health.schemaExists) {
    return res.redirect("/setup");
  }
  next();
});

// Context database configuration gate: ensure active context has a database configured
app.use(async (req, res, next) => {
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/setup") ||
    req.path === "/health" ||
    req.path === "/settings"  // Settings page allows configuring databases
  ) {
    return next();
  }

  try {
    const activeContextService = await import("./services/activeContextService.js");
    const contextDatabaseConfigService = await import("./services/contextDatabaseConfigService.js");

    const activeContextId = await activeContextService.getActiveContextId();
    const liveConfig = await contextDatabaseConfigService.getLiveConnectionConfig(activeContextId);

    if (!liveConfig) {
      // Active context has no database configured - redirect to settings
      return res.redirect("/settings?tab=contexts&error=no-database");
    }
  } catch (error) {
    logger.warn("Error checking active context database config:", error.message);
    // Don't block on errors - let the request continue
  }

  next();
});

// Routes
app.use("/", indexRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "Not Found" });
});

// Error handling middleware (must be last)
app.use((err, req, res, _next) => {
  // Log error
  logger.error("Unhandled error:", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).render("error", {
      title: "Validation Error",
      message: err.message,
      statusCode: err.statusCode,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).render("error", {
      title: "Error",
      message: err.message,
      statusCode: err.statusCode,
    });
  }

  // CSRF token errors
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).render("error", {
      title: "CSRF Error",
      message: "CSRF validation failed",
      statusCode: 403,
    });
  }

  // Default error handler
  const statusCode = err.statusCode || 500;
  const message =
    config.app.env === "production"
      ? "An unexpected error occurred"
      : err.message;

  res.status(statusCode).render("error", {
    title: "Error",
    message,
    statusCode,
  });
});

export default app;
