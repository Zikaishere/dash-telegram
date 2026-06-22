const OpenAI = require('openai');
const config = require('../config');

const BASE_SYSTEM_CONTENT =
  'You are Dash, a helpful and intelligent personal AI assistant. ' +
  'You are concise, clear, and direct. ' +
  'You act as a personal assistant and remember the user\'s projects, tasks, goals, and preferences. ' +
  'Do NOT use tables, markdown links, or complex formatting. Use plain text only. ' +
  '\n\n' +
  'TOOLS — call these immediately when the user asks:\n' +
  '- create_reminder: when they want a reminder at a specific future date/time. Always convert to Egypt timezone (Africa/Cairo) unless the user has set a different timezone.\n' +
  '- create_timer: when they say "set a timer for X minutes/seconds". Do NOT use create_reminder for short countdowns — use create_timer.\n' +
  '- get_weather: when they ask about the weather. Pass the city name from context.\n' +
  '- web_search: when they ask about current events, recent news, things you are not certain about, or anything needing up-to-date info.\n' +
  '- save_note: proactively save personal info they share (projects, preferences, facts, accounts). The key should be a short descriptive label. Overwrite existing notes with new info.\n' +
  '- get_note: when they ask about something specific you might have saved.\n' +
  '- search_notes: when you are not sure of the exact key, search their notes by keyword.\n' +
  '- delete_note: when they ask you to forget or remove something.\n' +
  '\n' +
  'Do NOT ask the user for confirmation before calling a tool. Just call it.';

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

function buildSystemMessage(userContext) {
  let content = BASE_SYSTEM_CONTENT;
  if (userContext) {
    content += `\n\nCurrent user info:\n${userContext}`;
  }
  return { role: 'system', content };
}

async function generateResponse(messages) {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: [buildSystemMessage(), ...messages],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return completion.choices[0].message.content;
}

async function generateWithTools(messages, toolRegistry, userContext) {
  const openai = getClient();
  const functionDefs = toolRegistry.getFunctionDefinitions();

  const requestOptions = {
    model: config.model,
    messages: [buildSystemMessage(userContext), ...messages],
    temperature: 0.7,
    max_tokens: 2000,
  };

  if (functionDefs.length > 0) {
    requestOptions.tools = functionDefs;
    requestOptions.tool_choice = 'auto';
  }

  const completion = await openai.chat.completions.create(requestOptions);
  const choice = completion.choices[0];

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    const toolResults = [];

    for (const toolCall of choice.message.tool_calls) {
      try {
        const tool = toolRegistry.get(toolCall.function.name);
        if (tool) {
          const params = JSON.parse(toolCall.function.arguments);
          const result = await tool.execute(params);
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: String(result),
          });
        }
      } catch (err) {
        console.error(`Error executing tool ${toolCall.function.name}:`, err);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Error: ${err.message}`,
        });
      }
    }

    const finalCompletion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        buildSystemMessage(userContext),
        ...messages,
        choice.message,
        ...toolResults,
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return finalCompletion.choices[0].message.content;
  }

  return choice.message.content;
}

module.exports = { generateResponse, generateWithTools, buildSystemMessage };
