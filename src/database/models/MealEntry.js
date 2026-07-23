const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  unit: {
    type: String,
    enum: ['g', 'ml', 'oz', 'cup', 'piece', 'slice', 'tbsp', 'tsp'],
    default: 'g',
  },
  calories: { type: Number, required: true },
  protein: { type: Number, required: true },
  carbs: { type: Number, required: true },
  fat: { type: Number, required: true },
  isEstimate: { type: Boolean, default: false },
  source: {
    type: String,
    enum: ['text', 'photo', 'voice', 'barcode'],
    default: 'text',
  },
}, { _id: false });

const mealEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    default: 'snack',
  },
  foods: [foodItemSchema],
  totals: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  notes: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  voiceTranscript: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

mealEntrySchema.index({ userId: 1, date: -1 });
mealEntrySchema.index({ userId: 1, mealType: 1, date: -1 });

mealEntrySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  // Calculate totals from foods
  if (this.foods && this.foods.length > 0) {
    this.totals = this.foods.reduce((acc, food) => ({
      calories: acc.calories + (food.calories || 0),
      protein: acc.protein + (food.protein || 0),
      carbs: acc.carbs + (food.carbs || 0),
      fat: acc.fat + (food.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }
  next();
});

module.exports = mongoose.model('MealEntry', mealEntrySchema);