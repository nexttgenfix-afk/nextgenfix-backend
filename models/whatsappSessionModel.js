const mongoose = require('mongoose');

const whatsappSessionSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  state: {
    type: String,
    enum: [
      'INIT',
      'BROWSING_MENU',
      'SELECTING_ITEM',
      'COLLECTING_QUANTITY',
      'CART_REVIEW',
      'COLLECTING_ADDRESS',
      'PAYMENT_PENDING',
      'ORDER_CONFIRMED',
      'AWAITING_FEEDBACK'
    ],
    default: 'INIT'
  },
  customerName: {
    type: String,
    trim: true
  },
  cart: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    name: String,
    price: Number,
    quantity: {
      type: Number,
      default: 1
    }
  }],
  pendingItem: {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    name: String,
    price: Number
  },
  address: {
    type: String,
    trim: true
  },
  razorpayLinkId: {
    type: String
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours in seconds
  }
}, {
  timestamps: true
});

// TTL Index is handled by the 'expires' option above, 
// but we can explicitly define it for clarity if needed.
// whatsappSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('WhatsappSession', whatsappSessionSchema);
