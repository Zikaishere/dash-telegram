async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';

  await bot.sendMessage(
    chatId,
    `Hello ${firstName}! 👋\n\nI'm **Dash**, your personal AI assistant.\n\nI can help you with tasks, answer questions, and keep track of your projects and goals. Just send me a message and I'll do my best to help.\n\n*Available Commands:*\n/start - Show this message\n/help - Get help and usage info\n/reset - Clear our conversation history\n\nLet's get started!`,
    { parse_mode: 'Markdown' },
  );
}

module.exports = { handler, command: 'start' };
