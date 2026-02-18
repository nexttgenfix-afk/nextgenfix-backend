const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: [
      'order_issue',      // Order problems
      'delivery_issue',   // Delivery problems
      'payment_issue',    // Payment/billing questions
      'account_issue',    // Login, profile issues
      'technical_issue',  // App crashes, bugs
      'menu_issue',       // Menu item questions
      'general_inquiry',  // General questions
      'feedback'          // Suggestions, feature requests
    ],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Open', 'In-progress', 'Resolved', 'Closed'],
    default: 'Open',
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  description: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 1000
  },
  media: [{ type: String }], // Array of media file URLs

  // Multiple responses (new approach)
  responses: [{
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    adminName: String,
    message: {
      type: String,
      required: true
    },
    isInternal: {
      type: Boolean,
      default: false
    }, // Internal notes not shown to user
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Keep old field for backward compatibility (deprecated)
  response: {
    type: String
  }, // DEPRECATED: Use responses array

  // Additional fields
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
    index: true
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  lastResponseAt: {
    type: Date,
    default: null
  },
  tags: [String],

  // Deprecated field (kept for backward compatibility)
  respondedAt: {
    type: Date
  } // When admin responded (deprecated, use responses array)
}, {
  timestamps: true,
  indexes: [
    { user: 1, createdAt: -1 },
    { category: 1, status: 1 },
    { assignedTo: 1, status: 1 }
  ]
});

// Pre-validate hook to auto-generate complaintId in format CMP123456 if not provided
complaintSchema.pre('validate', async function(next) {
  if (!this.complaintId) {
    // Generate a unique 6-digit number
    let unique = false;
    let newId;
    while (!unique) {
      newId = 'CMP' + Math.floor(100000 + Math.random() * 900000);
      // Check uniqueness in DB
      const existing = await mongoose.models.Complaint.findOne({ complaintId: newId });
      if (!existing) unique = true;
    }
    this.complaintId = newId;
  }
  next();
});

// Pre-save hook for auto-timestamps on status changes
complaintSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'Resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'Closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }

  // Update lastResponseAt when responses are added
  if (this.isModified('responses') && this.responses.length > 0) {
    this.lastResponseAt = this.responses[this.responses.length - 1].createdAt;
  }

  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
