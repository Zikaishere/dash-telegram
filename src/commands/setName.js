const Conversation = require('../database/models/Conversation');

async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const args = msg.text.split(/\s+/).slice(1);
  const name = args.join(' ').trim();

  if (!name) {
    await bot.sendMessage(chatId, 'Send: /set_name YourName\n\nThis is how I will address you.');
    return;
  }

  await Conversation.findOneAndUpdate(
    { userId },
    { $set: { 'metadata.userName': name } },
    { upsert: true },
  );

  await bot.sendMessage(chatId, `Got it! I'll call you ${name} from now on.`);
}

module.exports = { handler, command: 'set_name' };
