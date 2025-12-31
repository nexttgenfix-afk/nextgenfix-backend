const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Google Maps Integration
  placeId: {
    type: String,
    description: "Google Maps Place ID for this location"
  },
  formattedAddress: {
    type: String,
    description: "Complete formatted address from Google Maps"
  },
  
  // Structured Address Components (from Google Maps)
  addressComponents: {
    street: {
      type: String,
      description: "Street address / route"
    },
    city: {
      type: String,
      description: "City / locality"
    },
    state: {
      type: String,
      description: "State / administrative area"
    },
    postalCode: {
      type: String,
      description: "Postal code / ZIP code"
    },
    country: {
      type: String,
      description: "Country"
    }
  },
  
  // User-Provided Details
  label: {
    type: String,
    description: "Custom name for this location (e.g., 'Jaya's Home', 'My Office')"
  },
  saveAs: {
    type: String,
    enum: ['Home', 'Work', 'Others'],
    default: 'Others',
    description: "Location category"
  },
  flatNumber: {
    type: String,
    required: true,
    description: "Flat/House No/Floor/Building"
  },
  landmark: {
    type: String,
    description: "Nearby landmark for easy identification"
  },
  deliveryInstructions: {
    type: String,
    description: "Special delivery instructions (e.g., 'Ring doorbell twice', 'Call on arrival')"
  },
  
  // Geolocation Data
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;    // latitude
        },
        message: 'Coordinates must be [longitude, latitude] with valid ranges'
      }
    }
  },
  
  // Default Address Management
  isDefault: {
    type: Boolean,
    default: false,
    description: "Whether this is the user's default delivery location"
  },
  
  // Metadata
  lastUsed: {
    type: Date,
    description: "Last time this location was used for an order"
  },
  usageCount: {
    type: Number,
    default: 0,
    description: "Number of times this location has been used"
  }
}, {
  timestamps: true,
});

// Indexes for performance
locationSchema.index({ coordinates: '2dsphere' }); // For geospatial queries
locationSchema.index({ user: 1, isDefault: 1 }); // For efficient default location lookup
locationSchema.index({ user: 1, saveAs: 1 }); // For filtering by category
locationSchema.index({ user: 1, lastUsed: -1 }); // For recently used locations
locationSchema.index({ placeId: 1 }, { sparse: true }); // For Google Maps place lookups

// Ensure only one default address per user
locationSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    try {
      // Unset other default locations for this user
      await this.constructor.updateMany(
        { user: this.user, _id: { $ne: this._id }, isDefault: true },
        { isDefault: false }
      );
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Virtual for display address
locationSchema.virtual('displayAddress').get(function() {
  if (this.label) return this.label;
  if (this.formattedAddress) return this.formattedAddress;
  if (this.addressComponents?.street) {
    const { street, city } = this.addressComponents;
    return `${street}${city ? ', ' + city : ''}`;
  }
  return 'Saved Location';
});

// Method to increment usage
locationSchema.methods.recordUsage = async function() {
  this.lastUsed = new Date();
  this.usageCount += 1;
  return this.save();
};

module.exports = {
  locationSchema,
  Location: mongoose.model('Location', locationSchema)
};
