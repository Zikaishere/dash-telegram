require('dotenv').config();

const config = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.MODEL || 'openai/gpt-4o-mini',
  fallbackModel: process.env.FALLBACK_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  visionModel: process.env.VISION_MODEL || process.env.MODEL || 'openai/gpt-4o-mini',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/assistant',
  port: parseInt(process.env.PORT, 10) || 3000,
  maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) || 25,
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  siteUrl: process.env.SITE_URL || 'https://github.com/your-username/telegram-ai-assistant',
  siteName: process.env.SITE_NAME || 'TelegramAI',
  adminIds: (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  supabaseUserId: process.env.SUPABASE_USER_ID || null,
};

const requiredKeys = ['telegramToken', 'openrouterApiKey'];

for (const key of requiredKeys) {
  if (!config[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = config;
