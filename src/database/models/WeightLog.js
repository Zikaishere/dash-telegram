const mongoose = require('mongoose');

const weightLogSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  weight: { type: Number, required: true }, // kg
  bodyFat: { type: Number }, // percentage, optional
  notes: { type: String, default: '' },
  source: {
    type: String,
    enum: ['text', 'scale'],
    default: 'text',
  },
  createdAt: { type: Date, default: Date.now },
});

weightLogSchema.index({ userId: 1, date: -1 });
weightLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WeightLog', weightLogSchema);