const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  recurringInterval: { type: String, enum: ['weekly','monthly','yearly'], default: 'monthly' },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  lastChargeDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subscriptionSchema.index({ user: 1 });

subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
