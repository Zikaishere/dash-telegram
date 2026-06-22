const userTimestamps = new Map();

const WINDOW_MS = 5000;
const MAX_REQUESTS = 4;

function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = userTimestamps.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    return false;
  }

  recent.push(now);
  userTimestamps.set(userId, recent);
  return true;
}

function clearRateLimit(userId) {
  userTimestamps.delete(userId);
}

module.exports = { checkRateLimit, clearRateLimit };
