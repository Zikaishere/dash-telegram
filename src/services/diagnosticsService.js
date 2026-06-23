const ErrorLog = require('../database/models/ErrorLog');
const Conversation = require('../database/models/Conversation');
const Reminder = require('../database/models/Reminder');
const Note = require('../database/models/Note');
const os = require('os');

const startTime = Date.now();

let messageCount = 0;

function incrementMessageCount() {
  messageCount++;
}

function getUptime() {
  const secs = Math.floor((Date.now() - startTime) / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

async function getDashboard() {
  const [errorCount, recentErrors, userCount, noteCount, reminderCount, pendingReminders] = await Promise.all([
    ErrorLog.countDocuments({}),
    ErrorLog.find().sort({ timestamp: -1 }).limit(5).lean(),
    Conversation.countDocuments({}),
    Note.countDocuments({}),
    Reminder.countDocuments({}),
    Reminder.countDocuments({ notified: false }),
  ]);

  return {
    uptime: getUptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    messagesProcessed: messageCount,
    errorCount,
    recentErrors: recentErrors.map(e => `[${e.timestamp.toISOString().slice(0, 19)}] ${e.error.slice(0, 120)}`),
    dbStats: {
      users: userCount,
      notes: noteCount,
      reminders: reminderCount,
      pendingReminders,
    },
  };
}

async function logError({ userId, chatId, action, error, context }) {
  try {
    const err = new ErrorLog({
      userId: userId || '',
      chatId: chatId || '',
      action: action || '',
      error: error?.message || String(error),
      stack: error?.stack?.slice(0, 500) || '',
      context: context || '',
    });
    await err.save();

    if (errorCountExceedsThreshold()) {
      console.warn(`Error count threshold reached: ${await ErrorLog.countDocuments({})} total errors`);
    }
  } catch {
    // fail silently — logging should never crash the bot
  }
}

let thresholdChecked = false;
async function errorCountExceedsThreshold() {
  if (thresholdChecked) return false;
  const count = await ErrorLog.countDocuments({});
  if (count > 50) {
    thresholdChecked = true;
    return true;
  }
  return false;
}

module.exports = { getDashboard, logError, incrementMessageCount };
