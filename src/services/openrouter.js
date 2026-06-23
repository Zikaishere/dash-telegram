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
  '\n' +
  'Do NOT ask the user for confirmation before calling a tool. Just call it.';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, maxRetries = 4) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const code = err.code || err.errno || '';
      const isRetryable = (
        msg.includes('Premature close') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('5') ||
        code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        code === 'ECONNRESET' ||
        err.status >= 500 ||
        err.type === 'system'
      );
      if (isRetryable && i < maxRetries - 1) {
        console.log(`API call failed (${msg}), retry ${i + 1}/${maxRetries}...`);
        await sleep((i + 1) * 2000);
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

function buildSystemMessage(userContext, profile, userName, tone) {
  let content = BASE_SYSTEM_CONTENT;

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

async function generateWithTools(messages, toolRegistry, userContext, profile, userName, tone, maxTokens) {
  const openai = getClient();
  const functionDefs = toolRegistry.getFunctionDefinitions();

  const systemMsg = buildSystemMessage(userContext, profile, userName, tone);
  const currentMessages = [systemMsg, ...messages];

  let iterations = 0;
  const MAX_ITERATIONS = 15;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const completion = await retry(() => openai.chat.completions.create({
      model: config.model,
      messages: currentMessages,
      tools: functionDefs.length > 0 ? functionDefs : undefined,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: maxTokens || 2000,
    }));

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
