const OpenAI = require('openai');
const config = require('../config');

const SYSTEM_PROMPT = {
  role: 'system',
  content:
    'You are Dash, a helpful and intelligent personal AI assistant. ' +
    'You are concise in your responses. ' +
    'You act as a personal assistant and remember the user\'s projects, tasks, goals, and preferences. ' +
    'Keep responses clear, direct, and helpful.',
};

let client;

function getClient() {
  if (!client) {
    client = new OpenAI({
      baseURL: config.openrouterBaseUrl,
      apiKey: config.openrouterApiKey,
      defaultHeaders: {
        'HTTP-Referer': config.siteUrl,
        'X-Title': config.siteName,
      },
    });
  }
  return client;
}

async function generateResponse(messages) {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: [SYSTEM_PROMPT, ...messages],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return completion.choices[0].message.content;
}

module.exports = { generateResponse, SYSTEM_PROMPT };
