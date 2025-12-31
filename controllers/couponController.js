const Coupon = require('../models/couponModel');

exports.createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, usageLimitPerUser, validFrom, validUntil, isActive, applicableTiers } = req.body;

    // Add default dates if not provided
    const defaultValidFrom = validFrom || new Date();
    const defaultValidUntil = validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newCoupon = new Coupon({
      code,
      discountValue,
      discountType,
      minOrderValue,
      maxDiscount,
      usageLimit,
      usageLimitPerUser,
      applicableTiers,
      validFrom: defaultValidFrom,
      validUntil: defaultValidUntil,
      isActive,
      createdBy: req.admin._id,
      createdByType: 'Admin'
    });

    await newCoupon.save();
    res.status(201).json({ message: 'Coupon created successfully', coupon: newCoupon });
  } catch (err) {
    console.error('Error creating coupon:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Coupon already exists' });
    }
    res.status(500).json({ message: 'Failed to create coupon', error: err.message });
  }
};

exports.getUserCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({ createdBy: req.user.id, createdByType: req.user.role }).sort({ validUntil: -1 });
    res.status(200).json(coupons);
  } catch (err) {
    console.error('Error fetching coupons:', err);
    res.status(500).json({ message: 'Failed to fetch coupons', error: err.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit, usageLimitPerUser, validFrom, validUntil, isActive, applicableTiers } = req.body;

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      { code, discountValue, discountType, minOrderValue, maxDiscount, usageLimit, usageLimitPerUser, applicableTiers, validFrom, validUntil, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json({ message: 'Coupon updated successfully', coupon: updatedCoupon });
  } catch (err) {
    console.error('Error updating coupon:', err);
    res.status(500).json({ message: 'Failed to update coupon', error: err.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCoupon = await Coupon.findByIdAndDelete(id);

    if (!deletedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (err) {
    console.error('Error deleting coupon:', err);
    res.status(500).json({ message: 'Failed to delete coupon', error: err.message });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ message: 'Coupon expired or not yet valid' });
    }
    res.json({ valid: true, coupon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({ message: 'Coupon status updated', coupon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate a unique coupon code
exports.generateCouponCode = async (req, res) => {
  try {
    // Generate random 8-character alphanumeric code
    const generateCode = () => {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    };
    
    let code = generateCode();
    let attempts = 0;
    const maxAttempts = 10;
    
    // Check if code already exists, regenerate if needed
    while (attempts < maxAttempts) {
      const exists = await Coupon.findOne({ code });
      if (!exists) {
        return res.json({ code });
      }
      code = generateCode();
      attempts++;
    }
    
    // If we couldn't find a unique code after max attempts, add timestamp
    code = `${code}${Date.now().toString().slice(-4)}`;
    res.json({ code });
  } catch (err) {
    console.error('Error generating coupon code:', err);
    res.status(500).json({ error: err.message });
  }
};

// Admin: Get referral audit (referrers, referred users, and referral coupons)
exports.getReferralAudit = async (req, res) => {
  try {
    const User = require('../models/userModel');
    // find users that have at least one referral
    const referrers = await User.find({ 'referrals.0': { $exists: true } })
      .select('name email phone referralCode referrals referralCoupons referralCount')
      .populate({ path: 'referrals.user', select: 'name email phone' })
      .lean();

    // also populate coupon details for referralCoupons
    const couponIds = referrers.reduce((acc, r) => {
      if (Array.isArray(r.referralCoupons)) acc.push(...r.referralCoupons);
      return acc;
    }, []);

    const coupons = couponIds.length ? await Coupon.find({ _id: { $in: couponIds } }).lean() : [];

    res.json({ referrers, coupons });
  } catch (err) {
    console.error('Error fetching referral audit:', err);
    res.status(500).json({ message: 'Failed to fetch referral audit', error: err.message });
  }
};

// Admin: Refund / revoke a referral coupon and remove associations
exports.refundReferralCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body.reason || 'Admin refund';

    const coupon = await Coupon.findById(id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    // Mark coupon inactive and flag as refunded
    coupon.isActive = false;
    coupon.refunded = true;
    coupon.refundReason = reason;
    coupon.refundedAt = new Date();
    await coupon.save();

    // Remove coupon references from any users
    const User = require('../models/userModel');
    const users = await User.find({ referralCoupons: id });
    for (const u of users) {
      u.referralCoupons = (u.referralCoupons || []).filter(c => c.toString() !== id.toString());
      // if this was a referrer's coupon, reduce referralCount conservatively
      if (u.referralCount && u.referralCount > 0) u.referralCount -= 1;
      await u.save();
    }

    res.json({ message: 'Coupon refunded and associations removed', couponId: id, affectedUsers: users.length });
  } catch (err) {
    console.error('Error refunding coupon:', err);
    res.status(500).json({ message: 'Failed to refund coupon', error: err.message });
  }
};