const mongoose = require('mongoose');
const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    text: {
      type: String,
      required: true
    },
    formatting: {
      type: String, // e.g., "HTML", "Markdown"
      default: "PlainText"
    }
  },
  price: {
    type: Number,
    required: true
  },
  discountedPrice: {
    type: Number
  },
  image: {
    type: String,
    required: true
  },
  cuisine: {
    type: String,
    required: true,
    default: "Indian"
  },
  isVeg: {
    type: Boolean,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  tags: {
    type: [String],
    required: true
  },
  keyIngredients: {
    type: [String],
    default: []
  },
  allergens: {
    type: [String],
    default: []
  },
  recommendedItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  oilType: {
    type: String,
    default: "No oil used"
  },
  customizationOptions: {
    spiceLevel: {
      type: String,
      enum: ["Classic", "Spicy"],
      default: "Classic"
    },
    addOns: [{
      name: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true,
        default: 0
      },
      isVeg: {
        type: Boolean,
        default: true
      }
    }],
    needsCutlery: {
      type: Boolean,
      default: true
    }
  },
  preparationTime: {
    type: Number,
    default: 30
  },
  photos: {
    main: {
      type: String,
      default: ""
    },
    additional: [String]
  },
  nutritionInfo: {
    calories: {
      type: Number,
      default: 0
    },
    protein: {
      type: Number,
      default: 0
    },
    carbs: {
      type: Number,
      default: 0
    },
    fat: {
      type: Number,
      default: 0
    },
    fiber: {
      type: Number,
      default: 0
    },
    servingSize: {
      type: String,
      default: "1 serving"
    }
  },
  specialOffer: {
    isSpecial: {
      type: Boolean,
      default: false
    },
    validFrom: {
      type: Date
    },
    validUntil: {
      type: Date
    },
    specialPrice: {
      type: Number
    },
    description: {
      type: String
    }
  },
  popularity: {
    orderCount: {
      type: Number,
      default: 0
    },
    lastOrderedAt: {
      type: Date,
      default: null
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  moodTag: {
    type: String,
    enum: ['good', 'angry', 'in_love', 'sad'],
    default: null
  },
  hungerLevelTag: {
    type: String,
    enum: ['little_hungry', 'quite_hungry', 'very_hungry', 'super_hungry'],
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Available', 'Out of Stock', 'Coming Soon'],
    default: 'Available',
    required: true
  }
}, {
  timestamps: true
});

// Validator to ensure either restaurantId or chefId is provided, but not both
menuItemSchema.pre('validate', function(next) {
  // if ((this.restaurantId && this.chefId) || (!this.restaurantId && !this.chefId)) {
  //   next(new Error('MenuItem must have either a restaurantId or chefId, but not both'));
  // } else {
  //   next();
  // }
  next();
});

// Validate description content based on formatting
menuItemSchema.pre('validate', function(next) {
  if (this.description.formatting === "HTML") {
    const htmlContent = this.description.text || '';
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
      /on\w+\s*=/i,
      /javascript\s*:/i,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/i,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(htmlContent)) {
        return next(new Error('HTML content contains potentially malicious code'));
      }
    }
  } else if (this.description.formatting === "Markdown") {
    const markdownContent = this.description.text || '';
    const maliciousHtmlPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
      /on\w+\s*=/i,
      /javascript\s*:/i
    ];

    for (const pattern of maliciousHtmlPatterns) {
      if (pattern.test(markdownContent)) {
        return next(new Error('Markdown content contains potentially malicious HTML'));
      }
    }

    const invalidMarkdownPatterns = [
      /\[.*\]\s*\((?!https?:\/\/|mailto:|tel:|\/|#).*\)/i,
      /\[.*\](?!\(.*\))/
    ];

    for (const pattern of invalidMarkdownPatterns) {
      if (pattern.test(markdownContent)) {
        return next(new Error('Markdown content contains syntax errors'));
      }
    }
  }
  next();
});

menuItemSchema.set('toJSON', { virtuals: true });
menuItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);