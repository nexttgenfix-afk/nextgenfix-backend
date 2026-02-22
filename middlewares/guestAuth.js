const authService = require('../services/auth');
const User = require('../models/userModel');

/**
 * Verify guest or authenticated user
 * Allows both guest users and authenticated users
 */
const verifyGuestOrUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token required (guest or authenticated user)'
      });
    }

    // Verify token
    const decoded = await authService.verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Attach user to request
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
 * Require guest user only
 */
const requireGuest = async (req, res, next) => {
  try {
    // First verify the token
    await verifyGuestOrUser(req, res, () => {});

    if (!req.isGuest) {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is for guest users only'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Require authenticated (non-guest) user
 */
const requireAuth = async (req, res, next) => {
  try {
    // First verify the token
    await verifyGuestOrUser(req, res, () => {});

    if (req.isGuest) {
      return res.status(403).json({
        success: false,
        message: 'Please complete registration to access this feature'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Convert guest to authenticated user helper
 * Used when guest provides phone/email for the first time
 */
const convertGuestToUser = async (req, res, next) => {
  try {
    if (!req.user || !req.isGuest) {
      return next();
    }

    // Check if phone or email is being provided
    if (req.body.phone || req.body.email) {
      req.user.isGuest = false;
      req.user.authProvider = req.body.authProvider || 'phone';
      await req.user.save();
      
      req.isGuest = false;
    }

    next();
  } catch (error) {
    console.error('Convert guest to user error:', error);
    next(); // Don't fail the request
  }
};

module.exports = {
  verifyGuestOrUser,
  requireGuest,
  requireAuth,
  convertGuestToUser
};
