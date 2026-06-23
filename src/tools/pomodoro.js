const Tool = require('./base');
const Reminder = require('../database/models/Reminder');

class PomodoroTool extends Tool {
  constructor() {
    super(
      'start_pomodoro',
      'Start a Pomodoro study timer with work sessions, breaks, and multiple cycles. ' +
      'Call this when the user says "start pomodoro" or "study with timer".',
    );
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        work_minutes: { type: 'number', description: 'Minutes per work session (default 25)' },
        break_minutes: { type: 'number', description: 'Minutes per break (default 5)' },
        cycles: { type: 'number', description: 'Number of cycles (default 4)' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, work_minutes, break_minutes, cycles }) {
    const work = work_minutes || 25;
    const rest = break_minutes || 5;
    const count = cycles || 4;
    const now = Date.now();
    let cursor = now;

    for (let i = 1; i <= count; i++) {
      const workAt = new Date(cursor);
      const workEnd = new Date(cursor + work * 60000);

      await Reminder.create({ userId, text: `Work session ${i}/${count} — focus for ${work} min`, remindAt: workAt });

      cursor += work * 60000;

      if (i < count) {
        const breakAt = new Date(cursor);
        await Reminder.create({ userId, text: `Break ${i}/${count} — ${rest} min rest`, remindAt: breakAt });
        cursor += rest * 60000;
      } else {
        const doneAt = new Date(cursor);
        await Reminder.create({ userId, text: `All ${count} Pomodoro cycles complete!`, remindAt: doneAt });
      }
    }

    return `Started ${count} Pomodoro cycles: ${work} min work / ${rest} min break. Total time: ${Math.round((cursor - now) / 60000)} min.`;
  }
}

module.exports = PomodoroTool;
