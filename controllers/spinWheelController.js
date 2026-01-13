const SpinWheelConfig = require('../models/spinWheelConfigModel');
const SpinHistory = require('../models/spinHistoryModel');
const Coupon = require('../models/couponModel');
const User = require('../models/userModel');
const Order = require('../models/orderModel');
const mongoose = require('mongoose');

// Helper to generate a unique coupon code
const generateSpinCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'SPIN-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- Admin Endpoints ---

// Get spin wheel config
exports.getConfig = async (req, res) => {
  try {
    let config = await SpinWheelConfig.findOne();
    if (!config) {
      // Create default config if none exists
      config = await SpinWheelConfig.create({
        prizes: [
          { type: 'blank', label: 'Nice Try', message: 'Better luck next time!', probability: 40 },
          { type: 'points', label: '100 Points', pointsRange: { min: 100, max: 100 }, probability: 30 },
          { type: 'coupon', label: '10% Off', couponConfig: { discountType: 'percentage', discountRange: { min: 10, max: 10 }, validityDays: 7, minOrderValue: 200 }, probability: 20 },
          { type: 'bogo', label: 'Buy 1 Get 1', couponConfig: { discountType: 'percentage', discountRange: { min: 100, max: 100 }, validityDays: 7, minOrderValue: 500 }, probability: 10 }
        ]
      });
    }
    res.status(200).json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching config', error: err.message });
  }
};

// Update spin wheel config
exports.updateConfig = async (req, res) => {
  try {
    const { name, isActive, frequency, eligibility, prizes } = req.body;
    
    // Validate probabilities total 100
    const totalProb = prizes.reduce((sum, p) => sum + p.probability, 0);
    if (Math.abs(totalProb - 100) > 0.1) {
      return res.status(400).json({ success: false, message: 'Total probability must be 100%' });
    }

    const config = await SpinWheelConfig.findOneAndUpdate(
      {},
      { name, isActive, frequency, eligibility, prizes },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({ success: true, config, message: 'Config updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating config', error: err.message });
  }
};

// Get spin history (admin)
exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, isFlagged, userId } = req.query;
    const query = {};
    if (isFlagged === 'true') query['flaggedForReview.isFlagged'] = true;
    if (userId) query.user = userId;

    const history = await SpinHistory.find(query)
      .populate('user', 'name phone email')
      .populate('couponGenerated')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await SpinHistory.countDocuments(query);

    res.status(200).json({ success: true, history, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching history', error: err.message });
  }
};

// Revoke spin coupon
exports.revokeCoupon = async (req, res) => {
  try {
    const { id } = req.params; // SpinHistory ID
    const { reason } = req.body;

    const history = await SpinHistory.findById(id);
    if (!history || !history.couponGenerated) {
      return res.status(404).json({ success: false, message: 'Spin history or coupon not found' });
    }

    // Revoke coupon in Coupon model
    await Coupon.findByIdAndUpdate(history.couponGenerated, {
      isActive: false,
      refunded: true,
      refundReason: reason || 'Admin revoked',
      refundedAt: new Date()
    });

    // Update history
    history.flaggedForReview.reviewedAt = new Date();
    history.flaggedForReview.reviewedBy = req.admin._id;
    await history.save();

    res.status(200).json({ success: true, message: 'Coupon revoked successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error revoking coupon', error: err.message });
  }
};

// Get spin wheel analytics
exports.getAnalytics = async (req, res) => {
  try {
    const totalSpins = await SpinHistory.countDocuments();
    
    // Calculate last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSpins = await SpinHistory.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    // Prize Distribution
    const distribution = await SpinHistory.aggregate([
      { $group: { _id: "$prizeWon.type", count: { $sum: 1 } } }
    ]);

    // Redemption Rate
    // 1. Get total coupons generated
    const totalCoupons = await SpinHistory.countDocuments({ couponGenerated: { $ne: null } });
    
    // 2. Get used counts from those specific coupons
    let redemptionRate = 0;
    if (totalCoupons > 0) {
      const historyWithCoupons = await SpinHistory.find({ couponGenerated: { $ne: null } }).populate('couponGenerated');
      const redeemedCount = historyWithCoupons.filter(h => h.couponGenerated && h.couponGenerated.usedCount > 0).length;
      redemptionRate = ((redeemedCount / totalCoupons) * 100).toFixed(1);
    }

    // Flagged count
    const flaggedCount = await SpinHistory.countDocuments({ "flaggedForReview.isFlagged": true, "flaggedForReview.reviewedAt": null });

    res.status(200).json({
      success: true,
      stats: {
        totalSpins,
        recentSpins,
        redemptionRate,
        flaggedCount,
        distribution
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Error fetching analytics', error: err.message });
  }
};

// --- User Endpoints ---

// Perform Spin
exports.spin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.userId;
    const isGuest = req.isGuest;
    const guestId = isGuest ? req.user.guestId : null;

    // 1. Get Config
    const config = await SpinWheelConfig.findOne({ isActive: true });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Spin wheel is currently unavailable' });
    }

    // 2. Eligibility Checks
    if (!isGuest) {
      const user = await User.findById(userId);
      // Tier Check
      if (!config.eligibility.tiers.includes('all') && !config.eligibility.tiers.includes(user.tier)) {
        return res.status(403).json({ success: false, message: 'This tier is not eligible for the spin wheel' });
      }
      // Min Orders Check
      const orderCount = await Order.countDocuments({ user: userId, status: 'delivered' });
      if (orderCount < config.eligibility.minOrders) {
        return res.status(403).json({ success: false, message: `Minimum ${config.eligibility.minOrders} orders required to spin` });
      }
      // Frequency Check (Daily)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todaySpin = await SpinHistory.findOne({ user: userId, createdAt: { $gte: startOfDay } });
      if (todaySpin) {
        return res.status(403).json({ success: false, message: 'You have already used your daily spin' });
      }
    } else {
      // Guest Check
      if (!config.eligibility.allowGuests) {
        return res.status(403).json({ success: false, message: 'Registration required to spin' });
      }
      const guestSpin = await SpinHistory.findOne({ guestId: guestId });
      if (guestSpin) {
        return res.status(403).json({ success: false, message: 'Guests are limited to one spin only. Please register for daily spins!' });
      }
    }

    // 3. Select Prize (Weighted Random)
    const random = Math.random() * 100;
    let selectedPrize = null;
    let cumulativeProb = 0;

    for (const prize of config.prizes) {
      cumulativeProb += prize.probability;
      if (random <= cumulativeProb) {
        selectedPrize = prize;
        break;
      }
    }

    if (!selectedPrize) selectedPrize = config.prizes[0]; // Fallback

    // 4. Process Prize
    let prizeResult = {
      type: selectedPrize.type,
      label: selectedPrize.label,
      value: null,
      message: selectedPrize.message
    };
    let couponGeneratedId = null;
    let isFlagged = false;
    let flagReason = '';

    if (selectedPrize.type === 'points') {
      const points = Math.floor(Math.random() * (selectedPrize.pointsRange.max - selectedPrize.pointsRange.min + 1)) + selectedPrize.pointsRange.min;
      prizeResult.value = points;
      if (!isGuest) {
        await User.findByIdAndUpdate(userId, {
          $inc: { nanoPoints: points },
          $push: {
            nanoPointsHistory: {
              points,
              type: 'bonus',
              description: 'Spin Wheel Reward',
              timestamp: new Date()
            }
          }
        }, { session });
      }
    } else if (selectedPrize.type === 'coupon' || selectedPrize.type === 'bogo') {
      const discount = Math.floor(Math.random() * (selectedPrize.couponConfig.discountRange.max - selectedPrize.couponConfig.discountRange.min + 1)) + selectedPrize.couponConfig.discountRange.min;
      prizeResult.value = discount;
      
      const code = generateSpinCouponCode();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + selectedPrize.couponConfig.validityDays);

      const newCoupon = new Coupon({
        code,
        discountType: selectedPrize.couponConfig.discountType,
        discountValue: discount,
        minOrderValue: selectedPrize.couponConfig.minOrderValue,
        maxDiscount: selectedPrize.couponConfig.maxDiscount,
        usageLimit: 1,
        usageLimitPerUser: 1,
        validFrom: new Date(),
        validUntil: validUntil,
        isActive: true,
        isLocked: true,
        meta: { 
          origin: 'spinWheel', 
          originType: 'spin_wheel_prize',
          originalPrizeId: selectedPrize.id 
        },
        createdBy: config._id, 
        createdByType: 'Admin'
      });

      const savedCoupon = await newCoupon.save({ session });
      couponGeneratedId = savedCoupon._id;
      prizeResult.couponCode = code;

      // Fraud Detection Flagging (>100 discount value)
      if (discount > 100 || (selectedPrize.couponConfig.discountType === 'percentage' && discount >= 50)) {
        isFlagged = true;
        flagReason = 'High value prize won';
      }
    }

    // 5. Save History
    const history = new SpinHistory({
      user: userId,
      isGuest,
      guestId: isGuest ? guestId : null,
      prizeWon: {
        type: prizeResult.type,
        label: prizeResult.label,
        value: prizeResult.value,
        couponCode: prizeResult.couponCode
      },
      couponGenerated: couponGeneratedId,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
      flaggedForReview: {
        isFlagged,
        reason: flagReason
      }
    });

    await history.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: prizeResult,
      message: prizeResult.type === 'blank' ? prizeResult.message : `Congratulations! You won ${prizeResult.label}`
    });

  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: 'Error during spin', error: err.message });
  } finally {
    session.endSession();
  }
};

// Get user spin eligibility/status
exports.getSpinStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const isGuest = req.isGuest;
    const guestId = isGuest ? req.user.guestId : null;

    const config = await SpinWheelConfig.findOne({ isActive: true });
    if (!config) return res.status(200).json({ success: true, available: false });

    let eligible = true;
    let reason = '';
    let lastSpin = null;

    if (!isGuest) {
      const user = await User.findById(userId);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      lastSpin = await SpinHistory.findOne({ user: userId }).sort({ createdAt: -1 });
      
      if (lastSpin && lastSpin.createdAt >= startOfDay) {
        eligible = false;
        reason = 'Next spin available tomorrow';
      } else if (!config.eligibility.tiers.includes('all') && !config.eligibility.tiers.includes(user.tier)) {
        eligible = false;
        reason = 'Tier not eligible';
      } else {
        const orderCount = await Order.countDocuments({ user: userId, status: 'delivered' });
        if (orderCount < config.eligibility.minOrders) {
          eligible = false;
          reason = `Need ${config.eligibility.minOrders} delivered orders`;
        }
      }
    } else {
      lastSpin = await SpinHistory.findOne({ guestId: guestId });
      if (lastSpin) {
        eligible = false;
        reason = 'Guest limit reached (1 spin). Register for more!';
      } else if (!config.eligibility.allowGuests) {
        eligible = false;
        reason = 'Registration required';
      }
    }

    res.status(200).json({
      success: true,
      available: true,
      eligible,
      reason,
      config: {
        name: config.name,
        prizes: config.prizes.map(p => ({ label: p.label, type: p.type }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error checking spin status', error: err.message });
  }
};
