const mongoose = require('mongoose');

const kpiCacheSchema = new mongoose.Schema({
  metricName: {
    type: String,
    required: true,
    index: true
  },
  metricKey: {
    type: String, // e.g., 'orders_total_last_30_days', 'revenue_gmv_today'
    required: true,
    unique: true,
    index: true
  },
  metricValue: {
    type: mongoose.Schema.Types.Mixed, // Can be number, object, array
    required: true
  },
  breakdown: {
    type: mongoose.Schema.Types.Mixed, // JSON object with breakdowns (gender, age, location, etc.)
    default: {}
  },
  trend: [{
    period: String, // e.g., '2025-01-01', '2025-W01', '2025-01'
    value: Number,
    change: Number, // percentage change from previous period
    changeDirection: {
      type: String,
      enum: ['up', 'down', 'stable']
    }
  }],
  dateRange: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  calculatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  cacheType: {
    type: String,
    enum: ['realtime', 'hourly', 'daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  isValid: {
    type: Boolean,
    default: true
  },
  metadata: {
    queryTime: Number, // in milliseconds
    dataPoints: Number,
    source: String, // e.g., 'orders_collection', 'users_collection'
    version: {
      type: String,
      default: '1.0'
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
kpiCacheSchema.index({ metricName: 1, calculatedAt: -1 });
// Note: validUntil should only have a TTL index below. Avoid creating a
// regular index on `validUntil` in addition to the TTL index to prevent
// duplicate index warnings from Mongoose.
// kpiCacheSchema.index({ validUntil: 1 }); // removed to avoid duplicate index
kpiCacheSchema.index({ cacheType: 1, isValid: 1 });

// TTL index to automatically remove expired cache entries
kpiCacheSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

// Static method to get valid cached metric
kpiCacheSchema.statics.getValidCache = function(metricKey) {
  return this.findOne({
    metricKey,
    isValid: true,
    validUntil: { $gt: new Date() }
  });
};

// Static method to invalidate cache by pattern
kpiCacheSchema.statics.invalidateByPattern = function(pattern) {
  return this.updateMany(
    { metricKey: { $regex: pattern }, isValid: true },
    { $set: { isValid: false } }
  );
};

module.exports = mongoose.model('KPICache', kpiCacheSchema);