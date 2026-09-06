const Reminder = require('../database/models/Reminder');

let intervalHandle;

async function deliverDues() {
  const due = await Reminder.find({
    notified: false,
    remindAt: { $lte: new Date() },
  }).limit(100);

  const { getBot } = require('../bot');
  const bot = getBot();

  let processed = 0;
  for (const reminder of due) {
    try {
      if (bot) {
        await bot.sendMessage(reminder.userId, `Reminder: ${reminder.text}`);
      }

      reminder.notified = true;
      await reminder.save();
      processed++;
    } catch (err) {
      console.error('Reminder delivery failed:', err.message);
    }
  }

  return processed;
}

async function startScheduler() {
  console.log('Starting reminder scheduler...');
  await deliverDues();
  intervalHandle = setInterval(() => {
    deliverDues().catch((err) => console.error('Scheduler poll error:', err.message));
  }, 30000);
  console.log('Scheduler started');
}

async function stopScheduler() {
  console.log('Stopping scheduler...');
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  console.log('Scheduler stopped');
}

module.exports = { startScheduler, stopScheduler, deliverDues };