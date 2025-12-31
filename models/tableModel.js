const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    enum: [2, 4, 6, 8]
  },
  location: {
    type: String,
    required: true,
    enum: ['Indoor', 'Outdoor', 'Private Room', 'Rooftop', 'Balcony', 'Garden', 'VIP Section']
  },
  features: [{
    type: String
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  qrCode: {
    type: String,
    unique: true,
    sparse: true
  },
  currentStatus: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'maintenance'],
    default: 'available'
  },
  reservations: [{
    date: {
      type: Date,
      required: true
    },
    timeSlot: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Number of guests for this reservation
    guestCount: {
      type: Number,
      default: 1,
      min: 1
    },
    // When the reservation was created
    createdAt: {
      type: Date,
      default: Date.now
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    status: {
      type: String,
      enum: ['reserved', 'occupied', 'completed', 'cancelled'],
      default: 'reserved'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
tableSchema.index({ currentStatus: 1, isAvailable: 1 });

// Method to check if table is available at a specific date/time
tableSchema.methods.isAvailableAt = function(date, timeSlot) {
  if (!this.isAvailable || this.currentStatus === 'maintenance') {
    return false;
  }
  
  const reservation = this.reservations.find(r => 
    r.date.toDateString() === new Date(date).toDateString() &&
    r.timeSlot === timeSlot &&
    r.status === 'reserved'
  );
  
  return !reservation;
};

module.exports = mongoose.model('Table', tableSchema);
