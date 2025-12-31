const jwt = require('jsonwebtoken');

// In-memory token blacklist (in production, use Redis)
const blacklistedTokens = new Set();

module.exports = {
  /**
   * Generate JWT access token
   * @param {String} userId - User ID
   * @param {String} role - User role (optional)
   * @param {Boolean} isGuest - Whether user is guest (optional)
   * @returns {String} JWT token
   */
  generateToken(userId, role = 'user', isGuest = false) {
    const payload = {
      userId,
      role,
      isGuest,
      type: 'access'
    };
    
    const expiresIn = isGuest ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn
    });
  },

  /**
   * Generate refresh token
   * @param {String} userId - User ID
   * @returns {String} Refresh token
   */
  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh'
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });
  },

  /**
   * Verify JWT token
   * @param {String} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      // Check if token is blacklisted
      if (blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  /**
   * Blacklist a token (logout)
   * @param {String} token - JWT token to blacklist
   */
  blacklistToken(token) {
    blacklistedTokens.add(token);
    
    // Auto-remove from blacklist after token expiry (7 days default)
    setTimeout(() => {
      blacklistedTokens.delete(token);
    }, 7 * 24 * 60 * 60 * 1000);
  },

  /**
   * Check if token is blacklisted
   * @param {String} token - JWT token
   * @returns {Boolean}
   */
  isTokenBlacklisted(token) {
    return blacklistedTokens.has(token);
  },

  /**
   * Extract token from Authorization header
   * @param {String} authHeader - Authorization header
   * @returns {String|null} Token or null
   */
  extractToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
};
