const Conversation = require('../database/models/Conversation');

const VALID_TONES = ['casual', 'professional', 'concise', 'detailed'];

async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const args = msg.text.split(/\s+/).slice(1);
  const tone = (args[0] || '').toLowerCase();

  if (!tone || !VALID_TONES.includes(tone)) {
    await bot.sendMessage(
      chatId,
      `Send: /set_tone <tone>\n\nAvailable tones: ${VALID_TONES.join(', ')}\n\nYour current tone is set. Use /set_tone default to reset to normal.`,
    );
    return;
  }

  if (tone === 'default') {
    await Conversation.findOneAndUpdate(
      { userId },
      { $set: { 'metadata.tone': '' } },
      { upsert: true },
    );
    await bot.sendMessage(chatId, 'Tone reset to default.');
    return;
  }

  await Conversation.findOneAndUpdate(
    { userId },
    { $set: { 'metadata.tone': tone } },
    { upsert: true },
  );

  await bot.sendMessage(chatId, `Tone set to "${tone}".`);
}

module.exports = { handler, command: 'set_tone' };
