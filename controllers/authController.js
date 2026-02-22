const User = require('../models/userModel');
const { generateToken, verifyToken, blacklistToken } = require('../services/auth');
const { createNotification } = require('../services/notification');
const { updateUserTier } = require('../services/tier');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Register new user
const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email or phone'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate referral code
    const referralCode = `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      referralCode
    });

    // ⭐ NEW: Check for guest token and merge data
    const guestToken = req.headers['x-guest-token'];
    let mergeMessage = null;

    if (guestToken) {
      try {
        const guestService = require('../services/guestService');
        const decoded = await verifyToken(guestToken);
        const guestUser = await User.findById(decoded.userId);

        if (guestUser && guestUser.isGuest) {
          const mergeResult = await guestService.mergeGuestToUser(user._id, guestUser._id);
          if (mergeResult.success) {
            mergeMessage = 'Your cart and saved data have been restored!';
          }
        }
      } catch (error) {
        console.error('Guest merge error:', error);
        // Don't fail registration if merge fails
      }
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: mergeMessage || 'User registered successfully',
      user: userResponse,
      token,
      dataRestored: !!mergeMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Find user (include password field for local auth comparison)
    const user = await User.findOne({
      $or: [{ email }, { phone }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ⭐ NEW: Check for guest token and merge data
    const guestToken = req.headers['x-guest-token'];
    let mergeMessage = null;

    if (guestToken) {
      try {
        const guestService = require('../services/guestService');
        const decoded = await verifyToken(guestToken);
        const guestUser = await User.findById(decoded.userId);

        if (guestUser && guestUser.isGuest) {
          const mergeResult = await guestService.mergeGuestToUser(user._id, guestUser._id);
          if (mergeResult.success) {
            mergeMessage = 'Your cart and saved data have been restored!';
          }
        }
      } catch (error) {
        console.error('Guest merge error:', error);
        // Don't fail login if merge fails
      }
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: mergeMessage || 'Login successful',
      user: userResponse,
      token,
      dataRestored: !!mergeMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify Firebase ID Token (after OTP verification on client)
const verifyOTP = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }

    // Verify Firebase ID token
    const firebaseService = require('../services/firebase');
    const tokenResult = await firebaseService.verifyIdToken(idToken);

    if (!tokenResult.success) {
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    const { uid, phone_number, email, name } = tokenResult.user;

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      // Check if user exists with phone number
      if (phone_number) {
        user = await User.findOne({ phone: phone_number });
      }

      if (!user) {
        // Generate referral code
        const referralCode = `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        user = await User.create({
          firebaseUid: uid,
          phone: phone_number,
          email: email,
          name: name || 'User',
          referralCode,
          isPhoneVerified: !!phone_number
        });
      } else {
        // Update existing user with Firebase UID
        user.firebaseUid = uid;
        user.isPhoneVerified = true;
        await user.save();
      }
    }

    // ⭐ NEW: Check for guest token and merge data
    const guestToken = req.headers['x-guest-token'];
    let mergeMessage = null;

    if (guestToken) {
      try {
        const guestService = require('../services/guestService');
        const decoded = await verifyToken(guestToken);
        const guestUser = await User.findById(decoded.userId);

        if (guestUser && guestUser.isGuest) {
          const mergeResult = await guestService.mergeGuestToUser(user._id, guestUser._id);
          if (mergeResult.success) {
            mergeMessage = 'Your cart and saved data have been restored!';
          }
        }
      } catch (error) {
        console.error('Guest merge error:', error);
        // Don't fail OTP verification if merge fails
      }
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: mergeMessage || 'OTP verified successfully',
      user: userResponse,
      token,
      dataRestored: !!mergeMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Send OTP using service
    await sendOTP(phone);

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refresh-secret-key');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Generate new access token
    const newToken = generateToken(user._id);

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      await blacklistToken(token);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_RESET_SECRET || 'reset-secret-key',
      { expiresIn: '15m' }
    );

    // Send reset email
    await sendEmail({
      to: email,
      subject: 'Password Reset',
      html: `Click here to reset your password: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET || 'reset-secret-key');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Invalid reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired reset token' });
  }
};

// Verify Firebase token
const verifyFirebaseToken = async (req, res) => {
  try {
    const { idToken } = req.body;

    // This would integrate with Firebase Admin SDK
    // For now, return mock response
    res.json({ message: 'Firebase token verified (mock implementation)' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create guest token and guest user
const createGuest = async (req, res) => {
  try {
    const guestService = require('../services/guestService');
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    let deviceType = 'Unknown';

    if (ua.includes('android') || ua.includes('okhttp')) deviceType = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) deviceType = 'iOS';
    else if (ua.includes('postman') || ua.includes('mozilla') || ua.includes('curl') || ua.includes('http')) deviceType = 'Web';

    const { user, token } = await guestService.createGuestUser({ deviceType });

    // respond with token and guestId for frontend to store and use in Authorization header
    return res.status(201).json({
      message: 'Guest session created',
      token,
      guestId: user.guestId,
      user: { id: user._id, guestId: user.guestId }
    });
  } catch (err) {
    console.error('Error creating guest:', err);
    return res.status(500).json({ message: 'Failed to create guest session' });
  }
};

const Cart = require('../models/cartModel');
const { verifyIdToken } = require('../services/firebase');

/**
 * Generate unique referral code for user
 */
const generateReferralCode = () => {
  return 'REF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
};

/**
 * Phone Authentication via Firebase
 * Client sends Firebase ID Token after OTP verification
 * 
 * POST /api/auth/phone/login
 * Body: { idToken, guestId (optional) }
 */
exports.phoneLogin = async (req, res) => {
  try {
    const { idToken, guestId } = req.body;

    // Validate request
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID Token is required'
      });
    }

    // 1. Verify Firebase ID Token
    const firebaseResult = await verifyIdToken(idToken);
    
    if (!firebaseResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Firebase token',
        error: firebaseResult.error
      });
    }

    const { uid, phone, name, picture } = firebaseResult;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not found in Firebase token'
      });
    }

    // 2. Check if user exists
    let user = await User.findOne({ 
      $or: [
        { firebaseUid: uid },
        { phone: phone }
      ]
    });

    // 3. Create new user if doesn't exist
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        phone: phone,
        phoneVerified: true,
        name: name || `User${phone.slice(-4)}`,
        profilePicture: picture,
        authProvider: 'phone',
        isGuest: false,
        referralCode: generateReferralCode()
      });

      console.log('✅ New user created:', user._id);
    } else {
      // Update existing user info
      user.firebaseUid = uid;
      user.phoneVerified = true;
      user.isGuest = false;
      if (name) user.name = name;
      if (picture) user.profilePicture = picture;
      if (!user.referralCode) user.referralCode = generateReferralCode();
      user.lastActive = new Date();
      await user.save();

      console.log('✅ Existing user logged in:', user._id);
    }

    // 4. Migrate guest cart if provided
    if (guestId) {
      const migrationResult = await Cart.updateMany(
        { userId: guestId },
        { userId: user._id }
      );
      console.log(`📦 Migrated ${migrationResult.modifiedCount} cart(s) from guest`);
    }

    // 5. Generate JWT
    const jwtToken = generateToken(user._id, 'user');

    // 6. Return response
    res.status(200).json({
      success: true,
      message: 'Phone login successful',
      token: jwtToken,
      user: {
        id: user._id,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        tier: user.tier,
        referralCode: user.referralCode,
        authProvider: user.authProvider,
        isGuest: user.isGuest
      }
    });

  } catch (error) {
    console.error('Phone login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

/**
 * Google Authentication via Firebase
 * Client sends Firebase ID Token after Google Sign-In
 * 
 * POST /api/auth/google/login
 * Body: { idToken, guestId (optional) }
 */
exports.googleLogin = async (req, res) => {
  try {
    const { idToken, guestId } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID Token is required'
      });
    }

    // 1. Verify Firebase ID Token
    const firebaseResult = await verifyIdToken(idToken);
    
    if (!firebaseResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
        error: firebaseResult.error
      });
    }

    const { uid, email, name, picture } = firebaseResult;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email not found in Google token'
      });
    }

    // 2. Check if user exists
    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        { email: email }
      ]
    });

    // 3. Create or update user
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email: email,
        name: name || email.split('@')[0],
        profilePicture: picture,
        authProvider: 'google',
        isGuest: false,
        referralCode: generateReferralCode()
      });

      console.log('✅ New Google user created:', user._id);
    } else {
      user.firebaseUid = uid;
      user.email = email;
      user.isGuest = false;
      if (name) user.name = name;
      if (picture) user.profilePicture = picture;
      if (!user.referralCode) user.referralCode = generateReferralCode();
      user.lastActive = new Date();
      await user.save();

      console.log('✅ Existing Google user logged in:', user._id);
    }

    // 4. Migrate guest cart
    if (guestId) {
      const migrationResult = await Cart.updateMany(
        { userId: guestId },
        { userId: user._id }
      );
      console.log(`📦 Migrated ${migrationResult.modifiedCount} cart(s) from guest`);
    }

    // 5. Generate JWT
    const jwtToken = generateToken(user._id, 'user');

    // 6. Return response
    res.status(200).json({
      success: true,
      message: 'Google login successful',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        tier: user.tier,
        referralCode: user.referralCode,
        authProvider: user.authProvider,
        isGuest: user.isGuest
      }
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Google login failed',
      error: error.message
    });
  }
};

/**
 * Apple Authentication via Firebase
 * Client sends Firebase ID Token after Apple Sign-In
 * 
 * POST /api/auth/apple/login
 * Body: { idToken, guestId (optional) }
 */
exports.appleLogin = async (req, res) => {
  try {
    const { idToken, guestId } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID Token is required'
      });
    }

    // 1. Verify Firebase ID Token
    const firebaseResult = await verifyIdToken(idToken);
    
    if (!firebaseResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Apple token',
        error: firebaseResult.error
      });
    }

    const { uid, email, name } = firebaseResult;

    // Note: Apple may not provide email if user chooses to hide it
    // In that case, we use UID as unique identifier

    // 2. Check if user exists
    let user = await User.findOne({
      $or: [
        { firebaseUid: uid },
        ...(email ? [{ email: email }] : [])
      ]
    });

    // 3. Create or update user
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email: email || null,
        name: name || 'Apple User',
        authProvider: 'apple',
        isGuest: false,
        referralCode: generateReferralCode()
      });

      console.log('✅ New Apple user created:', user._id);
    } else {
      user.firebaseUid = uid;
      user.isGuest = false;
      if (name) user.name = name;
      if (email) user.email = email;
      if (!user.referralCode) user.referralCode = generateReferralCode();
      user.lastActive = new Date();
      await user.save();

      console.log('✅ Existing Apple user logged in:', user._id);
    }

    // 4. Migrate guest cart
    if (guestId) {
      const migrationResult = await Cart.updateMany(
        { userId: guestId },
        { userId: user._id }
      );
      console.log(`📦 Migrated ${migrationResult.modifiedCount} cart(s) from guest`);
    }

    // 5. Generate JWT
    const jwtToken = generateToken(user._id, 'user');

    // 6. Return response
    res.status(200).json({
      success: true,
      message: 'Apple login successful',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        referralCode: user.referralCode,
        authProvider: user.authProvider,
        isGuest: user.isGuest
      }
    });

  } catch (error) {
    console.error('Apple login error:', error);
    res.status(500).json({
      success: false,
      message: 'Apple login failed',
      error: error.message
    });
  }
};


/**
 * Refresh JWT Token
 * Generate new token before expiry
 * 
 * POST /api/auth/refresh
 * Requires: Valid JWT in Authorization header
 */
exports.refreshToken = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user still exists and is active
    const user = await User.findById(userId);
    
    if (!user || user.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new token
    const newToken = generateToken(user._id, user.isGuest ? 'guest' : 'user');

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
};

/**
 * Logout
 * Client should delete token
 * Optional: Add token to blacklist
 * 
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    // Optional: Add token to blacklist in Redis
    // await blacklistToken(req.token);

    // Update last active
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, {
        lastActive: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};

/**
 * Verify Token Status
 * Check if current token is valid
 * 
 * GET /api/auth/verify
 */
exports.verifyToken = async (req, res) => {
  try {
    // If middleware passed, token is valid
    const user = await User.findById(req.user.id).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isGuest: user.isGuest,
        tier: user.tier,
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};

/**
 * Send WhatsApp OTP via MSG91
 *
 * POST /api/auth/whatsapp/send-otp
 * Body: { phone }
 */
const sendWhatsappOtp = async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Sanitize: strip leading '+' and whitespace
    phone = phone.replace(/^\+/, '').replace(/\s+/g, '');

    // Validate: digits only, minimum 10 chars
    if (!/^\d{10,}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone must be digits only and at least 10 characters'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis with 5-minute TTL
    const redisClient = require('../config/redisClient');
    await redisClient.set('wa_otp:' + phone, otp, { EX: 300 });

    // Send via MSG91
    const msg91Service = require('../services/msg91');
    await msg91Service.sendWhatsappOtp(phone, otp);

    return res.status(200).json({ success: true, message: 'OTP sent via WhatsApp' });
  } catch (error) {
    console.error('sendWhatsappOtp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

/**
 * Verify WhatsApp OTP and issue JWT
 *
 * POST /api/auth/whatsapp/verify-otp
 * Body: { phone, otp }
 */
const verifyWhatsappOtp = async (req, res) => {
  try {
    let { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    // Sanitize phone
    phone = phone.replace(/^\+/, '').replace(/\s+/g, '');

    const redisClient = require('../config/redisClient');
    const storedOtp = await redisClient.get('wa_otp:' + phone);

    if (!storedOtp) {
      return res.status(400).json({ success: false, message: 'OTP expired or not requested' });
    }

    if (storedOtp !== otp.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Single-use: delete from Redis
    await redisClient.del('wa_otp:' + phone);

    // Find or create user
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone,
        phoneVerified: true,
        name: `User${phone.slice(-4)}`,
        authProvider: 'whatsapp',
        isGuest: false,
        referralCode: generateReferralCode()
      });
      console.log('✅ New WhatsApp user created:', user._id);
    } else {
      user.phoneVerified = true;
      user.lastActive = new Date();
      await user.save();
      console.log('✅ Existing WhatsApp user logged in:', user._id);
    }

    const token = generateToken(user._id, 'user');

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        name: user.name,
        tier: user.tier,
        referralCode: user.referralCode,
        authProvider: user.authProvider,
        isGuest: user.isGuest
      }
    });
  } catch (error) {
    console.error('verifyWhatsappOtp error:', error);
    return res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// Export all controller handlers from a single object to avoid mixing
// `module.exports = {}` and `exports.foo = ...` which breaks the exports link.
module.exports = {
  register,
  login,
  verifyOTP,
  resendOTP,
  createGuest,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyFirebaseToken,
  sendWhatsappOtp,
  verifyWhatsappOtp,
  // Explicitly include the later-defined handlers
  phoneLogin: exports.phoneLogin,
  googleLogin: exports.googleLogin,
  appleLogin: exports.appleLogin
};
