const jwt = require('jsonwebtoken');
const redisClient = require('../config/redisClient');

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
  async verifyToken(token) {
    try {
      // Check if token is blacklisted in Redis
      if (await this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  /**
   * Blacklist a token (logout) — stored in Redis with TTL matching token expiry
   * @param {String} token - JWT token to blacklist
   */
  async blacklistToken(token) {
    const decoded = jwt.decode(token);
    const ttl = decoded?.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 7 * 24 * 60 * 60;

    if (ttl > 0) {
      await redisClient.set(`bl:${token}`, '1', { EX: ttl });
    }
  },

  /**
   * Check if token is blacklisted
   * @param {String} token - JWT token
   * @returns {Boolean}
   */
  async isTokenBlacklisted(token) {
    const result = await redisClient.exists(`bl:${token}`);
    return result === 1;
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
