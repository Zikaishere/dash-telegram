# Agent Guide for telegram-ai-assistant

## Commands
- `npm start` — run production
- `npm run dev` — run with `--watch` (auto-restart on file changes)
- `docker compose up --build` — full stack (app + MongoDB)
- No test framework is set up

## Key Structure
- Entry: `src/index.js` — Express server + boots bot, MongoDB, and scheduler
- `src/config/index.js` — reads env vars, validates required keys, exits if missing
- `src/bot/index.js` — node-telegram-bot-api with polling; message handler dispatches commands or sends to AI with function calling
- `src/services/openrouter.js` — OpenAI SDK pointing at OpenRouter base URL; `generateWithTools()` handles tool calls via `finish_reason === 'tool_calls'`
- `src/database/models/Conversation.js` — Mongoose schema; `userId` is unique, messages are embedded subdocs
- `src/database/models/Reminder.js` — Mongoose schema; `userId` + `remindAt` indexed, `notified` flag
- `src/services/scheduler.js` — checks every 30s for due reminders and sends via bot
- `src/commands/index.js` — flat map of `{commandName: handlerFn}`; each handler receives `(bot, msg, Conversation)`
- `src/tools/` — `base.js` provides abstract `Tool` class; `reminder.js` implements reminder tool; `index.js` exports singleton `registry` with `ReminderTool` pre-registered

## Reminder System
- Flow: user asks → OpenAI calls `create_reminder` tool → DB save → scheduler polls every 30s → `bot.sendMessage()` on due
- The AI receives a system prompt with the user's Telegram ID + timezone (Africa/Cairo). It passes `userId` as a parameter to the tool.
- Reminder time is parsed by the AI as ISO 8601 with Egypt offset (UTC+2/+3).
- Commands use plain text (no Markdown parsing) to avoid formatting errors from AI output.

## Conventions
- CommonJS (`require` / `module.exports`)
- All handler functions are `async`
- No test suite exists — do not run tests
- Config validation on startup: crashes if `TELEGRAM_TOKEN` or `OPENROUTER_API_KEY` is missing
- Cleanup: SIGINT/SIGTERM stop scheduler + disconnect mongoose

## Gotchas
- `MAX_CONTEXT_MESSAGES` controls how many recent messages are sent to the AI (default 25); slicing is done after pushing the new user message
- `/reset` deletes the entire Conversation document for that user (not a rollback)
- The bot uses **polling** (not webhooks) — no need to set a webhook URL
- Model config is passed as-is to OpenRouter; change `MODEL` in `.env` to any OpenRouter model slug
- `node_modules` must be present for `--watch` to work (it watches all imported files)
- Not all OpenRouter models support function calling — if `generateWithTools` gets no `tool_calls` back, it falls through to normal text reply
- Reminder scheduler fires every 30 seconds — it is not real-time, max delay is ~30s
- `bot.sendMessage` is called without `parse_mode` to avoid crashes from AI-generated markdown artifacts
