const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Cart = require('../models/cartModel');
const { Location } = require('../models/locationModel');
const { generateToken } = require('./auth');

/**
 * Create a new guest user
 * @param {Object} deviceInfo - Device information
 * @returns {Object} { user, token }
 */
const createGuestUser = async (deviceInfo = {}) => {
  const guestId = `guest_${Date.now()}_${uuidv4().split('-')[0]}`;

  // Check for collision (extremely rare)
  const existing = await User.findOne({ guestId });
  if (existing) {
    return createGuestUser(deviceInfo); // Recursive retry
  }

  const guestUser = await User.create({
    guestId,
    isGuest: true,
    authProvider: 'guest',
    name: 'Guest User',
    guestCreatedAt: new Date(),
    guestExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    deviceType: deviceInfo.deviceType || 'Unknown'
  });

  const token = generateToken(guestUser._id, 'user', true);

  return { user: guestUser, token };
};

/**
 * Validate guest token
 * @param {String} token - JWT token
 * @returns {Object} { user, isValid }
 */
const validateGuestToken = async (token) => {
  try {
    const authService = require('./auth');
    const decoded = authService.verifyToken(token);

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return { user: null, isValid: false };
    }

    // Check if guest session expired
    if (user.isGuest && user.guestExpiresAt < new Date()) {
      return { user: null, isValid: false, expired: true };
    }

    return { user, isValid: true };
  } catch (error) {
    return { user: null, isValid: false };
  }
};

/**
 * Merge guest data to authenticated user
 * @param {String} userId - Authenticated user ID
 * @param {String} guestUserId - Guest user ID
 * @returns {Object} { success, mergedItems }
 */
const mergeGuestToUser = async (userId, guestUserId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get guest and user
    const guest = await User.findById(guestUserId).session(session);
    const user = await User.findById(userId).session(session);

    if (!guest || !guest.isGuest) {
      throw new Error('Invalid guest user');
    }

    let mergedItems = {
      cartItems: 0,
      locations: 0
    };

    // Transfer cart items
    const guestCart = await Cart.findOne({ user: guestUserId }).session(session);
    if (guestCart && guestCart.items.length > 0) {
      let userCart = await Cart.findOne({ user: userId }).session(session);
      if (!userCart) {
        userCart = await Cart.create([{
          user: userId,
          items: [],
          totalAmount: 0
        }], { session });
        userCart = userCart[0];
      }

      // Merge items (combine quantities for duplicates)
      for (const guestItem of guestCart.items) {
        const existingIndex = userCart.items.findIndex(
          item => item.menuItem.toString() === guestItem.menuItem.toString()
        );

        if (existingIndex > -1) {
          // Merge quantities for same item
          userCart.items[existingIndex].quantity += guestItem.quantity;
        } else {
          // Add new item
          userCart.items.push(guestItem);
        }
      }

      // Recalculate total
      userCart.totalAmount = userCart.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      await userCart.save({ session });
      await Cart.deleteOne({ _id: guestCart._id }, { session });

      mergedItems.cartItems = guestCart.items.length;
    }

    // Transfer locations (avoid duplicates by comparison)
    const guestLocations = await Location.find({ user: guestUserId }).session(session);
    if (guestLocations.length > 0) {
      const userLocations = await Location.find({ user: userId }).session(session);

      for (const guestLoc of guestLocations) {
        // Check for duplicates (same flat number and formatted address)
        const duplicate = userLocations.find(userLoc =>
          userLoc.flatNumber === guestLoc.flatNumber &&
          userLoc.formattedAddress === guestLoc.formattedAddress
        );

        if (!duplicate) {
          // Create new location for user
          const newLocation = new Location({
            ...guestLoc.toObject(),
            _id: undefined, // Generate new ID
            user: userId
          });
          await newLocation.save({ session });
          user.locations.push(newLocation._id);
          mergedItems.locations++;
        }
      }

      await user.save({ session });
      await Location.deleteMany({ user: guestUserId }, { session });
    }

    // Mark guest as converted (don't delete, keep for audit)
    guest.guestConvertedAt = new Date();
    guest.guestConvertedFrom = userId;
    await guest.save({ session });

    await session.commitTransaction();
    return { success: true, mergedItems };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get guest statistics for monitoring
 * @returns {Object} Statistics
 */
const getGuestStats = async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    activeGuests,
    expiredGuests,
    convertedToday
  ] = await Promise.all([
    User.countDocuments({ isGuest: true, guestExpiresAt: { $gt: now } }),
    User.countDocuments({ isGuest: true, guestExpiresAt: { $lte: now } }),
    User.countDocuments({
      isGuest: false,
      guestConvertedAt: { $gte: today }
    })
  ]);

  return {
    activeGuests,
    expiredGuests,
    convertedToday,
    totalGuests: activeGuests + expiredGuests
  };
};

/**
 * Cleanup expired guest users (called by cron job)
 * @returns {Object} Cleanup statistics
 */
const cleanupExpiredGuests = async () => {
  const now = new Date();

  // Find expired guests
  const expiredGuests = await User.find({
    isGuest: true,
    guestExpiresAt: { $lte: now }
  });

  let deletedUsers = 0;
  let deletedCarts = 0;
  let deletedLocations = 0;

  for (const guest of expiredGuests) {
    // Delete associated carts
    const cartDelete = await Cart.deleteMany({ user: guest._id });
    deletedCarts += cartDelete.deletedCount;

    // Delete associated locations
    const locationDelete = await Location.deleteMany({ user: guest._id });
    deletedLocations += locationDelete.deletedCount;

    // Delete guest user
    await User.deleteOne({ _id: guest._id });
    deletedUsers++;
  }

  return {
    deletedUsers,
    deletedCarts,
    deletedLocations,
    message: `Cleaned up ${deletedUsers} expired guests`
  };
};

module.exports = {
  createGuestUser,
  validateGuestToken,
  mergeGuestToUser,
  getGuestStats,
  cleanupExpiredGuests
};