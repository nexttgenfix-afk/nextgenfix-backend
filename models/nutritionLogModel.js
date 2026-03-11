const mongoose = require('mongoose');

// One document per user per day
const nutritionLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: String, // 'YYYY-MM-DD' — easy daily lookup & grouping
    required: true
  },
  consumed: {
    calories: { type: Number, default: 0 },
    protein:  { type: Number, default: 0 },
    carbs:    { type: Number, default: 0 },
    fat:      { type: Number, default: 0 },
    fiber:    { type: Number, default: 0 },
    sugar:    { type: Number, default: 0 }
  },
  // Orders that contributed to this log
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  // Whether user stayed within calorieGoal that day
  withinGoal: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

nutritionLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);
