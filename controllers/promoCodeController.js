const PromoCode = require('../models/promoCodeModel');
const Order = require('../models/orderModel');

// Validate a promo code
exports.validatePromoCode = async (req, res) => {
  const userId = req.user.id;
  const { code, cartId, restaurantId, chefId, subtotal } = req.body;

  if (!code || !subtotal) {
    return res.status(400).json({ message: "Code and subtotal are required" });
  }

  try {
    // Find the promo code
    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      expiryDate: { $gt: new Date() }
    });

    if (!promoCode) {
      return res.status(404).json({ message: "Invalid or expired promo code" });
    }

    // Check if the promo code is valid for this order
    const orderDetails = {
      userId,
      restaurantId,
      chefId,
      subtotal
    };

    const validation = await promoCode.isValidForOrder(orderDetails);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    // Calculate discount
    let discount = 0;
    if (promoCode.discountType === 'percentage') {
      discount = (subtotal * promoCode.discountValue / 100);
      // Apply max discount cap if exists
      if (promoCode.maxDiscount && discount > promoCode.maxDiscount) {
        discount = promoCode.maxDiscount;
      }
    } else {
      discount = promoCode.discountValue;
    }

    // Return promo code details
    res.status(200).json({
      valid: true,
      code: promoCode.code,
      description: promoCode.description,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      discount: Math.round(discount), // Rounded discount amount
      minOrderValue: promoCode.minOrderValue
    });
  } catch (err) {
    console.error("Validate promo code error:", err);
    res.status(500).json({ message: "Failed to validate promo code" });
  }
};

// Get promo codes applicable to the authenticated user
exports.getUserPromoCodes = async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { page = 1, limit = 20, restaurantId, chefId } = req.query;

  try {
    // Base filter: active and not expired
    const now = new Date();
    let filter = {
      isActive: true,
      expiryDate: { $gt: now }
    };

    // Fetch candidate promo codes
    const total = await PromoCode.countDocuments(filter);

    const promoCodes = await PromoCode.find(filter)
      .sort({ expiryDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10))
      .lean();

    // Post-filter by applicability rules
    const applicable = [];
    for (const pc of promoCodes) {
      let include = true;

      // First order restriction
      if (pc.applicableFor && pc.applicableFor.firstOrder) {
        const orderCount = await Order.countDocuments({ userId });
        if (orderCount > 0) include = false;
      }

      // Specific users
      if (pc.applicableFor && Array.isArray(pc.applicableFor.specificUsers) && pc.applicableFor.specificUsers.length > 0) {
        if (!pc.applicableFor.specificUsers.some(u => u.toString() === userId.toString())) include = false;
      }

      // Specific restaurant filtering (if provided as query, and if promo restricts restaurants)
      if (restaurantId && pc.applicableFor && Array.isArray(pc.applicableFor.specificRestaurants) && pc.applicableFor.specificRestaurants.length > 0) {
        if (!pc.applicableFor.specificRestaurants.some(r => r.toString() === restaurantId.toString())) include = false;
      }

      // Specific chef filtering
      if (chefId && pc.applicableFor && Array.isArray(pc.applicableFor.specificChefs) && pc.applicableFor.specificChefs.length > 0) {
        if (!pc.applicableFor.specificChefs.some(c => c.toString() === chefId.toString())) include = false;
      }

      if (include) applicable.push(pc);
    }

    res.status(200).json({
      promoCodes: applicable,
      total,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Get user promo codes error:', err);
    res.status(500).json({ message: 'Failed to fetch promo codes', error: err.message });
  }
};

// Admin: create a new promo code
exports.createPromoCode = async (req, res) => {
  try {
    const payload = req.body || {};
    if (payload.code) payload.code = String(payload.code).toUpperCase();

    // Basic required fields check
    if (!payload.code || !payload.description || !payload.discountType || payload.discountValue == null || !payload.expiryDate) {
      return res.status(400).json({ message: 'Missing required promo code fields' });
    }

    // Prevent duplicate code
    const exists = await PromoCode.findOne({ code: payload.code });
    if (exists) return res.status(409).json({ message: 'Promo code with this code already exists' });

    const promo = new PromoCode(payload);
    await promo.save();

    res.status(201).json({ message: 'Promo code created', promo });
  } catch (err) {
    console.error('Create promo code error:', err);
    res.status(500).json({ message: 'Failed to create promo code', error: err.message });
  }
};

// Admin: list all promo codes with pagination and optional filters
exports.getAllPromoCodes = async (req, res) => {
  const { page = 1, limit = 50, active } = req.query;
  try {
    const filter = {};
    if (typeof active !== 'undefined') filter.isActive = active === 'true' || active === '1';

    const total = await PromoCode.countDocuments(filter);
    const promos = await PromoCode.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10))
      .lean();

    res.status(200).json({ promoCodes: promos, total, currentPage: parseInt(page, 10), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Get all promo codes error:', err);
    res.status(500).json({ message: 'Failed to fetch promo codes', error: err.message });
  }
};

// Admin: update an existing promo code by id
exports.updatePromoCode = async (req, res) => {
  const id = req.params.id;
  const updates = req.body || {};
  if (updates.code) updates.code = String(updates.code).toUpperCase();

  try {
    const promo = await PromoCode.findById(id);
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });

    // Prevent changing to a code that already exists on another promo
    if (updates.code && updates.code !== promo.code) {
      const existing = await PromoCode.findOne({ code: updates.code });
      if (existing) return res.status(409).json({ message: 'Another promo with this code already exists' });
    }

    Object.assign(promo, updates);
    await promo.save();

    res.status(200).json({ message: 'Promo code updated', promo });
  } catch (err) {
    console.error('Update promo code error:', err);
    res.status(500).json({ message: 'Failed to update promo code', error: err.message });
  }
};

// Admin: delete a promo code
exports.deletePromoCode = async (req, res) => {
  const id = req.params.id;
  try {
    const promo = await PromoCode.findById(id);
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });

    await PromoCode.deleteOne({ _id: id });
    res.status(200).json({ message: 'Promo code deleted' });
  } catch (err) {
    console.error('Delete promo code error:', err);
    res.status(500).json({ message: 'Failed to delete promo code', error: err.message });
  }
};

// Admin: toggle promo code active status
exports.togglePromoCodeStatus = async (req, res) => {
  const id = req.params.id;
  try {
    const promo = await PromoCode.findById(id);
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });

    promo.isActive = !promo.isActive;
    await promo.save();

    res.status(200).json({ message: 'Promo code status updated', isActive: promo.isActive });
  } catch (err) {
    console.error('Toggle promo code status error:', err);
    res.status(500).json({ message: 'Failed to toggle promo code status', error: err.message });
  }
};