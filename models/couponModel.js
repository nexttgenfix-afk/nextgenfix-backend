const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'free_delivery', 'bogo'],
    required: true
  },
  minOrderValue: {
    type: Number,
    default: 0
  },
  maxDiscount: {
    type: Number,
    default: null
  },
  usageLimit: {
    type: Number,
    default: null
  },
  usageLimitPerUser: {
    type: Number,
    default: 1
  },
  // global used count and per-user usage tracking
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 }
  }],
  applicableTiers: {
    type: [String],
    default: ['all']
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  // Refund / revoke metadata
  refunded: { type: Boolean, default: false },
  refundReason: { type: String, default: null },
  refundedAt: { type: Date, default: null },
  // Small meta object allowing origin tagging (e.g., 'referral')
  meta: {
    origin: { type: String, default: null },
    originType: { type: String, default: null },
    originalPrizeId: { type: String, default: null }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByType' // Dynamic reference
  },
  createdByType: {
    type: String,
    enum: ['Chef', 'Restaurant', 'Admin'] // Specify allowed types
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Coupon', couponSchema);