# Agent Guide for telegram-ai-assistant

## Commands
- `npm start` — run production
- `npm run dev` — run with `--watch` (auto-restart on file changes)
- `docker compose up --build` — full stack (app + MongoDB)
- No test framework is set up

## Key Structure
- Entry: `src/index.js` — Express server + boots bot, MongoDB, scheduler, and news scheduler; supports `AUTO_UPDATE=1` env var to auto-pull from GitHub on start
- `src/config/index.js` — reads env vars, validates required keys, exits if missing; parses `ADMIN_IDS` into array
- `src/bot/index.js` — node-telegram-bot-api with polling; message handler dispatches commands, sends text to AI, or handles uploaded documents (txt/pdf/docx); sendLongMessage chunks at 4000 chars; stripMarkdown preserves `- ` and `1. ` lists
- `src/services/openrouter.js` — OpenAI SDK pointing at OpenRouter base URL; `generateWithTools()` handles tool calls via `finish_reason === 'tool_calls'` with up to 15 recursive iterations; supports dynamic tone, userName, studyMode in system prompt
- `src/database/models/Conversation.js` — Mongoose schema; `userId` is unique, messages are embedded subdocs; metadata stores timezone, profile, userName, tone, studyMode
- `src/database/models/Reminder.js` — Mongoose schema; `userId` + `remindAt` indexed, `notified` flag
- `src/database/models/Note.js` — Mongoose schema; `userId` + `key` unique compound index, optional `tags` array
- `src/database/models/Event.js` — Mongoose schema; `userId` + `start` indexed; title, start, end, allDay, notes
- `src/database/models/Task.js` — Mongoose schema; `userId` + `completed` indexed; title, dueDate, priority, tags
- `src/database/models/Flashcard.js` — Mongoose schema; `userId` + `topic` indexed; question, answer, topic, reviewedAt
- `src/database/models/ErrorLog.js` — Mongoose schema; userId, action, error, stack, context, timestamp; auto-logged on every error
- `src/database/models/NutritionLog.js` — Mongoose schema; `userId` + `date` indexed; food, mealType, calories, macros, imageUrl
- `src/services/scheduler.js` — checks every 30s for due reminders and sends via bot
- `src/services/profileService.js` — builds/updates a persistent user profile every 30 user messages; stored in `Conversation.metadata.profile` and injected into the system prompt on every message
- `src/services/newsService.js` — fetches BBC RSS daily at 07:00 Africa/Cairo and sends headlines to admin users
- `src/services/fileParser.js` — extracts text from .txt, .pdf (pdf-parse), .docx (mammoth); truncates at 5000 chars
- `src/services/diagnosticsService.js` — tracks uptime, message count, provides dashboard + error logging helper; auto-logs errors to ErrorLog collection
- `src/commands/index.js` — flat map of `{commandName: handlerFn}`; each handler receives `(bot, msg, Conversation)`
- `src/commands/timezone.js` — `/timezone TZ` stores in `Conversation.metadata.timezone`
- `src/commands/setName.js` — `/set_name Name` stores preferred name in metadata
- `src/commands/setTone.js` — `/set_tone casual|professional|concise|detailed` changes response style
- `src/commands/admin.js` — `/stats` (DB counts), `/broadcast <msg>` (sends to all users); admin-only via `ADMIN_IDS`
- `src/commands/wipe.js` — `/wipe` deletes Conversation, Reminders, and Notes for the user
- `src/commands/study.js` — `/study` toggles `metadata.studyMode` boolean
- `src/commands/timetable.js` — `/timetable [week|today|month]` generates PDF via GenerateTimetableTool
- `src/commands/diagnostics.js` — `/diagnostics` (admin) shows uptime, message count, memory, error log, DB stats
- `src/tools/` — `base.js` provides abstract `Tool` class; `reminder.js`, `timer.js`, `weather.js`, `webSearch.js`, `notes.js`, `pdf.js`, `calendar.js`, `tasks.js`, `pomodoro.js`, `study.js`, `timetable.js`, `nutrition.js` implement tools; `index.js` exports singleton `registry` with all tools pre-registered
- `src/middleware/rateLimiter.js` — In-memory rate limiter (4 msgs per 5s per user)

## Tool System
- `create_reminder(text, remindAt, userId)` — absolute datetime reminder via scheduled DB poll
- `create_timer(text, duration_minutes, userId)` — relative countdown (uses same Reminder model)
- `get_weather(city)` — free Open-Meteo API (no key); geocodes city, returns current + 3-day forecast
- `web_search(query, max_results?)` — DuckDuckGo HTML search (free, no key)
- `save_note(key, content, tags?, userId)` — upserts into `Note` collection; key is unique per user
- `get_note(key, userId)` — returns by exact key
- `search_notes(query, userId)` — regex search across key, content, tags; returns up to 10 matches
- `delete_note(key, userId)` — removes note by key
- `create_pdf(title, content, userId)` — generates PDF via pdfkit and sends as Telegram document
- `add_event(userId, title, start, end?, notes?)` — adds calendar event
- `get_events(userId, from, to)` — lists events in date range
- `delete_event(userId, eventId)` — removes event by _id
- `add_task(userId, title, dueDate?, priority?, tags?)` — adds to-do item
- `list_tasks(userId, filter?)` — lists tasks (pending/done/all/by tag)
- `complete_task(userId, taskId)` — marks task done
- `delete_task(userId, taskId)` — removes task
- `start_pomodoro(userId, work_minutes?, break_minutes?, cycles?)` — starts Pomodoro timer chain
- `create_flashcard(userId, question, answer, topic?)` — saves flashcard
- `quiz_me(userId, topic?)` — picks random flashcard, returns Q&A for AI-led quizzing
- `generate_timetable(userId, range, startDate?)` — creates visual PDF timetable (week/today/month view)
- `log_meal(userId, food, mealType?, calories?, protein?, carbs?, fat?, notes?, date?, imageUrl?)` — logs a meal entry for nutrition tracking
- `get_nutrition_report(userId, from?, to?)` — returns totals + averages for calories and macros in a date range

## Error Logging & Diagnostics
- `src/database/models/ErrorLog.js` stores every error with userId, action, stack, context
- Auto-logged from: message processing errors, document parsing errors, polling errors, tool execution errors
- `incrementMessageCount()` called on every incoming message
- `getDashboard()` returns uptime, host info, memory, message count, error count, DB stats
- `/diagnostics` (admin-only) displays full dashboard; `/stats` now includes error count
- Logging failures are silently ignored — never crashes the bot

## Nutrition Tracking
- `NutritionLog` model stores food, mealType (breakfast/lunch/dinner/snack), calories, protein, carbs, fat, imageUrl
- `log_meal` tool upserts a nutrition entry; AI asks for food description and estimated macros
- `get_nutrition_report` gives daily/range summaries with totals and per-meal averages
- Image URL field supports vision-based calorie estimation via OpenRouter vision models
- Photo messages are detected, downloaded from Telegram, and the image URL is passed to the AI as a content array (text + image_url with `detail: auto`)
- The system prompt instructs the AI to analyze food photos and log meals using `log_meal`
- Set `VISION_MODEL` env var to a vision-capable model (e.g. `nvidia/nemotron-3.5-content-safety:free`) for food photo analysis; falls back to `MODEL` if unset

## Reminder / Timer System
- Flow: user asks → OpenAI calls tool → DB save → scheduler polls every 30s → `bot.sendMessage()` on due
- The AI receives a system prompt with the user's Telegram ID + timezone. It passes `userId` as a parameter to tools.
- Reminder time is parsed by the AI as ISO 8601 with the user's timezone offset.
- Commands use plain text (no Markdown parsing) to avoid formatting errors from AI output.
- The `/timezone` command stores the user's IANA timezone in conversation metadata.
- Rate limiter allows 4 messages per 5 seconds per user; excess messages are silently dropped.

## Admin System
- `ADMIN_IDS` env var is a comma-separated list of Telegram user IDs
- `/stats`, `/broadcast`, and `/diagnostics` silently do nothing for non-admin users
- News scheduler sends BBC headlines daily at 07:00 Cairo time to all admin IDs

## User Customization
- `/set_name Name` — stored in `metadata.userName`; injected into system prompt
- `/set_tone tone` — stored in `metadata.tone`; replaces the "concise, clear, direct" instruction with matching tone from TONE_MAP
- `/study` — toggles `metadata.studyMode`; when ON, AI proactively quizzes and suggests pomodoros
- `/timetable [week|today|month]` — generates visual PDF timetable via pdfkit
- `/diagnostics` — admin-only dashboard showing uptime, memory, msg count, error log, DB stats
- `/reset` — clears messages array + resets tone (keeps profile, timezone, userName, notes)
- `/wipe` — deletes Conversation document, all Reminders, and all Notes for that user

## Conventions
- CommonJS (`require` / `module.exports`)
- All handler functions are `async`
- No test suite exists — do not run tests
- Config validation on startup: crashes if `TELEGRAM_TOKEN` or `OPENROUTER_API_KEY` is missing
- Cleanup: SIGINT/SIGTERM stop scheduler + disconnect mongoose

## Gotchas
- `MAX_CONTEXT_MESSAGES` controls how many recent messages are sent to the AI (default 25); slicing is done after pushing the new user message
- `/reset` clears messages only + tone, keeps profile/timezone/name/notes
- The bot uses **polling** (not webhooks) — no need to set a webhook URL
- Model config is passed as-is to OpenRouter; change `MODEL` in `.env` to any OpenRouter model slug
- `node_modules` must be present for `--watch` to work (it watches all imported files)
- Not all OpenRouter models support function calling — if `generateWithTools` gets no `tool_calls` back, it falls through to normal text reply
- Reminder scheduler fires every 30 seconds — it is not real-time, max delay is ~30s
- `bot.sendMessage` is called without `parse_mode` to avoid crashes from AI-generated markdown artifacts
- Tools that send messages (create_pdf, generate_timetable) use lazy `require('../bot')` via `getBot()` to avoid circular deps
- `quiz_me` returns both question and answer (separated by `|||`) so the AI can check the user's response
- Timetable PDF grid uses pdfkit with rect drawing + text layout for weekly/daily/monthly views
- ECONNRESET auto-recovers: stopPolling → 3s delay → startPolling
- pdf-parse pinned to v1.1.4 (pdfjs-dist v2, no DOMMatrix issues)
