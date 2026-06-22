const OpenAI = require('openai');
const config = require('../config');

const BASE_SYSTEM_CONTENT =
  'You are Dash, a helpful and intelligent personal AI assistant. ' +
  'You are concise in your responses. ' +
  'You act as a personal assistant and remember the user\'s projects, tasks, goals, and preferences. ' +
  'Keep responses clear, direct, and helpful. ' +
  'Do NOT use tables, markdown links, or complex formatting. ' +
  'Use plain text only. ' +
  'When the user asks to be reminded about something, call the create_reminder tool immediately without asking for confirmation.';

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
