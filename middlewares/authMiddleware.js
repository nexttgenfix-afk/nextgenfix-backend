const User = require('../models/userModel');
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

const cognitoClient = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  cognitoClient.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

// Unified Cognito authentication middleware
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
    jwt.verify(token, getKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`
    }, async (err, decoded) => {
      if (err) {
        console.error("Cognito JWT verification error:", err);
        return res.status(401).json({ message: "Not authorized, token failed" });
      }
      // Try to find user by cognitoId
      let user = await User.findOne({ cognitoId: decoded.sub }).select('-password');
      if (!user) {
        // Try to find chef by cognitoId
        user = await Chef.findOne({ cognitoId: decoded.sub });
      }
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      req.user = user;
      req.user.role = user.role;
      next();
    });
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ message: "Server error in authentication" });
  }
};

// Admin protection middleware
exports.protectAdmin = async (req, res, next) => {
  try {
    // First use the regular protect middleware
    await exports.protect(req, res, async () => {
      // Check if the user is an admin
      if (req.user && req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({ message: "Access denied. Admin privileges required." });
      }
    });
  } catch (err) {
    console.error("Admin protection error:", err);
    res.status(500).json({ message: "Server error in admin authentication" });
  }
};

// Restaurant owner protection middleware
exports.protectRestaurant = async (req, res, next) => {
  try {
    // First use the regular protect middleware
    await exports.protect(req, res, async () => {
      // Check if the user is a restaurant owner
      if (req.user && req.user.role === 'restaurant') {
        next();
      } else {
        res.status(403).json({ message: "Access denied. Restaurant owner privileges required." });
      }
    });
  } catch (err) {
    console.error("Restaurant protection error:", err);
    res.status(500).json({ message: "Server error in restaurant authentication" });
  }
};

// Chef protection middleware
exports.protectChef = async (req, res, next) => {
  try {
    // First use the regular protect middleware
    await exports.protect(req, res, async () => {
      // Check if the user is a chef
      if (req.user && req.user.role === 'chef') {
        next();
      } else {
        res.status(403).json({ message: "Access denied. Chef privileges required." });
      }
    });
  } catch (err) {
    console.error("Chef protection error:", err);
    res.status(500).json({ message: "Server error in chef authentication" });
  }
};

// Combined middleware for admin and restaurant owners
exports.protectAdminOrRestaurant = async (req, res, next) => {
  try {
    // First use the regular protect middleware
    await exports.protect(req, res, async () => {
      // Check if the user is an admin or restaurant owner
      if (req.user && (req.user.role === 'admin' || req.user.role === 'restaurant')) {
        next();
      } else {
        res.status(403).json({ message: "Access denied. Admin or Restaurant privileges required." });
      }
    });
  } catch (err) {
    console.error("Admin/Restaurant protection error:", err);
    res.status(500).json({ message: "Server error in admin/restaurant authentication" });
  }
};

// Combined middleware for chef and restaurant owners
exports.protectChefOrRestaurant = async (req, res, next) => {
  try {
    await exports.protect(req, res, async () => {
      if (req.user && (req.user.role === 'chef' || req.user.role === 'restaurant')) {
        next();
      } else {
        res.status(403).json({ message: 'Access denied. Chef or Restaurant privileges required.' });
      }
    });
  } catch (err) {
    console.error('Chef or Restaurant protection error:', err);
    res.status(500).json({ message: 'Server error in authentication' });
  }
};

// Vendor authorization middleware (for restaurant and chef users)
exports.authorizeVendor = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === 'chef' || req.user.role === 'restaurant' || req.user.role === 'admin')) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied. Vendor privileges required.' });
    }
  } catch (err) {
    console.error('Vendor authorization error:', err);
    res.status(500).json({ message: 'Server error in authorization' });
  }
};
