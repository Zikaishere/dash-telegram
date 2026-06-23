const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  chatId: { type: String, default: '' },
  action: { type: String, default: '' },
  error: { type: String, required: true },
  stack: { type: String, default: '' },
  context: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('ErrorLog', errorLogSchema);
