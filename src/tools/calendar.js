const Tool = require('./base');
const supabase = require('../services/supabase');

function fmtTime(d) {
  return new Date(d).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

class AddEventTool extends Tool {
  constructor() {
    super('add_event', "Add an event to the user's calendar.");
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        title: { type: 'string', description: 'Event title' },
        start: { type: 'string', description: 'ISO 8601 start datetime. Use user timezone.' },
        end: { type: 'string', description: 'ISO 8601 end datetime (optional)' },
        notes: { type: 'string', description: 'Optional notes or description' },
      },
      required: ['userId', 'title', 'start'],
    };
  }

  async execute({ userId, title, start, end, notes }) {
    await supabase.insert('calendar_events', [{
      user_id: supabase.dataUserId(userId),
      title,
      start_time: start,
      end_time: end || null,
      notes: notes || '',
    }]);
    return `Event added: "${title}" at ${fmtTime(start)}`;
  }
}

class GetEventsTool extends Tool {
  constructor() {
    super('get_events', "Get events from the user's calendar for a date range.");
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        from: { type: 'string', description: 'ISO 8601 start of range' },
        to: { type: 'string', description: 'ISO 8601 end of range' },
      },
      required: ['userId', 'from', 'to'],
    };
  }

  async execute({ userId, from, to }) {
    const events = await supabase.select('calendar_events', {
      match: { user_id: supabase.dataUserId(userId) },
      extraQuery: `&start_time=gte.${from}&start_time=lte.${to}`,
      order: 'start_time.asc',
    });

    if (!events || events.length === 0) return 'No events in this period.';
    return events.map(e => {
      const time = fmtTime(e.start_time);
      return `${time} — ${e.title}${e.notes ? ' (' + e.notes + ')' : ''}`;
    }).join('\n');
  }
}

class DeleteEventTool extends Tool {
  constructor() {
    super('delete_event', 'Delete an event from the calendar by its ID.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        eventId: { type: 'string', description: 'The ID of the event to delete.' },
      },
      required: ['userId', 'eventId'],
    };
  }

  async execute({ userId, eventId }) {
    await supabase.delete('calendar_events', { id: eventId, user_id: supabase.dataUserId(userId) });
    return 'Event deleted.';
  }
}

module.exports = { AddEventTool, GetEventsTool, DeleteEventTool };
