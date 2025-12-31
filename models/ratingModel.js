const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
}, {
  timestamps: true
});

// Validator to ensure either restaurant or chef is provided, but not both
ratingSchema.pre('validate', function(next) {
  // No validation needed - simplified rating model
  next();
});

// Compound index to ensure a user can only review a menu item once per order
ratingSchema.index({ user: 1, orderId: 1, menuItemId: 1 }, { unique: true });
// Indexes for efficient querying
ratingSchema.index({ restaurantId: 1, createdAt: -1 });
ratingSchema.index({ chefId: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', ratingSchema);