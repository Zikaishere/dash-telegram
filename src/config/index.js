require('dotenv').config();

const config = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.MODEL || 'openai/gpt-4o-mini',
  visionModel: process.env.VISION_MODEL || process.env.MODEL || 'openai/gpt-4o-mini',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/assistant',
  port: parseInt(process.env.PORT, 10) || 3000,
  maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) || 25,
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  siteUrl: process.env.SITE_URL || 'https://github.com/your-username/telegram-ai-assistant',
  siteName: process.env.SITE_NAME || 'TelegramAI',
  adminIds: (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
};

const requiredKeys = ['telegramToken', 'openrouterApiKey'];

for (const key of requiredKeys) {
  if (!config[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = config;
