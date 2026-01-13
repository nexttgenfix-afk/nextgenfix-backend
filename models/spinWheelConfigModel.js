const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['blank', 'points', 'coupon', 'bogo'],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  probability: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  // For 'blank'
  message: String,
  // For 'points'
  pointsRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 }
  },
  // For 'coupon' and 'bogo'
  couponConfig: {
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'free_delivery'],
      default: 'percentage'
    },
    discountRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 }
    },
    validityDays: {
      type: Number,
      default: 7
    },
    minOrderValue: {
      type: Number,
      default: 0
    },
    maxDiscount: {
      type: Number,
      default: null
    }
  }
}, { _id: true });

const spinWheelConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "Daily Spin Wheel"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  frequency: {
    type: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'daily'
    },
    limit: {
      type: Number,
      default: 1
    }
  },
  eligibility: {
    minOrders: {
      type: Number,
      default: 0
    },
    tiers: {
      type: [String],
      default: ['all']
    },
    allowGuests: {
      type: Boolean,
      default: true
    }
  },
  prizes: [prizeSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('SpinWheelConfig', spinWheelConfigSchema);
