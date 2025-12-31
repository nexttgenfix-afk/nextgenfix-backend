const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Business Hours Configuration
  businessHours: {
    monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, isClosed: { type: Boolean, default: false } }
  },
  // Business Information
  business: {
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' },
    logo: { type: String, default: '' }
  },
  
  // Tax Configuration
  taxInfo: {
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    serviceTax: { type: Number, default: 0, min: 0, max: 100 },
    packagingCharge: { type: Number, default: 0, min: 0 }
  },
  
  // Delivery Configuration
  deliveryCharges: {
    baseFee: { type: Number, default: 0, min: 0 },
    perKm: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    freeDeliveryThreshold: { type: Number, default: 0, min: 0 },
    maxDeliveryDistance: { type: Number, default: 10, min: 0 } // in km
  },
  
  // Customer Tier Configuration
  tierConfig: {
    bronze: {
      minOrders: { type: Number, default: 0 },
      discount: { type: Number, default: 0, min: 0, max: 100 }
    },
    silver: {
      minOrders: { type: Number, default: 5 },
      discount: { type: Number, default: 5, min: 0, max: 100 }
    },
    gold: {
      minOrders: { type: Number, default: 15 },
      discount: { type: Number, default: 10, min: 0, max: 100 }
    },
    
  },
  
  // Referral Program Configuration
  referralConfig: {
    enabled: { type: Boolean, default: false },
    referrerReward: { type: Number, default: 0, min: 0 },
    refereeReward: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    // How many referrals a single referrer can receive before being blocked
    maxReferrals: { type: Number, default: 5, min: 0 },
    // Default validity for coupons created via referrals (in days)
    validityDays: { type: Number, default: 30, min: 1 }
  },
  
  // Scheduling Configuration
  schedulingConfig: {
    allowPreOrders: { type: Boolean, default: true },
    maxDaysInAdvance: { type: Number, default: 7, min: 1 },
    slotDuration: { type: Number, default: 30, min: 15 }, // in minutes
    allowTableReservation: { type: Boolean, default: true }
  },
  
  // App Configuration (Public)
  appConfig: {
    appName: { type: String, default: 'NextGenFix' },
    supportEmail: { type: String },
    supportPhone: { type: String },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' }
  },
  
  // Singleton pattern - only one settings document
  settingsId: {
    type: String,
    default: 'app-settings',
    unique: true
  }
}, {
  timestamps: true
});

// Static method to get or create settings
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ settingsId: 'app-settings' });
  
  if (!settings) {
    settings = await this.create({
      settingsId: 'app-settings',
      businessHours: {
        monday: { open: '09:00', close: '22:00', isClosed: false },
        tuesday: { open: '09:00', close: '22:00', isClosed: false },
        wednesday: { open: '09:00', close: '22:00', isClosed: false },
        thursday: { open: '09:00', close: '22:00', isClosed: false },
        friday: { open: '09:00', close: '22:00', isClosed: false },
        saturday: { open: '09:00', close: '22:00', isClosed: false },
        sunday: { open: '09:00', close: '22:00', isClosed: false }
      }
      ,
      business: {
        name: '',
        description: '',
        phone: '',
        email: '',
        address: '',
        website: '',
        logo: ''
      }
    });
  }
  
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
