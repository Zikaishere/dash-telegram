const Reminder = require('../database/models/Reminder');
const { getBot } = require('../bot');

let interval;

function startScheduler() {
  interval = setInterval(async () => {
    try {
      const now = new Date();
      const due = await Reminder.find({
        notified: false,
        remindAt: { $lte: now },
      });

      for (const reminder of due) {
        const bot = getBot();
        if (bot) {
          await bot.sendMessage(
            reminder.userId,
            `Reminder: ${reminder.text}`,
          );
        }
        reminder.notified = true;
        await reminder.save();
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 30000);
}

function stopScheduler() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

module.exports = { startScheduler, stopScheduler };
