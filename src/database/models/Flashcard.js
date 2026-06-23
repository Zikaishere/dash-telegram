const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  topic: { type: String, default: 'general' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

flashcardSchema.index({ userId: 1, topic: 1 });

module.exports = mongoose.model('Flashcard', flashcardSchema);
