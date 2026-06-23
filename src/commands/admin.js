const config = require('../config');
const Conversation = require('../database/models/Conversation');
const Reminder = require('../database/models/Reminder');
const Note = require('../database/models/Note');
const ErrorLog = require('../database/models/ErrorLog');

function isAdmin(userId) {
  return config.adminIds.includes(userId);
}

const statsHandler = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  if (!isAdmin(userId)) return;

  try {
    const [userCount, noteCount, reminderCount, pendingReminders, errorCount] = await Promise.all([
      Conversation.countDocuments({}),
      Note.countDocuments({}),
      Reminder.countDocuments({}),
      Reminder.countDocuments({ notified: false }),
      ErrorLog.countDocuments({}),
    ]);

    await bot.sendMessage(
      chatId,
      `Stats:\nUsers: ${userCount}\nNotes: ${noteCount}\nReminders (total): ${reminderCount}\nReminders (pending): ${pendingReminders}\nErrors (logged): ${errorCount}\n\nSee /diagnostics for full health report.`,
    );
  } catch (err) {
    console.error('Error getting stats:', err);
    await bot.sendMessage(chatId, 'Error fetching stats.');
  }
};

const broadcastHandler = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  if (!isAdmin(userId)) return;

  const text = msg.text;
  const message = text.split(/\s+/).slice(1).join(' ').trim();

  if (!message) {
    await bot.sendMessage(chatId, 'Send: /broadcast <message>');
    return;
  }

  try {
    const users = await Conversation.find({}, { userId: 1 });
    let sent = 0;

    for (const user of users) {
      try {
        await bot.sendMessage(user.userId, `[Broadcast]\n\n${message}`);
        sent++;
      } catch {
        // user may have blocked the bot
      }
    }

    await bot.sendMessage(chatId, `Broadcast sent to ${sent} of ${users.length} users.`);
  } catch (err) {
    console.error('Error broadcasting:', err);
    await bot.sendMessage(chatId, 'Error sending broadcast.');
  }
};

const handlers = {
  stats: statsHandler,
  broadcast: broadcastHandler,
};

// Export both so we can match on subcommand
module.exports = handlers;
