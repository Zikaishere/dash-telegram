async function handler(bot, msg) {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';

  await bot.sendMessage(
    chatId,
    `Hello ${firstName}! I'm Dash, your personal AI assistant.

I can help you with tasks, answer questions, set reminders, and keep track of your projects and goals. Just send me a message.

Commands:
/start - Show this message
/help - Get help and usage info
/reset - Clear our conversation history

Let's get started!`,
  );
}

module.exports = { handler, command: 'start' };
