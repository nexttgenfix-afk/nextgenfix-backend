const mongoose = require('mongoose');

const productAnalyticsSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  // View metrics
  views: {
    type: Number,
    default: 0
  },
  uniqueViews: {
    type: Number,
    default: 0
  },
  // Interaction metrics
  favorites: {
    type: Number,
    default: 0
  },
  addToCart: {
    type: Number,
    default: 0
  },
  purchases: {
    type: Number,
    default: 0
  },
  // Conversion metrics
  viewToCartRate: {
    type: Number,
    default: 0 // percentage
  },
  cartToPurchaseRate: {
    type: Number,
    default: 0 // percentage
  },
  // Revenue metrics
  totalRevenue: {
    type: Number,
    default: 0
  },
  averagePrice: {
    type: Number,
    default: 0
  },
  // Search analytics
  searchAppearances: {
    type: Number,
    default: 0
  },
  searchTerms: [{
    term: String,
    count: Number,
    lastSearched: Date
  }],
  // Time-based data
  dateRange: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  // Nutrition and customization data
  nutritionTags: [String],
  customizationUsage: {
    spiceLevel: { type: Number, default: 0 },
    addOns: { type: Number, default: 0 },
    cookingInstructions: { type: Number, default: 0 }
  },
  // Performance indicators
  isTopPerformer: {
    type: Boolean,
    default: false
  },
  isLowPerformer: {
    type: Boolean,
    default: false
  },
  trendDirection: {
    type: String,
    enum: ['up', 'down', 'stable'],
    default: 'stable'
  }
}, {
  timestamps: true
});

// Indexes for performance
productAnalyticsSchema.index({ productId: 1, dateRange: -1 });
productAnalyticsSchema.index({ category: 1, purchases: -1 });
productAnalyticsSchema.index({ totalRevenue: -1 });
productAnalyticsSchema.index({ isTopPerformer: 1 });
productAnalyticsSchema.index({ isLowPerformer: 1 });

module.exports = mongoose.model('ProductAnalytics', productAnalyticsSchema);