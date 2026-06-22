async function handler(bot, msg) {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    `Dash - Personal AI Assistant

I'm powered by OpenRouter AI and keep our conversation history.

Commands:
/start - Welcome message
/help - Show this help
/reset - Clear our conversation history
/timezone TZ - Set your timezone (e.g. /timezone Africa/Cairo)

Things I can do:
- Answer questions and have conversations
- Set reminders at specific times (e.g. "remind me to buy groceries tomorrow at 5pm")
- Set timers (e.g. "set a timer for 10 minutes")
- Check weather for any city (e.g. "what's the weather in Cairo?")
- Search the web for current info
- Remember things about you (project details, preferences, etc.)

Tips:
- Your timezone defaults to Africa/Cairo — use /timezone to change it
- I remember our past messages for context
- Use /reset to start a fresh conversation`,
  );
}

module.exports = { handler, command: 'help' };
