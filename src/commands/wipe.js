const Conversation = require('../database/models/Conversation');
const Reminder = require('../database/models/Reminder');
const Note = require('../database/models/Note');

async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  try {
    await Promise.all([
      Conversation.findOneAndDelete({ userId }),
      Reminder.deleteMany({ userId }),
      Note.deleteMany({ userId }),
    ]);

    await bot.sendMessage(chatId, 'All your data has been permanently deleted: conversation history, notes, reminders, and profile.');
  } catch (error) {
    console.error('Error wiping user data:', error);
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t delete your data. Please try again.');
  }
}

module.exports = { handler, command: 'wipe' };
