const Tool = require('./base');
const Note = require('../database/models/Note');

class SaveNoteTool extends Tool {
  constructor() {
    super(
      'save_note',
      'Save or update a note for the user. Use this when the user shares personal information, preferences, project details, or anything they might want you to remember later. The key is a short label for lookup.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: "The user's Telegram ID from the system prompt",
        },
        key: {
          type: 'string',
          description: 'A short, unique label for the note (e.g. "wifi_password", "project_phoenix", "work_email")',
        },
        content: {
          type: 'string',
          description: 'The content to remember',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization',
        },
      },
      required: ['userId', 'key', 'content'],
    };
  }

  async execute({ userId, key, content, tags }) {
    const note = await Note.findOneAndUpdate(
      { userId, key },
      { content, tags: tags || [], updatedAt: new Date() },
      { upsert: true, new: true },
    );
    return `Saved note "${key}".`;
  }
}

class GetNoteTool extends Tool {
  constructor() {
    super(
      'get_note',
      'Retrieve a note by its exact key. Use this when the user asks about something specific they might have told you before.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: "The user's Telegram ID from the system prompt",
        },
        key: {
          type: 'string',
          description: 'The exact key of the note to retrieve',
        },
      },
      required: ['userId', 'key'],
    };
  }

  async execute({ userId, key }) {
    const note = await Note.findOne({ userId, key });
    if (!note) return `No note found with key "${key}".`;
    return `Note "${key}": ${note.content}`;
  }
}

class SearchNotesTool extends Tool {
  constructor() {
    super(
      'search_notes',
      'Search the user\'s notes by keyword. Use this when the user asks about something they might have told you but you are not sure of the exact key.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: "The user's Telegram ID from the system prompt",
        },
        query: {
          type: 'string',
          description: 'The search query to match against note keys, content, or tags',
        },
      },
      required: ['userId', 'query'],
    };
  }

  async execute({ userId, query }) {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const notes = await Note.find({
      userId,
      $or: [{ key: regex }, { content: regex }, { tags: regex }],
    }).sort({ updatedAt: -1 }).limit(10);

    if (notes.length === 0) return 'No matching notes found.';

    const results = notes.map((n) => `- "${n.key}": ${n.content.length > 100 ? n.content.slice(0, 100) + '...' : n.content}`);
    return `Found ${notes.length} note(s):\n${results.join('\n')}`;
  }
}

class DeleteNoteTool extends Tool {
  constructor() {
    super(
      'delete_note',
      'Delete a saved note by its key. Use this when the user asks you to forget or remove something.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: "The user's Telegram ID from the system prompt",
        },
        key: {
          type: 'string',
          description: 'The exact key of the note to delete',
        },
      },
      required: ['userId', 'key'],
    };
  }

  async execute({ userId, key }) {
    const result = await Note.findOneAndDelete({ userId, key });
    if (!result) return `No note found with key "${key}".`;
    return `Deleted note "${key}".`;
  }
}

module.exports = { SaveNoteTool, GetNoteTool, SearchNotesTool, DeleteNoteTool };
