const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    // unique index declared via `unique: true` above; remove inline index to avoid duplicates
  },
  phone: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['super_admin', 'manager', 'support'],
    default: 'support'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_menu',
      'manage_orders',
      'manage_complaints',
      'manage_settings',
      'manage_admins',
      'manage_coupons',
      'manage_combos',
      'manage_tables',
      'view_analytics',
      'send_notifications'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  profilePicture: {
    type: String
  }
}, {
  timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Don't return password in JSON responses
adminSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Static method to get permissions by role
adminSchema.statics.getDefaultPermissions = function(role) {
  const permissions = {
    super_admin: [
      'manage_users',
      'manage_menu',
      'manage_orders',
      'manage_complaints',
      'manage_settings',
      'manage_admins',
      'manage_coupons',
      'manage_combos',
      'manage_tables',
      'view_analytics',
      'send_notifications'
    ],
    manager: [
      'manage_users',
      'manage_menu',
      'manage_orders',
      'manage_complaints',
      'manage_coupons',
      'manage_combos',
      'manage_tables',
      'view_analytics',
      'send_notifications'
    ],
    support: [
      'manage_orders',
      'manage_complaints',
      'view_analytics'
    ]
  };
  
  return permissions[role] || [];
};

module.exports = mongoose.model('Admin', adminSchema);
