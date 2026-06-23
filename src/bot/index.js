const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Conversation = require('../database/models/Conversation');
const { generateWithTools } = require('../services/openrouter');
const commandHandlers = require('../commands');
const toolRegistry = require('../tools');
const { checkRateLimit } = require('../middleware/rateLimiter');
const { loadProfile, shouldUpdate, updateProfile } = require('../services/profileService');
const { parseFile } = require('../services/fileParser');
const { logError, incrementMessageCount } = require('../services/diagnosticsService');

const MAX_MSG_LEN = 4000;

async function sendLongMessage(chatId, text) {
  if (text.length <= MAX_MSG_LEN) {
    await bot.sendMessage(chatId, text);
    return;
  }

  let remaining = text;
  while (remaining) {
    if (remaining.length <= MAX_MSG_LEN) {
      await bot.sendMessage(chatId, remaining.trim());
      break;
    }

    let splitAt = remaining.lastIndexOf('\n\n', MAX_MSG_LEN);
    if (splitAt < MAX_MSG_LEN / 2) splitAt = remaining.lastIndexOf('\n', MAX_MSG_LEN);
    if (splitAt < MAX_MSG_LEN / 2) splitAt = remaining.lastIndexOf(' ', MAX_MSG_LEN);
    if (splitAt < MAX_MSG_LEN / 2) splitAt = MAX_MSG_LEN;

    const chunk = remaining.slice(0, splitAt).trim();
    remaining = remaining.slice(splitAt);

    if (chunk) await bot.sendMessage(chatId, chunk);
  }
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^###\s/gm, '')
    .replace(/^##\s/gm, '')
    .replace(/^#\s/gm, '')
    .replace(/^>\s/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

let bot;

async function getMetadata(conversation, key, fallback) {
  if (conversation && conversation.metadata && conversation.metadata.get) {
    const val = conversation.metadata.get(key);
    return val || fallback;
  }
  return fallback;
}

function keepTyping(chatId) {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, 3500);
  return () => clearInterval(interval);
}

async function processConversation(userId, chatId, userContent, isResearch, imageUrl) {
  const stopTyping = keepTyping(chatId);

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

  if (imageUrl) {
    const last = openaiMessages[openaiMessages.length - 1];
    if (last && last.role === 'user') {
      last.content = [
        { type: 'text', text: String(last.content) },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
      ];
    }
  }

  let userContext = `User ID: ${userId}\nTimezone: ${timezone}`;
  if (isResearch) {
    userContext +=
      '\n\nResearch Mode: ON\n' +
      'Deeply research the user\'s query. Use web_search multiple times from different angles to gather comprehensive information. ' +
      'Then compile everything into a thorough, well-structured report. ' +
      'CRITICAL: You MUST call create_pdf to send the report as a PDF. Do NOT output the report content as text. ' +
      'After calling create_pdf, reply with a short confirmation like "PDF report sent."';
  }

  const maxTokens = isResearch ? 16000 : undefined;
  const response = await generateWithTools(
    openaiMessages, toolRegistry, userContext, profile, userName, tone, maxTokens, imageUrl ? config.visionModel : undefined,
  );

  conversation.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date(),
  });

  await conversation.save();

  if (await shouldUpdate(conversation)) {
    updateProfile(userId, conversation, profile);
  }

  stopTyping();
  return response;
}

async function startBot() {
  bot = new TelegramBot(config.telegramToken, {
    polling: {
      interval: 2000,
      params: {
        timeout: 35,
      },
    },
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || msg.caption;
    const userId = String(msg.from.id);

    incrementMessageCount();

    if (msg.photo) {
      if (!checkRateLimit(userId)) return;
      if (text && text.startsWith('/')) {
        const commandMatch = text.match(/^\/(\w+)/);
        if (commandMatch) {
          const handler = commandHandlers[commandMatch[1].toLowerCase()];
          if (handler) { await handler(bot, msg, Conversation); }
          return;
        }
      }
      await handlePhoto(bot, msg, text);
      return;
    }

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
      const isResearch = text.startsWith('DRESEARCH');
      const cleanText = isResearch ? text.slice('DRESEARCH'.length).trim() : text;

      const response = stripMarkdown(await processConversation(userId, chatId, cleanText, isResearch));
      await sendLongMessage(chatId, response);
    } catch (error) {
      console.error('Error processing message:', error);
      logError({ userId, chatId, action: 'processMessage', error, context: text.slice(0, 200) });
      await bot.sendMessage(chatId, 'Sorry, I encountered an error processing your message. Please try again.');
    }
  });

  bot.on('polling_error', async (error) => {
    console.error('Telegram polling error:', error.message);
    logError({ action: 'pollingError', error, context: error.code });

    if (error.code === 'EFATAL' || error.message.includes('ECONNRESET')) {
      try {
        await bot.stopPolling();
      } catch {
        // already stopped
      }
      setTimeout(() => {
        bot.startPolling().catch((e) => console.error('Polling restart failed:', e.message));
      }, 3000);
    }
  });

  bot.on('webhook_error', (error) => {
    console.error('Telegram webhook error:', error);
  });

  console.log('Bot is running...');
  return bot;
}

async function handlePhoto(bot, msg, caption) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  try {
    const photo = msg.photo[msg.photo.length - 1];
    const file = await bot.getFile(photo.file_id);
    const imageUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;

    const text = caption || 'Analyze this image. If it shows food, estimate the calories and macros, then log it with log_meal. Otherwise describe what you see.';
    const response = stripMarkdown(await processConversation(userId, chatId, text, false, imageUrl));
    await sendLongMessage(chatId, response);
  } catch (error) {
    console.error('Error processing photo:', error);
    logError({ userId, chatId, action: 'handlePhoto', error });
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t process that image.');
  }
}

async function handleDocument(bot, msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  if (!checkRateLimit(userId)) return;

  try {
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
    const response = stripMarkdown(await processConversation(userId, chatId, preamble + extracted));
    await sendLongMessage(chatId, response);
  } catch (error) {
    console.error('Error processing document:', error);
    logError({ userId, chatId, action: 'handleDocument', error, context: msg.document?.file_name });
    await bot.sendMessage(chatId, 'Sorry, I couldn\'t read that file.');
  }
}

function getBot() {
  return bot;
}

module.exports = { startBot, getBot };
