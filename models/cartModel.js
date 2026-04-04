const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  customizations: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  specialInstructions: {
    type: String,
    default: ''
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  nanoPointsApplied: {
    type: Number,
    default: 0
  },
  nanoPointsDiscount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    default: 0
  },
  // Abandoned cart tracking
  status: {
    type: String,
    enum: ['active', 'abandoned', 'converted', 'expired'],
    default: 'active'
  },
  abandonedAt: {
    type: Date
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  recovered: {
    type: Boolean,
    default: false
  },
  recoveredAt: {
    type: Date
  },
  convertedToOrder: {
    type: Boolean,
    default: false
  },
  convertedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }
}, {
  timestamps: true
});

// Calculate total amount
cartSchema.methods.calculateTotal = async function() {
  let total = 0;
  let discount = 0;

  // Calculate item totals
  for (const item of this.items) {
    total += item.price * item.quantity;
  }

  this.totalAmount = total;

  // Apply coupon discount if exists
  if (this.coupon) {
    const Coupon = mongoose.model('Coupon');
    const coupon = await Coupon.findById(this.coupon);
    if (coupon && coupon.isActive && coupon.validUntil > new Date()) {
      if (coupon.discountType === 'percentage') {
        discount = (total * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'fixed') {
        discount = Math.min(coupon.discountValue, total);
      }
    }
  }

  this.discountAmount = discount;
  
  // Apply nano points discount if exists
  let pointsDiscount = 0;
  if (this.nanoPointsApplied > 0) {
    try {
      const Settings = mongoose.model('Settings');
      const settings = await Settings.findOne();
      const conversionRate = settings?.loyaltyConfig?.nanoPointsConversionRate || 10;
      
      // Calculate max potential discount (after coupon)
      const maxDiscount = Math.max(0, total - discount);
      pointsDiscount = Math.min(this.nanoPointsApplied / conversionRate, maxDiscount);
      
      // Actual points mapping back to the discount allowed
      this.nanoPointsDiscount = pointsDiscount;
    } catch (e) {
      console.error('Nano points calculation error:', e.message);
      this.nanoPointsDiscount = 0;
    }
  } else {
    this.nanoPointsDiscount = 0;
  }

  this.finalAmount = Math.max(0, total - discount - this.nanoPointsDiscount);
};

module.exports = mongoose.model('Cart', cartSchema);