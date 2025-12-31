const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Applies to all API routes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for admin endpoints (they have their own limiter)
    return req.path.startsWith('/api/admin');
  }
});

/**
 * Auth rate limiter
 * Stricter limits for authentication routes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * OTP rate limiter
 * Prevent OTP spam
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 OTP requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Order creation rate limiter
 * Prevent order spam
 */
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 orders per hour
  message: {
    success: false,
    message: 'Too many orders created, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * API rate limiter for external API calls
 * More generous limits
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    message: 'API rate limit exceeded, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Admin rate limiter
 * Separate limits for admin operations
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin users
  message: {
    success: false,
    message: 'Too many admin requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Upload rate limiter
 * Limit file uploads
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    message: 'Too many uploads, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Search rate limiter
 * Prevent search spam
 */
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Custom rate limiter
 * Create custom rate limiter with specified options
 */
const createLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || {
      success: false,
      message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  orderLimiter,
  apiLimiter,
  adminLimiter,
  uploadLimiter,
  searchLimiter,
  createLimiter
};
