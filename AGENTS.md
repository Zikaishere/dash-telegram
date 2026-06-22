# Agent Guide for telegram-ai-assistant

## Commands
- `npm start` — run production
- `npm run dev` — run with `--watch` (auto-restart on file changes)
- `docker compose up --build` — full stack (app + MongoDB)
- No test framework is set up

## Key Structure
- Entry: `src/index.js` — Express server + boots bot and MongoDB
- `src/config/index.js` — reads env vars, validates required keys, exits if missing
- `src/bot/index.js` — node-telegram-bot-api with polling; message handler dispatches commands or sends to AI
- `src/services/openrouter.js` — OpenAI SDK pointing at OpenRouter base URL; generates responses with prepended system prompt
- `src/database/models/Conversation.js` — Mongoose schema; `userId` is unique, messages are embedded subdocs
- `src/commands/index.js` — flat map of `{commandName: handlerFn}`; each handler receives `(bot, msg, Conversation)`
- `src/tools/` — `base.js` provides an abstract `Tool` class with `execute()`, `toFunctionDefinition()`, `getParametersSchema()`; `index.js` exports a singleton `registry`

## Conventions
- CommonJS (`require` / `module.exports`)
- All handler functions are `async`
- No test suite exists — do not run tests
- Config validation on startup: crashes if `TELEGRAM_TOKEN` or `OPENROUTER_API_KEY` is missing
- Cleanup: SIGINT/SIGTERM disconnect mongoose

## Gotchas
- `MAX_CONTEXT_MESSAGES` controls how many recent messages are sent to the AI (default 25); slicing is done after pushing the new user message
- `/reset` deletes the entire Conversation document for that user (not a rollback)
- The bot uses **polling** (not webhooks) — no need to set a webhook URL
- Model config is passed as-is to OpenRouter; change `MODEL` in `.env` to any OpenRouter model slug
- `node_modules` must be present for `--watch` to work (it watches all imported files)
