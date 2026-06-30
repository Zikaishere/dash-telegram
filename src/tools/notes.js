const Tool = require('./base');
const supabase = require('../services/supabase');

class SaveNoteTool extends Tool {
  constructor() {
    super('save_note', 'Save or update a note. The key is a short label for lookup.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        key: { type: 'string', description: 'A short, unique label (e.g. "wifi_password", "project_phoenix")' },
        content: { type: 'string', description: 'The content to remember' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
      },
      required: ['userId', 'key', 'content'],
    };
  }

  async execute({ userId, key, content, tags }) {
    const existing = await supabase.select('notes', {
      match: { user_id: supabase.dataUserId(userId), key },
    });

    if (existing && existing.length > 0) {
      await supabase.update('notes', { id: existing[0].id }, { content, tags: tags || [] });
    } else {
      await supabase.insert('notes', [{
        user_id: supabase.dataUserId(userId),
        key,
        title: key,
        content,
        tags: tags || [],
      }]);
    }
    return `Saved note "${key}".`;
  }
}

class GetNoteTool extends Tool {
  constructor() {
    super('get_note', 'Retrieve a note by its exact key.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        key: { type: 'string', description: 'The exact key of the note' },
      },
      required: ['userId', 'key'],
    };
  }

  async execute({ userId, key }) {
    const notes = await supabase.select('notes', { match: { user_id: supabase.dataUserId(userId), key } });
    if (!notes || notes.length === 0) return `No note found with key "${key}".`;
    return `Note "${key}": ${notes[0].content}`;
  }
}

class SearchNotesTool extends Tool {
  constructor() {
    super('search_notes', "Search the user's notes by keyword.");
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        query: { type: 'string', description: 'The search query to match against keys, content, or tags' },
      },
      required: ['userId', 'query'],
    };
  }

  async execute({ userId, query }) {
    const notes = await supabase.select('notes', {
      match: { user_id: supabase.dataUserId(userId) },
      extraQuery: `&or=(key.ilike.%25${query}%25,content.ilike.%25${query}%25,tags.cs.%7B${query}%7D)`,
      order: 'updated_at.desc',
      range: { offset: 0 },
    });

    if (!notes || notes.length === 0) return 'No matching notes found.';

    const results = notes.map(n =>
      `- "${n.key}": ${n.content.length > 100 ? n.content.slice(0, 100) + '...' : n.content}`
    );
    return `Found ${notes.length} note(s):\n${results.join('\n')}`;
  }
}

class DeleteNoteTool extends Tool {
  constructor() {
    super('delete_note', 'Delete a saved note by its key.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        key: { type: 'string', description: 'The exact key of the note to delete' },
      },
      required: ['userId', 'key'],
    };
  }

  async execute({ userId, key }) {
    await supabase.delete('notes', { user_id: supabase.dataUserId(userId), key });
    return `Deleted note "${key}".`;
  }
}

module.exports = { SaveNoteTool, GetNoteTool, SearchNotesTool, DeleteNoteTool };
