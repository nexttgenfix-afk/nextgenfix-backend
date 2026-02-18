const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      required: true,
      default: () => `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['top_up', 'order_payment', 'refund', 'bonus', 'deduction', 'reversal'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'pending'
    },
    description: {
      type: String,
      required: true
    },
    metadata: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
      },
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        default: null
      },
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
      },
      reason: String, // For deductions/bonuses
      referenceNumber: String, // PhonePe transaction ID, etc.
      notes: String
    },
    reversedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      default: null
    },
    reversalReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    indexes: [
      { user: 1, createdAt: -1 },
      { user: 1, type: 1 },
      { type: 1, createdAt: -1 },
      { status: 1 },
      { 'metadata.orderId': 1 }
    ]
  }
);

// Index for text search on description and notes
walletTransactionSchema.index({ description: 'text', 'metadata.notes': 'text' });

// Pre-save validation
walletTransactionSchema.pre('save', function(next) {
  // Validate balance consistency
  if (this.type !== 'reversal') {
    if (this.type === 'top_up' || this.type === 'refund' || this.type === 'bonus') {
      // Credit transactions
      if (this.balanceAfter !== this.balanceBefore + this.amount) {
        return next(new Error('Balance calculation error: Invalid balanceAfter for credit transaction'));
      }
    } else if (this.type === 'order_payment' || this.type === 'deduction') {
      // Debit transactions
      if (this.balanceAfter !== this.balanceBefore - this.amount) {
        return next(new Error('Balance calculation error: Invalid balanceAfter for debit transaction'));
      }
    }
  }

  next();
});

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
