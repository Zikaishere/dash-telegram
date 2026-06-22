const Tool = require('./base');
const Reminder = require('../database/models/Reminder');

class ReminderTool extends Tool {
  constructor() {
    super(
      'create_reminder',
      'Create a reminder for the user. Call this when they ask to be reminded about something at a future time or date. ' +
        'Always convert natural language times to Egypt timezone (Africa/Cairo). Do NOT ask the user for confirmation — just create it.',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: "The Telegram user ID to send the reminder to — use the value from the system prompt's user ID field",
        },
        text: {
          type: 'string',
          description: 'The reminder message content',
        },
        remindAt: {
          type: 'string',
          description:
            'ISO 8601 datetime string for when to send the reminder. ' +
            'Convert natural language times to Egypt timezone (Africa/Cairo, UTC+2 or UTC+3 depending on DST). ' +
            'For example, "tomorrow at 5pm" should become the next day at 17:00 Egypt time. ' +
            'Output as a full ISO 8601 string with timezone offset, e.g. 2026-06-23T17:00:00+03:00.',
        },
      },
      required: ['userId', 'text', 'remindAt'],
    };
  }

  async execute({ userId, text, remindAt }) {
    const reminder = new Reminder({
      userId,
      text,
      remindAt: new Date(remindAt),
    });
    await reminder.save();

    const dateStr = new Date(remindAt).toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    return `Reminder set for ${dateStr}: ${text}`;
  }
}

module.exports = ReminderTool;
