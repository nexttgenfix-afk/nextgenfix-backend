const mongoose = require('mongoose');
const { locationSchema } = require('./locationModel');
const shortid = require('shortid');

// Helper to compute age group from a birthDate
function computeAgeGroup(birthDate) {
  if (!birthDate) return 'Unknown';
  const now = new Date();
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return 'Unknown';
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) {
    age--;
  }
  if (age >= 65) return '65+';
  if (age >= 55) return '55-64';
  if (age >= 45) return '45-54';
  if (age >= 35) return '35-44';
  if (age >= 25) return '25-34';
  if (age >= 18) return '18-24';
  return 'Unknown';
}

const userSchema = new mongoose.Schema({
  // Firebase Authentication
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  authProvider: {
    type: String,
    enum: ['phone', 'google', 'apple', 'guest'],
    default: 'guest'
  },
  
  // User Information
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null values but enforce uniqueness when provided
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    unique: true,
    sparse: true
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  // Demographics for analytics
  ageGroup: {
    type: String,
    enum: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'Unknown'],
    default: 'Unknown'
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    default: 'Prefer not to say'
  },
  // Birth date for profile and age calculation
  birthDate: {
    type: Date,
    required: false
  },
  deviceType: {
    type: String,
    enum: ['iOS', 'Android', 'Web', 'Unknown'],
    default: 'Unknown'
  },
  preferredLoginMethod: {
    type: String,
    enum: ['OTP', 'Google', 'Apple', 'Guest'],
    default: 'OTP'
  },
  // Local password for non-Firebase/email signups (optional)
  password: {
    type: String,
    select: false
  },
  
  // Guest User Support
  isGuest: {
    type: Boolean,
    default: false
  },
  guestId: {
    type: String,
    sparse: true
  },
  guestCreatedAt: {
    type: Date
  },
  guestExpiresAt: {
    type: Date
  },
  guestConvertedAt: {
    type: Date
  },
  guestConvertedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Tier & Rewards
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold'],
    default: 'bronze'
  },
  tierProgress: {
    currentMonthOrders: { type: Number, default: 0 },
    lastTierUpdate: { type: Date, default: Date.now }
  },
  
  // User Preferences
  preferences: {
    dietaryPreferences: {
      type: [String],
      enum: ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian'],
      default: []
    },
    eatingHabits: {
      type: [String],
      enum: ['jain', 'halal', 'kosher', 'gluten-free', 'dairy-free'],
      default: []
    },
    spiceLevel: {
      type: String,
      enum: ['mild', 'medium', 'spicy', 'extra-spicy'],
      default: 'medium'
    },
    allergens: [String]
  },
  // Latest answers for personalization (single canonical source)
  questionAnswers: {
    hungerLevel: {
      type: String,
      enum: ['little_hungry', 'quite_hungry', 'very_hungry', 'super_hungry'],
      default: null
    },
    mood: {
      type: String,
      enum: ['good', 'angry', 'in_love', 'sad'],
      default: null
    },
    updatedAt: { type: Date, default: null }
  },
  
  // Referral System
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referrals: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dateReferred: { type: Date, default: Date.now },
    rewardClaimed: { type: Boolean, default: false }
  }],
  // Tracks coupons issued as part of referrals for this user
  referralCoupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }],
  // Count of successful referrals (helps enforce limits)
  referralCount: { type: Number, default: 0 },
  
  // Profile
  profilePicture: {
    type: String,
    default: "" // Default empty string for users without a profile picture
  },
  locations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  
  // Favorites & Carts (simplified - no restaurant/chef)
  favorites: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeCarts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart'
  }],
  
  // User Role (simplified for single cafe)
  role: {
    type: String,
    enum: ['user'],
    default: 'user'
  },
  
  // Order Statistics
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  
  // Account Status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blocked'],
    default: 'Active'
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // Notifications
  notificationPreferences: {
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    newItems: { type: Boolean, default: true }
  },
  fcmToken: {
    type: String,
    default: null
  },
  fcmTokenLastUpdated: {
    type: Date,
    default: null
  },
  subscribedTopics: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
});

// Indexes for performance
// Note: some fields use inline `unique: true` / `index` at the path level.
// Removed duplicate schema-level indexes for fields that already declare indexes inline
// to avoid duplicate index warnings from Mongoose.
userSchema.index({ tier: 1 });
userSchema.index({ isGuest: 1 });
userSchema.index({ guestId: 1 }, { sparse: true });
userSchema.index({ isGuest: 1, guestExpiresAt: 1 });

// TTL index for automatic cleanup of expired guests
userSchema.index(
  { guestExpiresAt: 1 },
  { 
    expireAfterSeconds: 0, 
    partialFilterExpression: { isGuest: true } 
  }
);

// Virtual for full name if needed
userSchema.virtual('displayName').get(function() {
  return this.name || this.phone || this.email || 'Guest User';
});

// Compute ageGroup and ensure unique referralCode on create/save
userSchema.pre('save', async function(next) {
  try {
    // compute ageGroup from birthDate if provided
    if (this.birthDate) {
      this.ageGroup = computeAgeGroup(this.birthDate);
    }

    // if referralCode is missing, generate one and ensure uniqueness
    if (!this.referralCode) {
      const User = mongoose.model('User');
      for (let i = 0; i < 5; i++) {
        const code = shortid.generate().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        // check uniqueness
        // Note: countDocuments is safe here because this runs on save
        const exists = await User.countDocuments({ referralCode: code });
        if (!exists) {
          this.referralCode = code;
          break;
        }
      }
      // fallback
      if (!this.referralCode) this.referralCode = shortid.generate();
    }

    next();
  } catch (err) {
    next(err);
  }
});

// When using findOneAndUpdate, compute ageGroup if birthDate is being updated
userSchema.pre('findOneAndUpdate', function(next) {
  try {
    const update = this.getUpdate();
    if (update && update.birthDate) {
      update.ageGroup = computeAgeGroup(update.birthDate);
      this.setUpdate(update);
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('User', userSchema);
