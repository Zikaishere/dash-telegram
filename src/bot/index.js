const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Conversation = require('../database/models/Conversation');
const { generateWithTools } = require('../services/openrouter');
const commandHandlers = require('../commands');
const toolRegistry = require('../tools');
const { checkRateLimit } = require('../middleware/rateLimiter');
const { loadProfile, shouldUpdate, updateProfile } = require('../services/profileService');

let bot;

async function getUserTimezone(userId) {
  try {
    const convo = await Conversation.findOne({ userId });
    if (convo && convo.metadata && convo.metadata.get) {
      return convo.metadata.get('timezone') || 'Africa/Cairo';
    }
  } catch {
    // fall through
  }
  return 'Africa/Cairo';
}

async function startBot() {
  bot = new TelegramBot(config.telegramToken, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = String(msg.from.id);

    if (!text) return;

    if (!checkRateLimit(userId)) {
      return;
    }

    const commandMatch = text.match(/^\/(\w+)/);
    if (commandMatch) {
      const command = commandMatch[1].toLowerCase();
      const handler = commandHandlers[command];
      if (handler) {
        await handler(bot, msg, Conversation);
      }
      return;
    }

    try {
      await bot.sendChatAction(chatId, 'typing');

      const timezone = await getUserTimezone(userId);

      let conversation = await Conversation.findOne({ userId });
      if (!conversation) {
        conversation = new Conversation({ userId, messages: [] });
      }

      const profile = await loadProfile(userId);

      conversation.messages.push({
        role: 'user',
        content: text,
        timestamp: new Date(),
      });

      const recentMessages = conversation.messages.slice(-config.maxContextMessages);
      const openaiMessages = recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userContext = `User ID: ${userId}\nTimezone: ${timezone}`;

      const response = await generateWithTools(openaiMessages, toolRegistry, userContext, profile);

      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      await conversation.save();

      if (await shouldUpdate(conversation)) {
        updateProfile(userId, conversation, profile);
      }

      await bot.sendMessage(chatId, response);
    } catch (error) {
      console.error('Error processing message:', error);
      await bot.sendMessage(chatId, 'Sorry, I encountered an error processing your message. Please try again.');
    }
  });

  bot.on('polling_error', (error) => {
    console.error('Telegram polling error:', error);
  });

  bot.on('webhook_error', (error) => {
    console.error('Telegram webhook error:', error);
  });

  console.log('Bot is running...');
  return bot;
}

function getBot() {
  return bot;
}

module.exports = { startBot, getBot };
