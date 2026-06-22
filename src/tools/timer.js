const Tool = require('./base');
const Reminder = require('../database/models/Reminder');

class TimerTool extends Tool {
  constructor() {
    super(
      'create_timer',
      'Create a timer (countdown) for the user. Use this when they say things like "set a timer for 10 minutes" or "remind me in 5 minutes". Do NOT use create_reminder for short timers, use this instead.',
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
        text: {
          type: 'string',
          description: 'What the timer is for (e.g. "Pasta is done", "Take the cake out")',
        },
        duration_minutes: {
          type: 'number',
          description: 'How many minutes from now to trigger the timer',
        },
      },
      required: ['userId', 'text', 'duration_minutes'],
    };
  }

  async execute({ userId, text, duration_minutes }) {
    const remindAt = new Date(Date.now() + duration_minutes * 60000);

    const reminder = new Reminder({ userId, text, remindAt });
    await reminder.save();

    const totalSec = Math.round(duration_minutes * 60);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const display = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    return `Timer set for ${display}: ${text}`;
  }
}

module.exports = TimerTool;
