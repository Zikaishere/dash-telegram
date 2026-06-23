async function handler(bot, msg, Conversation) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  const conversation = await Conversation.findOne({ userId });
  if (!conversation) {
    await bot.sendMessage(chatId, 'Please send a message first to start a conversation.');
    return;
  }

  const current = conversation.metadata?.studyMode === true;
  await Conversation.findOneAndUpdate(
    { userId },
    { $set: { 'metadata.studyMode': !current } },
  );

  if (current) {
    await bot.sendMessage(chatId, 'Study mode is now OFF. I no longer proactively quiz you.');
  } else {
    await bot.sendMessage(chatId, 'Study mode is now ON. I will quiz you on your flashcards, suggest Pomodoro timers, and help you study.');
  }
}

module.exports = { handler, command: 'study' };
