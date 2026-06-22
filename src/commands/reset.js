async function handler(bot, msg, Conversation) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  try {
    await Conversation.findOneAndDelete({ userId });
    await bot.sendMessage(
      chatId,
      '✅ Our conversation history has been cleared. We\'re starting fresh!',
    );
  } catch (error) {
    console.error('Error resetting conversation:', error);
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t clear the history. Please try again.');
  }
}

module.exports = { handler, command: 'reset' };
