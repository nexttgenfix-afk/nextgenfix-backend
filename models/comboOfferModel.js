const mongoose = require('mongoose');

const comboOfferSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  // Enhanced items structure with quantity support for duplicates
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  }],
  // Original total price (sum of all items * quantities)
  originalPrice: {
    type: Number,
    required: true
  },
  // Discount configuration
  discount: {
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'none'],
      default: 'none'
    },
    value: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  // Final price after discount (required for quick queries)
  price: {
    type: Number,
    required: false // Let pre-save hook calculate this
  },
  image: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: function() {
      // Default to 30 days from now
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },
  // Track price mismatch warnings (for Solution 3: Semi-auto warning)
  priceWarning: {
    hasWarning: {
      type: Boolean,
      default: false
    },
    lastChecked: Date,
    message: String
  }
}, {
  timestamps: true
});

// Virtual field to calculate if items are available
comboOfferSchema.virtual('availableItemsCount').get(function() {
  return this.items ? this.items.length : 0;
});

// Method to calculate discount amount
comboOfferSchema.methods.calculateDiscount = function() {
  if (this.discount.type === 'percentage') {
    return Math.round((this.originalPrice * this.discount.value) / 100 * 100) / 100;
  } else if (this.discount.type === 'fixed') {
    return Math.round(this.discount.value * 100) / 100;
  }
  return 0;
};

// Method to calculate final price
comboOfferSchema.methods.calculateFinalPrice = function() {
  const discountAmount = this.calculateDiscount();
  return Math.max(0, Math.round((this.originalPrice - discountAmount) * 100) / 100);
};

// Pre-save middleware to auto-calculate final price
comboOfferSchema.pre('save', function(next) {
  // Always calculate final price to ensure it's up to date
  if (this.originalPrice !== undefined) {
    this.price = this.calculateFinalPrice();
  }
  next();
});

// Ensure virtuals are included when converting to JSON
comboOfferSchema.set('toJSON', { virtuals: true });
comboOfferSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ComboOffer', comboOfferSchema);
