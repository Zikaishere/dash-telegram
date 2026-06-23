const config = require('../config');
const { getDashboard } = require('../services/diagnosticsService');

async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  if (!config.adminIds.includes(userId)) return;

  try {
    const dash = await getDashboard();

    const text = [
      'Diagnostics',
      `Uptime: ${dash.uptime}`,
      `Host: ${dash.hostname} (${dash.platform})`,
      `Memory: ${dash.memory}`,
      `Messages: ${dash.messagesProcessed}`,
      `Errors: ${dash.errorCount}`,
      '',
      'DB Stats:',
      `  Users: ${dash.dbStats.users}`,
      `  Notes: ${dash.dbStats.notes}`,
      `  Reminders: ${dash.dbStats.reminders} (${dash.dbStats.pendingReminders} pending)`,
      '',
      'Recent Errors:',
      ...(dash.recentErrors.length ? dash.recentErrors.map(e => `  ${e}`) : ['  (none)']),
    ].join('\n');

    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error('Error generating diagnostics:', err);
    await bot.sendMessage(chatId, 'Error generating diagnostics.');
  }
}

module.exports = { handler, command: 'diagnostics' };
