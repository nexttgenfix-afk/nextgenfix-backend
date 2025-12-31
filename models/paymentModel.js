const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  method: {
    type: String,
    enum: ['cod', 'card', 'upi', 'netbanking', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  couponUsed: {
    type: String
  },
  paymentGatewayResponse: {
    type: String,
    enum: ['success','failed','pending']
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },
  phonePePayload: {
    type: Object // Store the PhonePe request payload
  },
  phonePeResponse: {
    type: Object // Store the PhonePe response
  },
  refundStatus: {
    type: String,
    enum: ['none', 'processing', 'refunded', 'failed'],
    default: 'none'
  },
  refundReason: {
    type: String
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);