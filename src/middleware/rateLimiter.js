const mongoose = require('mongoose');
const config = require('../config');

const rateLimitSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  windowStart: { type: Date, required: true, index: true },
  count: { type: Number, default: 0 },
}, { timestamps: true });

rateLimitSchema.index({ userId: 1, windowStart: 1 }, { unique: true });

const RateLimit = mongoose.model('RateLimit', rateLimitSchema);

const WINDOW_MS = 5000;
const MAX_REQUESTS = 4;

async function checkRateLimit(userId) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  
  try {
    const result = await RateLimit.findOneAndUpdate(
      { userId, windowStart: { $gte: windowStart } },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    return result.count <= MAX_REQUESTS;
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key - another request got there first, retry
      const existing = await RateLimit.findOne({ userId, windowStart: { $gte: windowStart } });
      if (existing) {
        existing.count += 1;
        await existing.save();
        return existing.count <= MAX_REQUESTS;
      }
      return false;
    }
    console.error('Rate limit error:', error);
    return true; // Fail open
  }
}

function clearRateLimit(userId) {
  return RateLimit.deleteMany({ userId });
}

// Cleanup old rate limit entries periodically
setInterval(async () => {
  const cutoff = new Date(Date.now() - WINDOW_MS * 2);
  await RateLimit.deleteMany({ windowStart: { $lt: cutoff } });
}, 60000);

module.exports = { checkRateLimit, clearRateLimit };