const mongoose = require('mongoose');

const sessionAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    enum: ['iOS', 'Android', 'Web', 'Unknown'],
    default: 'Unknown'
  },
  loginMethod: {
    type: String,
    enum: ['OTP', 'Google', 'Apple', 'Guest'],
    default: 'Guest'
  },
  sessionDuration: {
    type: Number, // in seconds
    default: 0
  },
  actions: [{
    type: {
      type: String,
      enum: ['search', 'favorite', 'add_to_cart', 'checkout', 'order', 'view_menu', 'view_item']
    },
    itemId: mongoose.Schema.Types.ObjectId, // for menu items
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed // additional data like search terms
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Indexes for performance
sessionAnalyticsSchema.index({ userId: 1, startTime: -1 });
sessionAnalyticsSchema.index({ sessionId: 1 });
sessionAnalyticsSchema.index({ deviceType: 1, startTime: -1 });
sessionAnalyticsSchema.index({ loginMethod: 1, startTime: -1 });

module.exports = mongoose.model('SessionAnalytics', sessionAnalyticsSchema);