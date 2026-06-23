const Tool = require('./base');
const Event = require('../database/models/Event');

class AddEventTool extends Tool {
  constructor() {
    super('add_event', 'Add an event to the user\'s calendar. Use when they say "schedule" or "add to calendar" or "I have an event".');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        title: { type: 'string', description: 'Event title' },
        start: { type: 'string', description: 'ISO 8601 start datetime. Always use the user\'s timezone.' },
        end: { type: 'string', description: 'ISO 8601 end datetime (optional)' },
        notes: { type: 'string', description: 'Optional notes or description' },
      },
      required: ['userId', 'title', 'start'],
    };
  }

  async execute({ userId, title, start, end, notes }) {
    const event = new Event({ userId, title, start: new Date(start), end: end ? new Date(end) : undefined, notes: notes || '' });
    await event.save();
    return `Event added: "${title}" at ${new Date(start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }
}

class GetEventsTool extends Tool {
  constructor() {
    super('get_events', 'Get events from the user\'s calendar for a date range.');
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
    const events = await Event.find({ userId, start: { $gte: new Date(from), $lte: new Date(to) } }).sort({ start: 1 });
    if (events.length === 0) return 'No events in this period.';
    return events.map(e => {
      const time = e.allDay ? 'All day' : new Date(e.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
        eventId: { type: 'string', description: 'The MongoDB _id of the event to delete. Ask the user for the specific event title to look it up.' },
      },
      required: ['userId', 'eventId'],
    };
  }

  async execute({ userId, eventId }) {
    const result = await Event.findOneAndDelete({ _id: eventId, userId });
    if (!result) return 'Event not found or already deleted.';
    return `Deleted event: "${result.title}"`;
  }
}

module.exports = { AddEventTool, GetEventsTool, DeleteEventTool };
