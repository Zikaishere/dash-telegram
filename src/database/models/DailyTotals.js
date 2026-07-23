const mongoose = require('mongoose');

const dailyTotalsSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  totals: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  goals: {
    calories: { type: Number, default: 2000 },
    protein: { type: Number, default: 150 },
    carbs: { type: Number, default: 200 },
    fat: { type: Number, default: 70 },
  },
  mealsCount: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  weight: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

dailyTotalsSchema.index({ userId: 1, date: -1 });
dailyTotalsSchema.index({ userId: 1, date: 1 }, { unique: true });

dailyTotalsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('DailyTotals', dailyTotalsSchema);