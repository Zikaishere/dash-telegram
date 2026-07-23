const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  goals: {
    calories: { type: Number, default: 2000 },
    protein: { type: Number, default: 150 },
    carbs: { type: Number, default: 200 },
    fat: { type: Number, default: 70 },
  },
  weightGoal: { type: Number },
  units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  timezone: { type: String, default: 'Africa/Cairo' },
  streak: { type: Number, default: 0 },
  lastLoggedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userProfileSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserProfile', userProfileSchema);