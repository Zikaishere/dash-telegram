# Telegram Personal AI Assistant

A personal AI assistant powered by Telegram, OpenRouter, and MongoDB. The assistant (named **Dash**) maintains conversation memory per user, responds naturally via AI, and is designed with a modular tool architecture for future extensibility.

## Features

- **Chat Assistant** — Natural conversations via Telegram with AI-generated responses
- **Conversation Memory** — Persistent history stored in MongoDB (last 25 messages in context)
- **Typing Indicator** — Shows "typing..." while generating responses
- **Commands** — `/start`, `/help`, `/reset`
- **Tool System** — Modular architecture for adding new tools (reminder, notes, weather, calendar, etc.)
- **Docker Support** — Easy deployment with Docker Compose
- **Express Server** — Health check API

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [MongoDB](https://www.mongodb.com/) (or Docker)
- A [Telegram Bot](https://t.me/botfather) token
- An [OpenRouter](https://openrouter.ai/) API key

## Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `TELEGRAM_TOKEN` | Your Telegram bot token from @BotFather |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `MODEL` | OpenRouter model slug (default: `openai/gpt-4o-mini`) |
| `MONGODB_URI` | MongoDB connection URI |
| `PORT` | Server port (default: 3000) |
| `SITE_URL` | Your site URL (used in OpenRouter headers) |
| `SITE_NAME` | Your app name (used in OpenRouter headers) |
| `MAX_CONTEXT_MESSAGES` | Max messages kept in context (default: 25) |

## Running Locally

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Start (requires a running MongoDB instance)
npm start

# Development mode with auto-reload
npm run dev
```

## Running with Docker

```bash
# Start both app and MongoDB
docker compose up --build

# Run in background
docker compose up -d
```

## Creating a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Copy the API token and add it to your `.env` file as `TELEGRAM_TOKEN`

## Getting an OpenRouter API Key

1. Go to [OpenRouter.ai](https://openrouter.ai/)
2. Create an account
3. Navigate to **Keys** and generate a new API key
4. Add it to your `.env` file as `OPENROUTER_API_KEY`
5. Set your preferred model in the `MODEL` variable

## Project Structure

```
src/
├── index.js              # Entry point - Express server + bootstrap
├── config/
│   └── index.js          # Environment configuration
├── database/
│   ├── index.js          # MongoDB connection
│   └── models/
│       └── Conversation.js   # Mongoose schema for conversations
├── bot/
│   └── index.js          # Telegram bot setup and message handling
├── services/
│   └── openrouter.js     # OpenRouter AI integration
├── commands/
│   ├── index.js          # Command registry
│   ├── start.js          # /start handler
│   ├── help.js           # /help handler
│   └── reset.js          # /reset handler
└── tools/
    ├── base.js           # Abstract base tool class
    └── index.js          # Tool registry
```

## Tool System

The project includes a modular tool architecture. To add a new tool:

1. Create a file in `src/tools/` (e.g., `weather.js`)
2. Extend the `Tool` base class and implement `execute(params)`
3. Register it in the tool registry

Example:

```javascript
const Tool = require('./base');

class WeatherTool extends Tool {
  constructor() {
    super('get_weather', 'Get current weather for a location');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
      },
      required: ['location'],
    };
  }

  async execute({ location }) {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=KEY&q=${location}`
    );
    const data = await response.json();
    return `The temperature in ${location} is ${data.current.temp_c}°C`;
  }
}

module.exports = WeatherTool;
```

Then register in `src/tools/index.js`:

```javascript
registry.register(new WeatherTool());
```

The tool function definitions can be passed to OpenRouter for function-calling support, enabling the AI to invoke tools dynamically.
