async function handler(bot, msg) {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    `*Dash - Personal AI Assistant*\n\nI'm powered by OpenRouter AI and keep our conversation history so I can remember context.\n\n*Commands:*\n/start - Welcome message\n/help - Show this help\n/reset - Clear our conversation history\n\n*Tips:*\n- Ask me anything, I'm here to help!\n- I remember our past messages (up to 25) for context\n- Use /reset to start fresh\n\n*About:*\nI store your conversation history securely so I can provide personalized assistance. Messages are stored per user and are private.`,
    { parse_mode: 'Markdown' },
  );
}

module.exports = { handler, command: 'help' };
