const Conversation = require('../database/models/Conversation');
const Task = require('../database/models/Task');
const { AddEventTool, GetEventsTool } = require('../tools/calendar');
const { AddTaskTool, ListTasksTool, CompleteTaskTool } = require('../tools/tasks');
const ReminderTool = require('../tools/reminder');
const TimerTool = require('../tools/timer');
const WeatherTool = require('../tools/weather');
const PomodoroTool = require('../tools/pomodoro');
const { CreateFlashcardTool, QuizMeTool } = require('../tools/study');
const GenerateTimetableTool = require('../tools/timetable');
const { LogMealTool, GetDailySummaryTool, GetWeeklyReportTool, LogWeightTool } = require('../tools/nutrition');

const DEFAULT_TZ = 'Africa/Cairo';
const WEEKDAYS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

const addEventTool = new AddEventTool();
const getEventsTool = new GetEventsTool();
const addTaskTool = new AddTaskTool();
const listTasksTool = new ListTasksTool();
const completeTaskTool = new CompleteTaskTool();
const reminderTool = new ReminderTool();
const timerTool = new TimerTool();
const weatherTool = new WeatherTool();
const pomodoroTool = new PomodoroTool();
const flashcardTool = new CreateFlashcardTool();
const quizTool = new QuizMeTool();
const timetableTool = new GenerateTimetableTool();
const logMealTool = new LogMealTool();
const dailySummaryTool = new GetDailySummaryTool();
const weeklyReportTool = new GetWeeklyReportTool();
const logWeightTool = new LogWeightTool();

const FILLER_WORDS = /\b(?:hey|hello|hi|could you|can you|would you|please|so|ok|okay|maybe|just)\b/gi;
const DAYWORDS = /\b(?:sun\w*|mon\w*|tue\w*|tues\w*|wed\w*|thu\w*|thur\w*|thurs\w*|fri\w*|sat\w*)\b/gi;
const NEXT_DAYWORDS = /\bnext\s+(?:sun\w*|mon\w*|tue\w*|tues\w*|wed\w*|thu\w*|thur\w*|thurs\w*|fri\w*|sat\w*)\b/gi;
const TIME_PHRASES = [
  /\b(?:at\s*)?\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi,
  /\b(?:at\s*)?\d{1,2}\s*(?:am|pm)\b/gi,
  /\b(?:at\s*)?\d{1,2}\s+o'?clock\b/gi,
  /\b(?:morning|afternoon|evening|noon|midnight)\b/gi,
  /\bin\s+\d+\s*(?:second|sec|minute|min|hour|hr|day|week)s?\b/gi,
];
const DAY_PHRASES = [
  /\b(?:day after tomorrow|tomorrow|tonight|today|tmr)\b/gi,
  NEXT_DAYWORDS,
  /\bnext\s+week\b/gi,
  DAYWORDS,
];

function getZonedParts(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const value = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const hour = value('hour');
  const weekdayName = String(parts.find((p) => p.type === 'weekday').value).toLowerCase().slice(0, 3);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: hour === 24 ? 0 : hour,
    minute: value('minute'),
    second: value('second'),
    weekday: WEEKDAYS[weekdayName] ?? 0,
  };
}

function timezoneOffsetMs(timeZone, date) {
  const parts = getZonedParts(timeZone, date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

function buildZonedDate(timeZone, year, month, day, hour, minute) {
  const asUTC = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(asUTC - timezoneOffsetMs(timeZone, new Date(asUTC)));
}

function normalizeHour(hour, minute, period) {
  let h = parseInt(hour, 10);
  if (/pm/i.test(period)) {
    if (h < 12) h += 12;
  } else if (/am/i.test(period)) {
    if (h === 12) h = 0;
  }
  if (h > 23) return null;
  return { hour: h, minute: parseInt(minute, 10) || 0 };
}

function parseTime(text) {
  const lower = text.toLowerCase();
  let match;
  if ((match = lower.match(/\b(?:at\s*)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/))) {
    return normalizeHour(match[1], match[2], match[3]);
  }
  if ((match = lower.match(/\b(?:at\s*)(\d{1,2})\s*(am|pm|o'?clock)?\b/))) {
    return normalizeHour(match[1], '00', /am|pm/i.test(match[2] || '') ? match[2] : '');
  }
  if ((match = lower.match(/\b(\d{1,2})\s*(am|pm)\b/))) {
    return normalizeHour(match[1], '00', match[2]);
  }
  if (/\bnoon\b/.test(lower)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/.test(lower)) return { hour: 0, minute: 0 };
  return null;
}

function computeDayShift(lower, timeZone) {
  if (/\bday after tomorrow\b/.test(lower)) return 2;
  if (/\btomorrow\b|\btmr\b/.test(lower)) return 1;
  if (/\btoday\b|\btonight\b/.test(lower)) return 0;

  const todayIndex = getZonedParts(timeZone, new Date()).weekday;
  const nextMatch = lower.match(/next\s+(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\w*\b/i);
  const plainMatch = lower.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\w*\b/i);
  const dayMatch = nextMatch || plainMatch;
  if (dayMatch) {
    const target = WEEKDAYS[dayMatch[1].slice(0, 3)];
    let diff = (target - todayIndex + 7) % 7;
    return diff === 0 ? 7 : diff;
  }

  if (/\bnext week\b/.test(lower)) return 7;
  return 0;
}

function parseDateTime(text, timeZone) {
  const lower = text.toLowerCase();

  const relative = lower.match(/\bin\s+(\d+)\s*(second|sec|minute|min|hour|hr|day|week)s?\b/);
  if (relative) {
    const amount = parseInt(relative[1], 10);
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    return new Date(Date.now() + amount * multipliers[relative[2][0]]);
  }

  const now = getZonedParts(timeZone, new Date());
  const dayShift = computeDayShift(lower, timeZone);
  const shifted = new Date(Date.UTC(now.year, now.month - 1, now.day + dayShift));
  const day = getZonedParts(timeZone, shifted);

  const time = parseTime(lower);
  const hour = /\btonight\b/.test(lower) ? 21
    : /\bevening\b/.test(lower) ? 19
    : /\bafternoon\b/.test(lower) ? 14
    : /\bmorning\b/.test(lower) ? 9
    : time ? time.hour : 9;

  return buildZonedDate(timeZone, day.year, day.month, day.day, hour, time ? time.minute : 0);
}

function cleanTitle(text) {
  let result = text.replace(FILLER_WORDS, ' ');
  for (const pattern of TIME_PHRASES) result = result.replace(pattern, ' ');
  for (const pattern of DAY_PHRASES) result = result.replace(pattern, ' ');
  result = result
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:schedule|book|set up|plan|add|put)\s+/i, '')
    .replace(/\b(?:a|an|the)\s+/i, '')
    .replace(/\s+(?:on|at|for|by|in)\s*$/i, '')
    .replace(/[.,;!?]+$/g, '')
    .trim();
  if (!result || result.length < 2) return null;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

async function getTimezone(userId) {
  const conversation = await Conversation.findOne({ userId }).catch(() => null);
  if (conversation?.metadata?.get) {
    return conversation.metadata.get('timezone') || DEFAULT_TZ;
  }
  return DEFAULT_TZ;
}

async function findTaskByTitle(userId, phrase) {
  const tasks = await Task.find({ userId, status: { $ne: 'done' } }).lean();
  const words = phrase.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  let best = null;
  for (const task of tasks) {
    const titleWords = new Set(task.title.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
    const matches = words.filter((w) => titleWords.has(w)).length;
    if (matches > 0 && (!best || matches > best.matches)) best = { task, matches };
  }
  return best ? best.task : null;
}

async function handleTimer(userId, text) {
  const isTimer = /\bset a timer\b|\btimer for\b|\bcountdown\b/i.test(text)
    || (/\bremind me\b/i.test(text) && /\bin\s+\d+\s*(second|sec|minute|min|hour|hr)s?\b/i.test(text));
  if (!isTimer) return null;

  const durationMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour|hr)s?\b/i);
  if (!durationMatch) return null;

  let minutes = parseFloat(durationMatch[1]);
  if (/^(second|sec)$/i.test(durationMatch[2])) minutes = minutes / 60;
  if (/^(hour|hr)$/i.test(durationMatch[2])) minutes = minutes * 60;
  if (!minutes || minutes <= 0) return null;

  let label = cleanTitle(text.replace(/\bset a timer\s+for\s+/i, ' ').replace(/\bremind me\b\s*(?:to|about)?\s*/i, ' '));
  if (!label || /^\d|^(?:second|sec|minute|min|hour|hr)/i.test(label)) label = 'Timer done';

  return { reply: await timerTool.execute({ userId, text: label, duration_minutes: minutes }) };
}

async function handleReminder(userId, text) {
  if (!/\bremind me\b|\bset a reminder\b|\breminder to\b/i.test(text)) return null;
  if (/\bin\s+\d+\s*(second|sec|minute|min|hour|hr)s?\b/i.test(text)) return null;

  const timezone = await getTimezone(userId);
  const hasTimeWord = /at\s+\d|tomorrow|tonight|today|next|o'clock|am\b|pm\b|\d{1,2}:\d{2}/i.test(text);
  if (!hasTimeWord) return null;

  const description = cleanTitle(text.replace(/\b(?:set a reminder|remind me)\s+/gi, ' ').replace(/\b(?:to|about|for)\b\s*/gi, ' '));
  if (!description) return null;

  let remindAt = parseDateTime(text, timezone);
  if (remindAt.getTime() < Date.now()) remindAt = new Date(remindAt.getTime() + 86400000);
  return { reply: await reminderTool.execute({ userId, text: `Reminder for ${description}`, remindAt: remindAt.toISOString() }) };
}

async function handleWeather(text) {
  const match = text.match(/\b(?:weather|forecast|temperature)\s+(?:in|for|at)?\s*(.+)$/i);
  if (!match) return null;
  const city = match[1].replace(/[?.!]+$/g, '').trim();
  if (!city || city.length === 0) return null;
  return { reply: await weatherTool.execute({ city }) };
}

async function handleTaskAdd(userId, text) {
  let match = text.match(/\badd\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(?:tasks?|task\s+list|to[\s-]?dos?|to-do\s+list)\b/i)
    || text.match(/\b(?:create|add)\s+(?:a\s+|new\s+)?task(?:s)?\s*[:=]\s*(.+)$/i)
    || text.match(/\bremember to\s+(.+)$/i);
  if (!match) return null;

  const timezone = await getTimezone(userId);
  const title = cleanTitle(match[1]);
  if (!title) return null;

  const hasDueDate = /at\s+\d|tomorrow|next|tonight|today|o'clock|am\b|pm\b|\d{1,2}:\d{2}/i.test(match[1]);
  const dueDate = hasDueDate ? parseDateTime(match[1], timezone).toISOString() : null;
  return { reply: await addTaskTool.execute({ userId, title, dueDate }) };
}

async function handleTaskList(userId, text) {
  const isTaskQuery = /\b(?:tasks?|to[\s-]?do(?: list)?)\b/i.test(text) &&
    (/\b(list|show|what|my|display)\b/i.test(text) || /^my\s+tasks?/i.test(text));
  if (!isTaskQuery) return null;
  return { reply: await listTasksTool.execute({ userId, filter: 'pending' }) };
}

async function handleTaskComplete(userId, text) {
  const match = text.match(/\b(?:mark\s+.+?\s+done|complete\s+|finish(?:ed)?\s+|done with\s+)(.+)$/i)
    || text.match(/\bmark\s+(.+?)\s+done\b/i);
  if (!match) return null;
  const task = await findTaskByTitle(userId, match[match.length - 1]);
  if (!task) return null;
  return { reply: await completeTaskTool.execute({ userId, taskId: String(task._id) }) };
}

async function handleEventAdd(userId, text) {
  let match = text.match(/\badd\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(?:calendar|schedule)\b/i)
    || text.match(/\bput\s+(.+?)\s+on\s+(?:my\s+|the\s+)?calendar\b/i)
    || text.match(/\b(?:i have|i got|i'?ve got)\s+(?:an?\s+)?(.+?)\s+on\s+\S/i)
    || text.match(/\b(?:can you|could you|please\s*)?(?:schedule|book|set up|plan)\s+(.+?)\s+(?:on|at|for|by)\s+\S/i);
  if (!match) return null;

  const timezone = await getTimezone(userId);
  const title = cleanTitle(match[match.length - 1]);
  if (!title) return null;

  const start = parseDateTime(text, timezone);
  return { reply: await addEventTool.execute({ userId, title, start: start.toISOString() }) };
}

async function handleTimetable(userId, text) {
  if (!/\b(timetable|show my (?:week|month|day)|my weekly schedule|my daily schedule)\b/i.test(text)) return null;
  const range = /\bmonth\b/i.test(text) ? 'month' : /\btoday\b|\bday\b/i.test(text) ? 'today' : 'week';
  return { reply: await timetableTool.execute({ userId, range }) };
}

async function handleEventQuery(userId, text) {
  const isCalendarQuery = /\b(?:calendar|events?|appointments?|schedule)\b/i.test(text) &&
    (/\b(?:what|show|list|upcoming|my)\b/i.test(text) || /^my\s+(?:calendar|schedule)/i.test(text));
  if (!isCalendarQuery) return null;

  const timezone = await getTimezone(userId);
  const now = getZonedParts(timezone, new Date());
  const from = buildZonedDate(timezone, now.year, now.month, now.day, 0, 0);
  const to = new Date(from.getTime() + 7 * 86400000);
  return { reply: await getEventsTool.execute({ userId, from: from.toISOString(), to: to.toISOString() }) };
}

async function handleNutritionLog(userId, text) {
  let match = text.match(/\bi\s+(?:just\s+|recently\s+)?(?:ate|had)\s+(.+)$/i)
    || text.match(/\blog(?:ged|ging)?\s+(?:my\s+)?(breakfast|lunch|dinner|snack)\b\s*(?:-|:)?\s*(.*)$/i);
  if (!match) return null;

  const isMealPattern = /^(breakfast|lunch|dinner|snack)$/i.test(match[1]);
  const raw = isMealPattern ? match[2] : match[1];
  const excluded = /\b(great day|good day|fun|feeling|time|blast)\b/i.test(raw || '');
  if (!raw || excluded || /^\s*$/.test(raw)) return null;

  const mealType = isMealPattern ? match[1].toLowerCase() : undefined;
  return { reply: await logMealTool.execute({ userId, text: raw, mealType }) };
}

async function handleNutritionSummary(userId, text) {
  const isNutritionQuery = /\b(?:nutrition|calories|macros|diet|what did i eat)\b/i.test(text) &&
    /\b(?:report|summary|status|today|this week|weekly|week)\b/i.test(text);
  if (!isNutritionQuery) return null;
  const reply = /\bweek\b/i.test(text)
    ? await weeklyReportTool.execute({ userId })
    : await dailySummaryTool.execute({ userId });
  return { reply };
}

async function handleWeight(userId, text) {
  const match = text.match(/\b(?:i\s+)?weigh(?:ed)?\s+(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|pounds?|lbs?)?\b/i)
    || text.match(/\bweight\s+(?:is|now)\s+(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|pounds?|lbs?)?\b/i);
  if (!match) return null;

  const weight = parseFloat(match[1]);
  const unit = (match[2] || 'kg').toLowerCase();
  const converted = /^(lb|pound)/.test(unit) ? Math.round(weight * 0.4536 * 10) / 10 : weight;
  return { reply: await logWeightTool.execute({ userId, weight: converted }) };
}

async function handleQuiz(userId, text) {
  const match = text.match(/\bquiz me\b(?:\s+on\s+(.+))?$/i);
  if (!match) return null;
  const topic = match[1] ? cleanTitle(match[1]) : 'general';
  return { reply: await quizTool.execute({ userId, topic }) };
}

async function handlePomodoro(userId, text) {
  if (!/\bpomodoro\b/.test(text)) return null;
  const minutesMatch = text.match(/\b(\d+)\s*min\b/);
  return { reply: await pomodoroTool.execute({ userId, work_minutes: minutesMatch ? parseInt(minutesMatch[1], 10) : 25 }) };
}

async function handleFlashcard(userId, text) {
  const explicit = /\b(?:create|add|save|make)\s+(?:a\s+)?flashcard\b/i.test(text);
  const rememberThat = text.match(/\bremember that\s+(.+?)\s+(?:is|=)\s+(.+)$/i);
  if (!explicit && !rememberThat) return null;

  if (rememberThat) {
    const question = cleanTitle(rememberThat[1]);
    const answer = cleanTitle(rememberThat[2]);
    if (question && answer) return { reply: await flashcardTool.execute({ userId, question, answer, topic: 'general' }) };
  }

  const contentMatch = text.match(/\bflashcard\b[:\s]+(.+?)\s*(?:=|:)\s*(.+)$/i)
    || text.match(/\bq\s*[:=]\s*(.+?)\s+a\s*[:=]\s*(.+)$/i);
  if (!contentMatch) return null;
  const question = cleanTitle(contentMatch[1]);
  const answer = cleanTitle(contentMatch[2]);
  if (!question || !answer) return null;
  return { reply: await flashcardTool.execute({ userId, question, answer, topic: 'general' }) };
}

async function handleNaturalLanguage(userId, text) {
  try {
    const handlers = [
      () => handleTimer(userId, text),
      () => handleReminder(userId, text),
      () => handleWeather(text),
      () => handleNutritionSummary(userId, text),
      () => handleWeight(userId, text),
      () => handleNutritionLog(userId, text),
      () => handleTaskAdd(userId, text),
      () => handleTaskList(userId, text),
      () => handleTaskComplete(userId, text),
      () => handleEventAdd(userId, text),
      () => handleTimetable(userId, text),
      () => handleEventQuery(userId, text),
      () => handleQuiz(userId, text),
      () => handleFlashcard(userId, text),
      () => handlePomodoro(userId, text),
    ];

    for (const handler of handlers) {
      const result = await handler();
      if (result) return result;
    }
  } catch (err) {
    const { logError } = require('./diagnosticsService');
    logError({ userId, action: 'naturalLanguageIntent', error: err, context: text.slice(0, 200) });
  }
  return null;
}

module.exports = { handleNaturalLanguage };