const mongoose = require('mongoose');

const spinHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // May be null for guest users
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  guestId: {
    type: String,
    required: false
  },
  prizeWon: {
    type: {
      type: String,
      enum: ['blank', 'points', 'coupon', 'bogo'],
      required: true
    },
    label: String,
    value: mongoose.Schema.Types.Mixed, // points amount, discount amount, etc.
    couponCode: String
  },
  couponGenerated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: false
  },
  ipAddress: String,
  deviceInfo: String,
  flaggedForReview: {
    isFlagged: {
      type: Boolean,
      default: false
    },
    reason: String,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  }
}, {
  timestamps: true
});

// Index for eligibility checks
spinHistorySchema.index({ user: 1, createdAt: -1 });
spinHistorySchema.index({ guestId: 1, createdAt: -1 });

module.exports = mongoose.model('SpinHistory', spinHistorySchema);
