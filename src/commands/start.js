async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';

  await bot.sendMessage(
    chatId,
    `Hello ${firstName}! I'm Dash, your personal AI assistant.

I can help you with tasks, answer questions, set reminders, check weather, search the web, and remember things about you. Just send a message.

Commands:
/start - Show this message
/help - Get help and usage info
/reset - Clear conversation history
/timezone TZ - Set your timezone
/set_name Name - Set how I address you
/set_tone Tone - Change my response style
/wipe - Delete all your data

Let's get started!`,
  );
}

module.exports = { handler, command: 'start' };
