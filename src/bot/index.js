const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Conversation = require('../database/models/Conversation');
const { generateWithTools } = require('../services/openrouter');
const commandHandlers = require('../commands');
const toolRegistry = require('../tools');
const { checkRateLimit } = require('../middleware/rateLimiter');
const { loadProfile, shouldUpdate, updateProfile } = require('../services/profileService');
const { parseFile } = require('../services/fileParser');

let bot;

async function getMetadata(conversation, key, fallback) {
  if (conversation && conversation.metadata && conversation.metadata.get) {
    const val = conversation.metadata.get(key);
    return val || fallback;
  }
  return fallback;
}

async function processConversation(userId, chatId, userContent) {
  await bot.sendChatAction(chatId, 'typing');

  const timezone = await getMetadata(
    await Conversation.findOne({ userId }).catch(() => null),
    'timezone',
    'Africa/Cairo',
  );

  let conversation = await Conversation.findOne({ userId });
  if (!conversation) {
    conversation = new Conversation({ userId, messages: [] });
  }

  const profile = await loadProfile(userId);
  const userName = await getMetadata(conversation, 'userName', null);
  const tone = await getMetadata(conversation, 'tone', null);

  conversation.messages.push({
    role: 'user',
    content: userContent,
    timestamp: new Date(),
  });

  const recentMessages = conversation.messages.slice(-config.maxContextMessages);
  const openaiMessages = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const userContext = `User ID: ${userId}\nTimezone: ${timezone}`;

  const response = await generateWithTools(openaiMessages, toolRegistry, userContext, profile, userName, tone);

  conversation.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date(),
  });

  await conversation.save();

  if (await shouldUpdate(conversation)) {
    updateProfile(userId, conversation, profile);
  }

  return response;
}

async function startBot() {
  bot = new TelegramBot(config.telegramToken, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = String(msg.from.id);

    if (!text) {
      if (msg.document) {
        await handleDocument(bot, msg);
      }
      return;
    }

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
      const response = await processConversation(userId, chatId, text);
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

async function handleDocument(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  if (!checkRateLimit(userId)) return;

  try {
    await bot.sendChatAction(chatId, 'typing');

    const file = await bot.getFile(msg.document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;

    const res = await fetch(fileUrl);
    const buffer = Buffer.from(await res.arrayBuffer());

    const extracted = await parseFile(buffer, msg.document.mime_type, msg.document.file_name);

    if (extracted === null) {
      await bot.sendMessage(chatId, `Sorry, I can only read .txt, .pdf, and .docx files.`);
      return;
    }

    const preamble = `I uploaded a file (${msg.document.file_name}):\n\n`;
    const response = await processConversation(userId, chatId, preamble + extracted);
    await bot.sendMessage(chatId, response);
  } catch (error) {
    console.error('Error processing document:', error);
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t read that file.');
  }
}

function getBot() {
  return bot;
}

module.exports = { startBot, getBot };
