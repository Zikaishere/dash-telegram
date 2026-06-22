async function handler(bot, msg) {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    `Dash - Personal AI Assistant

I'm powered by OpenRouter AI and keep our conversation history so I can remember context.

Commands:
/start - Welcome message
/help - Show this help
/reset - Clear our conversation history

Tips:
- Ask me anything, I'm here to help!
- I remember our past messages (up to 25) for context
- You can ask me to set reminders (e.g. "remind me to buy groceries tomorrow at 5pm")
- Use /reset to start fresh

About:
I store your conversation history securely so I can provide personalized assistance. Messages are stored per user and are private.`,
  );
}

module.exports = { handler, command: 'help' };
