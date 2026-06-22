const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Conversation = require('../database/models/Conversation');
const { generateWithTools } = require('../services/openrouter');
const commandHandlers = require('../commands');
const toolRegistry = require('../tools');

let bot;

async function startBot() {
  bot = new TelegramBot(config.telegramToken, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

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

      let conversation = await Conversation.findOne({ userId: String(msg.from.id) });
      if (!conversation) {
        conversation = new Conversation({ userId: String(msg.from.id), messages: [] });
      }

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

      const userContext = `User ID: ${msg.from.id}\nTimezone: Africa/Cairo (Egypt)`;

      const response = await generateWithTools(openaiMessages, toolRegistry, userContext);

      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      await conversation.save();

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
