async function handler(bot, msg, Conversation) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  try {
    await Conversation.findOneAndUpdate(
      { userId },
      { $set: { messages: [], 'metadata.tone': '' } },
    );
    await bot.sendMessage(
      chatId,
      'Conversation history cleared and tone reset. Your profile, timezone, and saved notes are kept.',
    );
  } catch (error) {
    console.error('Error resetting conversation:', error);
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t clear the history. Please try again.');
  }
}

module.exports = { handler, command: 'reset' };
