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
  this.finalAmount = total - discount;
};

module.exports = mongoose.model('Cart', cartSchema);