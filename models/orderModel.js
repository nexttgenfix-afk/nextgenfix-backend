const mongoose = require('mongoose');
const { locationSchema } = require('./locationModel');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderType: {
    type: String,
    enum: ['on_site_dining', 'delivery'],
    required: true
  },
  dayPart: {
    type: String,
    enum: ['breakfast', 'lunch', 'snack', 'dinner'],
    default: function() {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 12) return 'breakfast';
      if (hour >= 12 && hour < 16) return 'lunch';
      if (hour >= 16 && hour < 19) return 'snack';
      return 'dinner';
    }
  },
  scheduledTime: {
    type: Date
  },
  items: [{
    itemId: {
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
    // Added item customizations to preserve order details
    customizations: {
      spiceLevel: String,
      cookingInstructions: String, // Specific cooking instructions for this item
      addOns: [{
        name: String,
        price: Number,
        isVeg: Boolean
      }],
      needsCutlery: Boolean
    }
  }],
  // Special instructions
  cookingInstructions: {
    type: String,
    maxlength: 500,
    default: ''  // Optional general cooking instructions
  },
  deliveryInstructions: {
    type: String,
    maxlength: 500,
    default: ''  // Instructions for the delivery person
  },
  // Tip details
  tip: {
    amount: {
      type: Number,
      enum: [0, 10, 15, 20, 25, 'custom'],
      default: 0  // Amount in rupees
    }
  },
  // Bill details
  billing: {
    subtotal: {
      type: Number,
      required: true  // Sum of all items before discounts, taxes, fees
    },
    discounts: {
      promoCode: {
        code: String,
        amount: {
          type: Number,
          default: 0
        }
      },
      nanoPointsRedemption: {
        points: {
          type: Number,
          default: 0
        },
        amount: {
          type: Number,
          default: 0
        }
      },
      totalDiscount: {
        type: Number,
        default: 0
      }
    },
    deliveryFee: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    packagingFee: {
      type: Number,
      default: 0
    },
    platformFee: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    }
  },
  // Original fields
  status: {
    type: String,
    enum: ['placed', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'],
    default: 'placed',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
    required: true
  },
  paymentDetails: {
    paymentId: String,
    method: {
        type: String,
        enum: ['online', 'Online', 'cash_at_restaurant', 'cod', 'cash']
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending'
    }
  },
  deliveryAddress: {
    type: mongoose.Schema.Types.Mixed
  },
  scheduledFor: {
    type: Date,
    default: null // For chef orders with scheduled delivery
  },
  // New field for nano points earned from this order
  nanoPointsEarned: {
    type: Number,
    default: 0
  },
  // Tracking and delivery fields
  trackingHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String
    }
  }],
  estimatedDeliveryTime: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  chef: { type: mongoose.Schema.Types.ObjectId, ref: 'Chef' }
}, {
  timestamps: true
});

// Indexes for faster queries
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

// Virtual field to format delivery address for display
orderSchema.virtual('formattedDeliveryAddress').get(function() {
  const loc = this.deliveryAddress;
  if (!loc) return '';
  
  // If it's already a string, return it
  if (typeof loc === 'string') return loc;
  
  // If it's an object with our new Location model fields
  if (typeof loc === 'object') {
    // Prefer formattedAddress from Google Maps
    if (loc.formattedAddress) {
      return loc.formattedAddress;
    }
    
    // If addressComponents exist (Google Maps parsed structure)
    if (loc.addressComponents) {
      const ac = loc.addressComponents;
      return [
        loc.flatNumber,
        ac.street,
        loc.landmark,
        ac.city,
        ac.state,
        ac.postalCode,
        ac.country
      ].filter(Boolean).join(', ');
    }
    
    // Fallback to concatenating any available fields (old address structure)
    return [
      loc.flatNumber,
      loc.street,
      loc.address,
      loc.line1,
      loc.line2,
      loc.landmark,
      loc.city,
      loc.state,
      loc.pincode,
      loc.label
    ].filter(Boolean).join(', ');
  }
  
  return '';
});

// Ensure virtuals are included when converting to JSON/Object
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);