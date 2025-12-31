const authService = require('../services/auth');
const User = require('../models/userModel');

/**
 * Verify JWT token and attach user to request
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization required.'
      });
    }

    // Verify token
    const decoded = authService.verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Invalid token.'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token'
    });
  }
};

/**
 * Optional auth - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    if (token) {
      const decoded = authService.verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user) {
        req.user = user;
        req.userId = user._id;
        req.isAuthenticated = true;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    console.log('Optional auth failed:', error.message);
  }

  req.isAuthenticated = req.isAuthenticated || false;
  next();
};

/**
 * Refresh token middleware
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = authService.verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = authService.generateToken(decoded.userId);

    res.json({
      success: true,
      accessToken: newAccessToken
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

module.exports = {
  verifyToken,
  optionalAuth,
  refreshToken
};
