const GenerateTimetableTool = require('../tools/timetable');

const timetableTool = new GenerateTimetableTool();

async function handler(bot, msg, Conversation) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text.trim();
  const args = text.slice('/timetable'.length).trim().split(/\s+/);
  const range = args[0] || 'week';

  if (!['week', 'today', 'month'].includes(range)) {
    await bot.sendMessage(chatId, 'Usage: /timetable [week|today|month]');
    return;
  }

  try {
    await bot.sendChatAction(chatId, 'upload_document');
    const result = await timetableTool.execute({ userId, range });
    await bot.sendMessage(chatId, result);
  } catch (error) {
    console.error('Error generating timetable:', error);
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t generate the timetable.');
  }
}

module.exports = { handler, command: 'timetable' };
