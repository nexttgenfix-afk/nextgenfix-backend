const User = require('../models/userModel');
const Settings = require('../models/settingsModel');
const { Location } = require('../models/locationModel');
const { generateToken, blacklistToken } = require('../services/auth');
const { sendEmail } = require('../services/email');
const { createNotification } = require('../services/notification');
const { calculateTier, updateUserTier } = require('../services/tier');
const bcrypt = require('bcryptjs');

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Note: updateProfile implementation is defined later as an exported function
// to avoid duplicate export issues. See `exports.updateProfile` further below.

// Update user preferences
const updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferences },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Preferences updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user tier information
const getTierInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('tier tierProgress totalSpent');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

  // Settings model exposes a static getSettings() helper
  const settings = await Settings.getSettings();
  // tierConfig is stored as an object with keys for each tier
  const tierInfo = settings.tierConfig ? settings.tierConfig[user.tier] : null;

    res.json({
      currentTier: user.tier,
      progress: user.tierProgress,
      totalSpent: user.totalSpent,
      nextTier: tierInfo?.nextTier,
      benefits: tierInfo?.benefits
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's referral code
const getReferralCode = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('referralCode');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ referralCode: user.referralCode });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Apply referral code
const applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ message: 'Referral code is required' });
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({ message: 'Invalid referral code' });
    }

    if (referrer._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'Cannot use your own referral code' });
    }

    const user = await User.findById(req.user.id);
    if (user.referredBy) {
      return res.status(400).json({ message: 'Referral code already applied' });
    }

    // Apply referral
    user.referredBy = referrer._id;

    // Load referral settings
    const settings = await Settings.getSettings();
    const cfg = settings.referralConfig || {};

    // Respect maxReferrals if configured (default to 5)
    const maxReferrals = cfg.maxReferrals || 5;
    if ((referrer.referralCount || 0) >= maxReferrals) {
      return res.status(400).json({ message: 'Referrer has reached the maximum allowed referrals' });
    }

    // Create referral coupons for both parties (use Coupon model)
    const Coupon = require('../models/couponModel');
    const now = new Date();
    const validityDays = cfg.validityDays || 30;
    const validUntil = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const referrerReward = cfg.referrerReward || 0;
    const refereeReward = cfg.refereeReward || 0;

    // Helper to generate a short coupon code
    const shortid = require('shortid');
    function genCode(prefix = 'R') {
      return (prefix + shortid.generate()).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    }

    // Create referee coupon (for the new user)
    let refereeCoupon = null;
    if (refereeReward > 0) {
      const refereeCode = genCode('RF');
      refereeCoupon = new Coupon({
        code: refereeCode,
        discountValue: refereeReward,
        discountType: 'fixed',
        minOrderValue: cfg.minOrderAmount || 0,
        validFrom: now,
        validUntil,
        isActive: true,
        createdBy: req.user.id,
        createdByType: 'Admin',
        meta: { origin: 'referral', originType: 'referee' }
      });
      await refereeCoupon.save();
      // attach to user
      user.referralCoupons = user.referralCoupons || [];
      user.referralCoupons.push(refereeCoupon._id);
    }

    // Create referrer coupon (for the person who referred)
    let referrerCoupon = null;
    if (referrerReward > 0) {
      const referrerCode = genCode('RR');
      referrerCoupon = new Coupon({
        code: referrerCode,
        discountValue: referrerReward,
        discountType: 'fixed',
        minOrderValue: cfg.minOrderAmount || 0,
        validFrom: now,
        validUntil,
        isActive: true,
        createdBy: req.user.id,
        createdByType: 'Admin',
        meta: { origin: 'referral', originType: 'referrer' }
      });
      await referrerCoupon.save();
      // attach to referrer
      referrer.referralCoupons = referrer.referralCoupons || [];
      referrer.referralCoupons.push(referrerCoupon._id);
    }

    // Persist referral relationship and counts
    referrer.referralCount = (referrer.referralCount || 0) + 1;
    referrer.referrals = referrer.referrals || [];
    referrer.referrals.push({ user: user._id, dateReferred: new Date(), rewardClaimed: false });

    await Promise.all([user.save(), referrer.save()]);

    // Create notification for referrer
    await createNotification({
      userId: referrer._id,
      title: 'New Referral',
      message: `${user.name || user.phone || 'A user'} joined using your referral code!`,
      type: 'referral'
    });

    res.json({
      message: 'Referral code applied successfully',
      refereeCoupon: refereeCoupon ? { id: refereeCoupon._id, code: refereeCoupon.code } : null,
      referrerCoupon: referrerCoupon ? { id: referrerCoupon._id, code: referrerCoupon.code } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's referrals
const getReferrals = async (req, res) => {
  try {
    const referrals = await User.find({ referredBy: req.user.id })
      .select('name email phone createdAt')
      .sort({ createdAt: -1 });

    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const { notificationPreferences } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { notificationPreferences },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Notification preferences updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Get all users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;

    // Log admin action for auditing/debugging
    const actorId = req.admin ? req.admin._id : (req.user ? req.user.id : 'unknown');
    const actorEmail = req.admin ? req.admin.email : (req.user ? req.user.email : 'unknown');
    console.log(`[GetAllUsers] time=${new Date().toISOString()} actorId=${actorId} actorEmail=${actorEmail} ip=${req.ip || req.connection?.remoteAddress || 'unknown'} query=${JSON.stringify(req.query)}`);

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.status = status;
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Get user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Update user
const updateUser = async (req, res) => {
  try {
    const { name, email, phone, status, tier } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, status, tier },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin: Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Post a review for chef or restaurant
exports.postReview = async (req, res) => {
  try {
    const { targetType, target, rating, comment } = req.body;
    if (!targetType || !target || !rating || !comment) {
      return res.status(400).json({ message: 'targetType, target, rating, and comment are required' });
    }
    if (!['Chef', 'Restaurant'].includes(targetType)) {
      return res.status(400).json({ message: 'targetType must be Chef or Restaurant' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    const review = await Review.create({
      reviewer: req.user.id,
      targetType,
      target,
      rating,
      comment
    });
    res.status(201).json({ message: 'Review submitted', review });
  } catch (err) {
    console.error('Post review error:', err);
    res.status(500).json({ message: 'Failed to submit review' });
  }
};
// Get reviews for a chef or restaurant
exports.getReviews = async (req, res) => {
  try {
    const { targetType, target, page = 1, limit = 10 } = req.query;
    if (!targetType || !target) {
      return res.status(400).json({ message: 'targetType and target are required' });
    }
    if (!['Chef', 'Restaurant'].includes(targetType)) {
      return res.status(400).json({ message: 'targetType must be Chef or Restaurant' });
    }
    const query = { targetType, target, status: 'Approved' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reviewer', 'name email');
    const total = await Review.countDocuments(query);
    res.status(200).json({ reviews, total });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};



// Helper function for geocoding
async function geocodeAddress(flatNumber, address, city, state, pincode) {
  try {
    const formattedAddress = encodeURIComponent(`${flatNumber}, ${address}, ${city}, ${state}, ${pincode}, India`);
    
    // Using OpenStreetMap/Nominatim API for geocoding (free, no API key needed)
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${formattedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'NextGenFix-App/1.0' // Required by Nominatim policy
        }
      }
    );
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return [
        parseFloat(result.lon), // longitude first in GeoJSON format
        parseFloat(result.lat)  // latitude second
      ];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await redis.setEx(`otp:${phone}`, 300, otp); // store OTP for 5 mins

  try {
    await client.messages.create({
      body: `Your OTP code is ${otp}`,
      from: twilioPhoneNumber,
      to: phone
    });
    console.log(`OTP sent to ${phone}`);
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ message: "Failed to send OTP" });
  }

  res.status(200).json({ message: "OTP sent" });
};


exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ message: "Phone and OTP required" });

  // For testing: Just check if the OTP is 6 digits
  if (!/^\d{6}$/.test(otp)) {
    return res.status(401).json({ message: "Invalid OTP format. Must be 6 digits." });
  }
  
  // Comment out Redis verification for testing
  // const storedOtp = await redis.get(`otp:${phone}`);
  // console.log(storedOtp);
  // if (!storedOtp || storedOtp !== otp) {
  //   return res.status(401).json({ message: "Invalid or expired OTP" });
  // }

  let user = await User.findOne({ phone });

  if (!user) {
    // Create a minimal user with just phone
    user = await User.create({
      phone,
      name: "",
    });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  console.log(token);
  
  // Comment out Redis deletion for testing
  // await redis.del(`otp:${phone}`);

  // Always return token to authenticated user
  return res.status(200).json({
    message: "Login successful",
    token,
    user,
    isProfileComplete:"false"
  });
};

// New function to verify Firebase token
exports.verifyFirebaseToken = async (req, res) => {
  try {
    const { idToken } = req.body;
    console.log('[verifyFirebaseToken] Received idToken:', idToken);
    if (!idToken) {
      console.warn('[verifyFirebaseToken] No idToken provided');
      return res.status(400).json({ message: "Firebase ID token is required" });
    }
    // Verify the ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('[verifyFirebaseToken] Decoded token:', decodedToken);
    } catch (verifyErr) {
      console.error('[verifyFirebaseToken] Error decoding token:', verifyErr);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const phoneNumber = decodedToken.phone_number;
    console.log('[verifyFirebaseToken] Extracted phoneNumber:', phoneNumber);
    if (!phoneNumber) {
      console.warn('[verifyFirebaseToken] Phone number not found in token');
      return res.status(400).json({ message: "Phone number not found in token" });
    }
    // Find or create user
    let user = await User.findOne({ phone: phoneNumber });
    if (!user) {
      console.log('[verifyFirebaseToken] No user found, creating new user for phone:', phoneNumber);
      user = await User.create({
        phone: phoneNumber,
        name: "",
        email: ""
      });
      console.log('[verifyFirebaseToken] New user created:', user);
    } else {
      console.log('[verifyFirebaseToken] Existing user found:', user);
    }
    // Generate JWT for our app authentication
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );
    console.log('[verifyFirebaseToken] JWT generated:', token);
    return res.status(200).json({
      message: "Login successful",
      token,
      user,
      isProfileComplete: !!(user.name && user.dietPreference && user.eatingPreference)
    });
  } catch (error) {
    console.error('[verifyFirebaseToken] Error verifying Firebase token:', error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.user && req.user.id ? req.user.id : (req.userId || null);
  const { name, email, gender, birthDate } = req.body;

  // Required fields as per UI: name, email, gender, birthDate
  if (!name || !email || !gender || !birthDate) {
    return res.status(400).json({ message: 'name, email, gender and birthDate are required' });
  }

  try {
    const update = { name, email, gender, birthDate };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if user has completed their profile
    const isProfileComplete = Boolean(
      user.name && 
      user.dietPreference && 
      user.eatingPreference
    );

    res.status(200).json({
      message: "User profile fetched successfully",
      user,
      isProfileComplete
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};



exports.addLocation = async (req, res) => {
  const userId = req.userId;
  const {
    placeId,
    formattedAddress,
    addressComponents,
    label,
    saveAs,
    flatNumber,
    landmark,
    deliveryInstructions,
    coordinates,
    isDefault = false
  } = req.body;

  // Validate required fields
  if (!flatNumber || !coordinates) {
    return res.status(400).json({ 
      message: "Required fields missing: flatNumber and coordinates are required" 
    });
  }

  // Validate coordinates
  if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
      typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
    return res.status(400).json({ 
      message: "Valid coordinates are required as an array [longitude, latitude]" 
    });
  }

  try {
    // Check if user has any locations
    const locationCount = await Location.countDocuments({ user: userId });
    
    // If no locations or isDefault is true, set this as default
    const shouldBeDefault = isDefault || locationCount === 0;
    
    // If setting as default, unset any existing default location
    if (shouldBeDefault) {
      await Location.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false }
      );
    }

    // Create the location object
    const locationData = { 
      user: userId, 
      flatNumber,
      coordinates: {
        type: "Point",
        coordinates: coordinates
      },
      isDefault: shouldBeDefault
    };
    
    // Add optional Google Maps fields
    if (placeId) locationData.placeId = placeId;
    if (formattedAddress) locationData.formattedAddress = formattedAddress;
    if (addressComponents) locationData.addressComponents = addressComponents;
    
    // Add optional user fields
    if (label) locationData.label = label;
    if (saveAs) locationData.saveAs = saveAs;
    if (landmark) locationData.landmark = landmark;
    if (deliveryInstructions) locationData.deliveryInstructions = deliveryInstructions;
    
    // Create the location
    const newLocation = await Location.create(locationData);

    // Add location to user's locations array
    await User.findByIdAndUpdate(userId, {
      $push: { locations: newLocation._id }
    });

    res.status(201).json({ 
      message: req.isGuest 
        ? "Location saved temporarily. Login to save it permanently." 
        : "Location added successfully", 
      location: newLocation,
      isGuest: req.isGuest
    });
  } catch (err) {
    console.error("Add location error:", err);
    res.status(500).json({ message: "Failed to add location" });
  }
};

// Backward compatibility - keep addAddress as alias
exports.addAddress = exports.addLocation;


exports.getLocations = async (req, res) => {
  const userId = req.userId;

  try {
    const locations = await Location.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json({ 
      locations,
      isGuest: req.isGuest
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch locations" });
  }
};

// Backward compatibility
exports.getAddresses = exports.getLocations;

// Save hunger level / mood answers for user or guest
exports.saveQuestion = async (req, res) => {
  try {
    const User = require('../models/userModel');
    const userId = req.userId || null;
    const guestId = req.guestId || null;
    const { hungerLevel, mood } = req.body;

    if (!hungerLevel || !mood) {
      return res.status(400).json({ message: 'hungerLevel and mood are required' });
    }

    // Determine which user document to update: prefer authenticated/guest-token userId
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (guestId) {
      user = await User.findOne({ guestId });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found. Create a guest session first.' });
    }

    // Update single canonical answers on the user document
    user.questionAnswers = {
      hungerLevel,
      mood,
      updatedAt: new Date()
    };

    await user.save();

    res.status(200).json({ message: 'Answer saved', questionAnswers: user.questionAnswers });
  } catch (err) {
    console.error('saveQuestion error:', err);
    res.status(500).json({ message: 'Failed to save answer' });
  }
};

// Get recent hunger/mood answers for the current user/guest
exports.getQuestions = async (req, res) => {
  try {
    const User = require('../models/userModel');
    const userId = req.userId || null;
    const guestId = req.guestId || null;

    // Return the single canonical latest answers stored on the user document
    let user = null;
    if (userId) user = await User.findById(userId).select('questionAnswers');
    else if (guestId) user = await User.findOne({ guestId }).select('questionAnswers');
    else return res.status(400).json({ message: 'No user or guest identified' });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ questionAnswers: user.questionAnswers || null });
  } catch (err) {
    console.error('getQuestions error:', err);
    res.status(500).json({ message: 'Failed to fetch answers' });
  }
};

exports.getDefaultLocation = async (req, res) => {
  const userId = req.userId;
  
  try {
    const defaultLocation = await Location.findOne({ 
      user: userId, 
      isDefault: true 
    });
    
    if (!defaultLocation) {
      return res.status(404).json({ message: "No default location found" });
    }
    
    res.status(200).json({ location: defaultLocation });
  } catch (err) {
    console.error("Get default location error:", err);
    res.status(500).json({ message: "Failed to fetch default location" });
  }
};

// Backward compatibility
exports.getDefaultAddress = exports.getDefaultLocation;

// Set a location as default
exports.setDefaultLocation = async (req, res) => {
  const userId = req.userId;
  const { locationId } = req.params;
  
  try {
    // First, unset any existing default location
    await Location.updateMany(
      { user: userId, isDefault: true },
      { isDefault: false }
    );
    
    // Then set the specified location as default
    const location = await Location.findOneAndUpdate(
      { _id: locationId, user: userId },
      { isDefault: true },
      { new: true }
    );
    
    if (!location) {
      return res.status(404).json({ message: "Location not found or unauthorized" });
    }
    
    res.status(200).json({
      message: "Default location set successfully",
      location
    });
  } catch (err) {
    console.error("Set default location error:", err);
    res.status(500).json({ message: "Failed to set default location" });
  }
};

// Backward compatibility
exports.setDefaultAddress = exports.setDefaultLocation;

exports.editLocation = async (req, res) => {
  const userId = req.userId;
  const { locationId } = req.params;
  const { 
    placeId,
    formattedAddress,
    addressComponents,
    label,
    saveAs,
    flatNumber, 
    landmark, 
    deliveryInstructions,
    coordinates,
    isDefault
  } = req.body;

  try {
    // Build the update object
    const updateData = {};
    if (placeId !== undefined) updateData.placeId = placeId;
    if (formattedAddress !== undefined) updateData.formattedAddress = formattedAddress;
    if (addressComponents !== undefined) updateData.addressComponents = addressComponents;
    if (label !== undefined) updateData.label = label;
    if (saveAs !== undefined) updateData.saveAs = saveAs;
    if (flatNumber) updateData.flatNumber = flatNumber;
    if (landmark !== undefined) updateData.landmark = landmark;
    if (deliveryInstructions !== undefined) updateData.deliveryInstructions = deliveryInstructions;
    
    // Update coordinates if provided
    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2 &&
        typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      updateData.coordinates = {
        type: "Point",
        coordinates: coordinates
      };
    }
    
    // Handle default location change if requested
    if (isDefault === true) {
      // Unset any existing default location
      await Location.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false }
      );
      updateData.isDefault = true;
    }

    // Update the location
    const updatedLocation = await Location.findOneAndUpdate(
      { _id: locationId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedLocation) {
      return res.status(404).json({ message: "Location not found or unauthorized" });
    }

    res.status(200).json({
      message: "Location updated successfully",
      location: updatedLocation
    });
  } catch (err) {
    console.error("Edit location error:", err);
    res.status(500).json({ message: "Failed to update location" });
  }
};

// Backward compatibility
exports.editAddress = exports.editLocation;


exports.deleteLocation = async (req, res) => {
  const userId = req.userId;
  const { locationId } = req.params;

  try {
    // Find and delete the location document
    const deletedLocation = await Location.findOneAndDelete({
      _id: locationId,
      user: userId
    });

    if (!deletedLocation) {
      return res.status(404).json({ message: "Location not found or unauthorized" });
    }

    // Also remove the reference from the user's locations array
    await User.findByIdAndUpdate(userId, {
      $pull: { locations: locationId }
    });

    res.status(200).json({
      message: "Location deleted successfully",
      locationId
    });
  } catch (err) {
    console.error("Delete location error:", err);
    res.status(500).json({ message: "Failed to delete location" });
  }
};

// Backward compatibility
exports.deleteAddress = exports.deleteLocation;


exports.getUserPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('dietPreference eatingPreference');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User preferences fetched successfully",
      preferences: {
        dietPreference: user.dietPreference,        // 'veg' or 'non-veg'
        eatingPreference: user.eatingPreference     // 'pure-veg-only' or 'veg-from-anywhere'
      }
    });
  } catch (err) {
    console.error("Error fetching user preferences:", err);
    res.status(500).json({ message: "Failed to fetch user preferences" });
  }
};

// Add this new controller function
exports.editProfile = (req, res) => {
  // Use multer middleware to handle file upload
  uploadProfilePicture(req, res, async function(err) {
    if (err) {
      return res.status(400).json({ 
        message: "Error uploading image", 
        error: err.message 
      });
    }
    
    const userId = req.user.id;
    const { 
      name, 
      email, 
      dietPreference, 
      eatingPreference,
      notificationPreferences 
    } = req.body;
    
    try {
      // Build the update object with profile fields
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (dietPreference) updateData.dietPreference = dietPreference;
      if (eatingPreference) updateData.eatingPreference = eatingPreference;
      
      // Handle notification preferences if provided
      if (notificationPreferences) {
        updateData.notificationPreferences = {};
        if (notificationPreferences.orderUpdates !== undefined) {
          updateData.notificationPreferences.orderUpdates = notificationPreferences.orderUpdates;
        }
        if (notificationPreferences.promotions !== undefined) {
          updateData.notificationPreferences.promotions = notificationPreferences.promotions;
        }
        if (notificationPreferences.newItems !== undefined) {
          updateData.notificationPreferences.newItems = notificationPreferences.newItems;
        }
      }
      
      // If a file was uploaded, add the profilePicture field
      if (req.file) {
        updateData.profilePicture = req.file.path;
      }
      
      // Only update if there's something to update
      if (Object.keys(updateData).length === 0 && !req.file) {
        return res.status(400).json({ message: "No update data provided" });
      }
      
      // Update the user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select("-password");
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({
        message: "Profile edited successfully",
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          phone: updatedUser.phone,
          email: updatedUser.email,
          profilePicture: updatedUser.profilePicture,
          dietPreference: updatedUser.dietPreference,
          eatingPreference: updatedUser.eatingPreference,
          notificationPreferences: updatedUser.notificationPreferences
        }
      });
    } catch (err) {
      console.error("Profile edit error:", err);
      res.status(500).json({ message: "Failed to edit profile" });
    }
  });
};

// Add this new controller function for notification preferences
exports.updateNotificationPreferences = async (req, res) => {
  const userId = req.user.id;
  const { orderUpdates, promotions, newItems } = req.body;
  
  try {
    const updateData = { notificationPreferences: {} };
    
    if (orderUpdates !== undefined) {
      updateData.notificationPreferences.orderUpdates = orderUpdates;
    }
    if (promotions !== undefined) {
      updateData.notificationPreferences.promotions = promotions;
    }
    if (newItems !== undefined) {
      updateData.notificationPreferences.newItems = newItems;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({
      message: "Notification preferences updated successfully",
      notificationPreferences: updatedUser.notificationPreferences
    });
  } catch (err) {
    console.error("Update notification preferences error:", err);
    res.status(500).json({ message: "Failed to update notification preferences" });
  }
};

// Add this new controller function to get notification preferences
exports.getNotificationPreferences = async (req, res) => {
  const userId = req.user.id;
  
  try {
    const user = await User.findById(userId).select('notificationPreferences');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({
      notificationPreferences: user.notificationPreferences
    });
  } catch (err) {
    console.error("Get notification preferences error:", err);
    res.status(500).json({ message: "Failed to get notification preferences" });
  }
};

// Get user's nano points balance and history
exports.getNanoPoints = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId)
      .select('nanoPoints nanoPointsHistory')
      .populate({
        path: 'nanoPointsHistory.orderId',
        select: 'billing.totalAmount createdAt'
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      nanoPoints: user.nanoPoints,
      pointsHistory: user.nanoPointsHistory
    });
  } catch (err) {
    console.error("Get nano points error:", err);
    res.status(500).json({ message: "Failed to fetch nano points" });
  }
};

// Add bonus nano points to user (admin only)
exports.addBonusNanoPoints = async (req, res) => {
  const { userId, points, description } = req.body;
  
  if (!userId || !points || points <= 0) {
    return res.status(400).json({ message: "User ID and points (>0) are required" });
  }

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add points to user's balance
    user.nanoPoints += points;
    
    // Add to history
    user.nanoPointsHistory.push({
      points,
      type: 'bonus',
      description: description || 'Bonus nano points'
    });
    
    await user.save();

    res.status(200).json({ 
      message: "Bonus points added successfully",
      userId,
      pointsAdded: points,
      newBalance: user.nanoPoints
    });
  } catch (err) {
    console.error("Add bonus points error:", err);
    res.status(500).json({ message: "Failed to add bonus points" });
  }
};

// Consolidate and export all controller functions from one place.
// Merge any properties assigned to `exports` with local named functions.
module.exports = Object.assign({}, exports, {
  // prefer functions attached to exports (later definitions) but
  // fall back to local named functions when not present
  getProfile: exports.getProfile || getProfile,
  updateProfile: exports.updateProfile,
  updatePreferences: exports.updatePreferences || updatePreferences,
  getTierInfo: exports.getTierInfo || getTierInfo,
  getReferralCode: exports.getReferralCode || getReferralCode,
  applyReferralCode: exports.applyReferralCode || applyReferralCode,
  getReferrals: exports.getReferrals || getReferrals,
  updateNotificationPreferences: exports.updateNotificationPreferences || updateNotificationPreferences,
  getAllUsers: exports.getAllUsers || getAllUsers,
  getUserById: exports.getUserById || getUserById,
  updateUser: exports.updateUser || updateUser,
  deleteUser: exports.deleteUser || deleteUser,

  // functions only assigned via `exports.*` throughout the file
  postReview: exports.postReview,
  getReviews: exports.getReviews,
  sendOtp: exports.sendOtp,
  verifyOtp: exports.verifyOtp,
  verifyFirebaseToken: exports.verifyFirebaseToken,
  addAddress: exports.addAddress,
  getAddresses: exports.getAddresses,
  getDefaultAddress: exports.getDefaultAddress,
  setDefaultAddress: exports.setDefaultAddress,
  editAddress: exports.editAddress,
  deleteAddress: exports.deleteAddress,
  getUserPreferences: exports.getUserPreferences,
  editProfile: exports.editProfile,
  getNotificationPreferences: exports.getNotificationPreferences,
  getNanoPoints: exports.getNanoPoints,
  addBonusNanoPoints: exports.addBonusNanoPoints
});