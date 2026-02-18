const mongoose = require('mongoose');
const shortid = require('shortid');

const faqSchema = new mongoose.Schema(
  {
    faqId: {
      type: String,
      unique: true,
      required: true,
      default: () => `FAQ${shortid.generate()}`
    },
    question: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 200,
      index: true
    },
    answer: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 1000
    },
    category: {
      type: String,
      enum: ['ordering', 'payment', 'delivery', 'account', 'menu', 'general'],
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    order: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    helpful: {
      type: Number,
      default: 0
    },
    notHelpful: {
      type: Number,
      default: 0
    },
    tags: [String],
    admin: {
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      }
    }
  },
  {
    timestamps: true,
    indexes: [
      { question: 'text', answer: 'text', tags: 'text' },
      { category: 1, isActive: 1 },
      { isActive: 1, order: 1 }
    ]
  }
);

// Pre-save validation
faqSchema.pre('save', function(next) {
  // Ensure question is at least 10 chars
  if (this.question.length < 10) {
    return next(new Error('Question must be at least 10 characters'));
  }

  // Ensure answer is at least 20 chars
  if (this.answer.length < 20) {
    return next(new Error('Answer must be at least 20 characters'));
  }

  next();
});

module.exports = mongoose.model('FAQ', faqSchema);
