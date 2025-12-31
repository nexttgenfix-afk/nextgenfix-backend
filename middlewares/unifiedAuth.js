const authService = require('../services/auth');
const User = require('../models/userModel');

/**
 * Require guest or authenticated user
 * For: Cart, coupons, addresses, bill details
 * Expects either a user token or a guest token in the Authorization header.
 * If no token is provided, returns 401 instructing the client to obtain a guest token
 * from POST /api/auth/guest or to authenticate.
 */
const requireGuestOrUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Provide a user token or a guest token from POST /api/auth/guest',
        requiresAuth: true
      });
    }

    // Verify token
    const decoded = authService.verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if guest session expired
    if (user.isGuest && user.guestExpiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Guest session expired. Please login to continue.',
        expired: true
      });
    }

    // Attach to request
    req.user = user;
    req.userId = user._id;
    req.isGuest = user.isGuest || false;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token'
    });
  }
};

/**
 * Optional auth - doesn't fail if no token
 * For: Recommendations, search (personalization if logged in)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (token) {
      const decoded = authService.verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');

      if (user) {
        // Check if guest session expired
        if (user.isGuest && user.guestExpiresAt < new Date()) {
          // Silently ignore expired guest
          return next();
        }

        req.user = user;
        req.userId = user._id;
        req.isGuest = user.isGuest || false;
      }
    }
  } catch (error) {
    // Silently fail - optional auth
  }

  next();
};

/**
 * Require authenticated (non-guest) user
 * For: Orders, profile, loyalty, checkout
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = authService.verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isGuest) {
      return res.status(403).json({
        success: false,
        message: 'Please complete registration to access this feature',
        requiresAuth: true
      });
    }

    req.user = user;
    req.userId = user._id;
    req.isGuest = false;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token'
    });
  }
};

module.exports = {
  requireGuestOrUser,
  optionalAuth,
  requireAuth
};