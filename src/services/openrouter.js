const OpenAI = require('openai');
const config = require('../config');

const TONE_MAP = {
  casual: 'Be relaxed, friendly, and conversational. Use casual language and be warm.',
  professional: 'Be formal and professional. Use precise language and maintain a business-like tone.',
  concise: 'Be extremely brief. Answer in as few words as possible.',
  detailed: 'Be thorough and detailed. Provide comprehensive explanations.',
};

const BASE_SYSTEM_CONTENT =
  'You are Dash, a helpful and intelligent personal AI assistant. ' +
  'You are concise, clear, and direct. ' +
  'You act as a personal assistant and remember the user\'s projects, tasks, goals, and preferences. ' +
  'Do NOT use any markdown formatting whatsoever. Use plain text only. No asterisks, backticks, underscores, or brackets. ' +
  '\n\n' +
  'TOOLS — call these immediately when the user asks:\n' +
  '- create_reminder: when they want a reminder at a specific future date/time. Always convert to the user\'s timezone.\n' +
  '- create_timer: when they say "set a timer for X minutes/seconds". Do NOT use create_reminder for short countdowns — use create_timer.\n' +
  '- get_weather: when they ask about the weather. Pass the city name from context.\n' +
  '- web_search: when they ask about current events, recent news, things you are not certain about, or anything needing up-to-date info.\n' +
  '- save_note: proactively save personal info they share (projects, preferences, facts, accounts). The key should be a short descriptive label. Overwrite existing notes with new info.\n' +
  '- get_note: when they ask about something specific you might have saved.\n' +
  '- search_notes: when you are not sure of the exact key, search their notes by keyword.\n' +
  '- delete_note: when they ask you to forget or remove something.\n' +
  '- create_pdf: when they ask for a report, document, summary, or anything as a PDF file. Format the content using markdown-like syntax (## headings, **bold**, - lists).\n' +
  '- add_event: when they say "schedule" or "add to calendar" or "I have an event on [date]". Always convert to the user\'s timezone. Pass the userId from context.\n' +
  '- get_events: when they ask "what\'s on my calendar" or "what events do I have".\n' +
  '- delete_event: when they want to remove an event.\n' +
  '- add_task: when they say "I need to do X" or "add a task" or "remind me to do X" (for tasks, not timed reminders).\n' +
  '- list_tasks: when they ask about their tasks or to-do list.\n' +
  '- complete_task: when they finish a task.\n' +
  '- delete_task: when they want to remove a task.\n' +
  '- start_pomodoro: when they say "start a pomodoro" or "study with timer".\n' +
  '- create_flashcard: when they want to save a fact, definition, or concept to study later.\n' +
  '- quiz_me: when study mode is on and it\'s time to quiz them, or when they ask to be quizzed.\n' +
  '- generate_timetable: when they ask for their schedule as a PDF or want to see their week/month. The bot will send the PDF file automatically.\n' +
  '- log_meal: when they eat something or send a food photo. Log the meal with food description, meal type, estimated calories, and macros. When analyzing a food photo, use vision to identify the dish and estimate macros.\n' +
  '- get_nutrition_report: when they ask "what did I eat" or want a nutrition summary for a day or range.\n' +
  '\n' +
  'Do NOT ask the user for confirmation before calling a tool. Just call it.\n' +
  'Be concise — answer in 1-3 short sentences unless the user asks for detail.';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const code = err.code || err.errno || '';
      const status = err.status || 0;
      const isRateLimit = status === 429 || msg.includes('429') || msg.includes('rate_limit');
      const isRetryable = (
        isRateLimit ||
        msg.includes('Premature close') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        status >= 500 ||
        status === 0 ||
        code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        code === 'ECONNRESET' ||
        err.type === 'system'
      );
      if (isRetryable && i < maxRetries - 1) {
        const delay = isRateLimit ? Math.min(1000 * Math.pow(2, i + 2), 30000) : (i + 1) * 2000;
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;
        console.log(`API call failed (${msg}), retry ${i + 1}/${maxRetries} in ${Math.round(totalDelay)}ms...`);
        await sleep(totalDelay);
        continue;
      }
      throw err;
    }
  }
}

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

function buildSystemMessage(userContext, profile, userName, tone, systemPrompt) {
  let content = systemPrompt || BASE_SYSTEM_CONTENT;

  if (tone && TONE_MAP[tone]) {
    content = content.replace(
      'You are concise, clear, and direct.',
      TONE_MAP[tone],
    );
  }

  if (userName) {
    content += `\n\nThe user's name is ${userName}. Address them by name when appropriate.`;
  }

  if (userContext) {
    content += `\n\nCurrent user info:\n${userContext}`;
  }
  if (profile) {
    content += `\n\nKnown information about the user:\n${profile}`;
  }
  return { role: 'system', content };
}

async function generateResponse(messages, userContext) {
  const openai = getClient();

  const completion = await retry(() => openai.chat.completions.create({
    model: config.model,
    messages: [buildSystemMessage(userContext), ...messages],
    temperature: 0.7,
    max_tokens: 2000,
  }));

  return completion.choices[0].message.content;
}

async function generateWithTools(messages, toolRegistry, userContext, profile, userName, tone, maxTokens, overrideModel, skipTools, systemPrompt) {
  const openai = getClient();
  const functionDefs = skipTools ? [] : toolRegistry.getFunctionDefinitions();

  const systemMsg = buildSystemMessage(userContext, profile, userName, tone, systemPrompt);
  const currentMessages = [systemMsg, ...messages];

  let iterations = 0;
  const MAX_ITERATIONS = skipTools ? 1 : 15;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let modelToUse = overrideModel || config.model;
    let usedFallback = false;

    const tryModel = async (model) => {
      if (usedFallback) console.log(`Rate limited, falling back to ${model}`);
      return await retry(() => openai.chat.completions.create({
        model,
        messages: currentMessages,
        tools: functionDefs.length > 0 ? functionDefs : undefined,
        tool_choice: functionDefs.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: maxTokens || 2000,
      }));
    };

    let completion;
    try {
      completion = await tryModel(modelToUse);
    } catch (err) {
      if ((err.status === 429 || (err.message && err.message.includes('429'))) && !usedFallback && config.fallbackModel) {
        usedFallback = true;
        completion = await tryModel(config.fallbackModel);
      } else {
        throw err;
      }
    }

    const choice = completion.choices[0];

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        try {
          const tool = toolRegistry.get(toolCall.function.name);
          if (tool) {
            const params = JSON.parse(toolCall.function.arguments);
            const result = await tool.execute(params);
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: String(result),
            });
          }
        } catch (err) {
          console.error(`Error executing tool ${toolCall.function.name}:`, err);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error: ${err.message}`,
          });
        }
      }

      continue;
    }

    return choice.message.content;
  }

  return 'Reached maximum tool call iterations. Please try a simpler request.';
}

module.exports = { generateResponse, generateWithTools, buildSystemMessage };
