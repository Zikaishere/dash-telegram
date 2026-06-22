const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
  },
  remindAt: {
    type: Date,
    required: true,
    index: true,
  },
  notified: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Reminder', reminderSchema);
