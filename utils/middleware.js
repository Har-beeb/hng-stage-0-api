const config = require("./config");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const User = require("../models/users");

// 1. GLOBAL REQUEST LOGGER
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${req.method}] ${req.originalUrl} | Status: ${res.statusCode} | Time: ${duration}ms`,
    );
  });

  next();
};

// 2. API VERSIONING ENFORCER
const requireApiVersion = (req, res, next) => {
  const version = req.get("x-api-version");

  if (version !== "1") {
    return res.status(400).json({
      status: "error",
      message: "API version header required",
    });
  }

  next();
};

// 3. RATE LIMITERS
const limitReachedHandler = (req, res) => {
  res.status(429).json({
    status: "error",
    message: "Too many requests",
  });
};

// Auth endpoints: 10 requests / minute
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  handler: limitReachedHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// All other endpoints: 60 requests / minute
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  handler: limitReachedHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. AUTHENTICATION & SECURITY GUARDS (STAGE 3)

const requireAuth = async (req, res, next) => {
  // Check for token in Headers (CLI) or Cookies (Web)
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res
      .status(401)
      .json({ status: "error", message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);

    // Check if user still exists and is active in the database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "User not found" });
    }
    if (!user.is_active) {
      return res
        .status(403)
        .json({ status: "error", message: "Account is disabled" });
    }

    // Attach user to the request so routes can see who is calling them
    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ status: "error", message: "Invalid or expired access token" });
  }
};

const requireAdmin = (req, res, next) => {
  // This must be used AFTER requireAuth, so req.user already exists
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({
        status: "error",
        message: "Admin access required for this action",
      });
  }
  next();
};

module.exports = {
  requestLogger,
  requireApiVersion,
  authLimiter,
  apiLimiter,
  requireAuth,
  requireAdmin,
};