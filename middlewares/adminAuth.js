const authService = require('../services/auth');
const Admin = require('../models/adminModel');
const User = require('../models/userModel');

/**
 * Verify admin JWT token
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractToken(authHeader);

    // Debugging logs
    console.debug('[verifyAdmin] incoming request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? `${authHeader.substring(0, 30)}...` : null
    });
    console.debug('[verifyAdmin] extracted token present:', !!token);

    if (!token) {
      console.warn('[verifyAdmin] no token provided');
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Verify token
    // Verify token and inspect payload for debugging
    let decoded;
    try {
      decoded = await authService.verifyToken(token);
      console.debug('[verifyAdmin] token decoded:', decoded);
    } catch (err) {
      console.warn('[verifyAdmin] token verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (decoded.role !== 'admin') {
      console.warn('[verifyAdmin] token role is not admin', { role: decoded.role, userId: decoded.userId });
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get admin from Admin collection first
    let admin = null;
    try {
      admin = await Admin.findById(decoded.userId).select('-password');
      console.debug('[verifyAdmin] looked up Admin collection result:', !!admin);
    } catch (err) {
      console.error('[verifyAdmin] error querying Admin collection:', err);
    }

    // If not found in Admin collection, fall back to User collection (some setups store admins as Users)
    if (!admin) {
      try {
        const user = await User.findById(decoded.userId).select('-password');
        console.debug('[verifyAdmin] looked up User collection result:', !!user, user ? { role: user.role, isActive: user.isActive } : null);
        if (!user || user.role !== 'admin') {
          console.warn('[verifyAdmin] user record not admin or not found', { userId: decoded.userId });
          return res.status(401).json({ success: false, message: 'Admin not found' });
        }
        // Map user to admin-like object for downstream code
        admin = user;
      } catch (err) {
        console.error('[verifyAdmin] error querying User collection:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
    }

    if (admin.isActive === false) {
      console.warn('[verifyAdmin] admin account inactive', { adminId: admin._id });
      return res.status(403).json({ success: false, message: 'Admin account is inactive' });
    }

    // Attach admin to request
    req.admin = admin;
    req.adminId = admin._id;
    req.adminRole = admin.role || 'admin';
    console.debug('[verifyAdmin] authentication successful', { adminId: req.adminId, role: req.adminRole });

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid admin token'
    });
  }
};

/**
 * Verify super admin role
 */
const verifySuperAdmin = async (req, res, next) => {
  try {
    // First verify admin
    await verifyAdmin(req, res, () => {});

    if (req.adminRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin privileges required'
      });
    }

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Verify specific permission
 */
const verifyPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
      }

      // Super admin has all permissions
      if (req.adminRole === 'super_admin') {
        return next();
      }

      // Check if admin has the required permission
      if (!req.admin.permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Permission denied. Required: ${permission}`
        });
      }

      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
  };
};

/**
 * Verify any of the specified permissions
 */
const verifyAnyPermission = (permissions = []) => {
  return async (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
      }

      // Super admin has all permissions
      if (req.adminRole === 'super_admin') {
        return next();
      }

      // Check if admin has any of the required permissions
      const hasPermission = permissions.some(perm => 
        req.admin.permissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Permission denied. Required one of: ${permissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
  };
};

module.exports = {
  verifyAdmin,
  verifySuperAdmin,
  verifyPermission,
  verifyAnyPermission
};
