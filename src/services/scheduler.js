const { Queue, Worker } = require('bullmq');
const mongoose = require('mongoose');
const config = require('../config');

const Reminder = require('../database/models/Reminder');
const SchedulerState = require('../database/models/SchedulerState');

let reminderQueue;
let reminderWorker;
let schedulerWorker;

const REDIS_CONNECTION = {
  host: new URL(config.redisUrl).hostname || 'localhost',
  port: parseInt(new URL(config.redisUrl).port) || 6379,
  maxRetriesPerRequest: null,
};

async function initQueues() {
  reminderQueue = new Queue('reminders', { connection: REDIS_CONNECTION });
  
  reminderWorker = new Worker('reminders', async (job) => {
    const { reminderId } = job.data;
    const reminder = await Reminder.findById(reminderId);
    
    if (!reminder || reminder.notified) {
      return { skipped: true, reason: 'Not found or already notified' };
    }
    
    const { getBot } = require('../bot');
    const bot = getBot();
    
    if (bot) {
      await bot.sendMessage(reminder.userId, `Reminder: ${reminder.text}`);
    }
    
    reminder.notified = true;
    await reminder.save();
    
    await SchedulerState.findOneAndUpdate(
      { name: 'reminder_delivery' },
      { $set: { lastRun: new Date(), lastReminderId: reminderId } },
      { upsert: true }
    );
    
    return { delivered: true, reminderId };
  }, { connection: REDIS_CONNECTION });

  reminderWorker.on('completed', (job) => {
    console.log(`Reminder job ${job.id} completed`);
  });
  
  reminderWorker.on('failed', (job, err) => {
    console.error(`Reminder job ${job?.id} failed:`, err);
  });

  schedulerWorker = new Worker('scheduler', async (job) => {
    const now = new Date();
    const due = await Reminder.find({
      notified: false,
      remindAt: { $lte: now },
    }).limit(100);

    let processed = 0;
    for (const reminder of due) {
      await reminderQueue.add('deliver', { reminderId: reminder._id }, {
        jobId: `reminder_${reminder._id}`,
        removeOnComplete: true,
        removeOnFail: false,
      });
      processed++;
    }

    await SchedulerState.findOneAndUpdate(
      { name: 'scheduler_poll' },
      { $set: { lastRun: now, processed } },
      { upsert: true }
    );

    return { processed, timestamp: now };
  }, { connection: REDIS_CONNECTION });

  // Use setInterval instead of JobScheduler for simplicity
  setInterval(async () => {
    try {
      await schedulerWorker.addJob('poll-reminders', {}, { 
        jobId: `poll_${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (err) {
      console.error('Scheduler poll error:', err);
    }
  }, 30000);
}

async function startScheduler() {
  console.log('Starting bullmq scheduler...');
  await initQueues();
  console.log('Scheduler started');
}

async function stopScheduler() {
  console.log('Stopping scheduler...');
  if (reminderWorker) await reminderWorker.close();
  if (schedulerWorker) await schedulerWorker.close();
  if (reminderQueue) await reminderQueue.close();
  console.log('Scheduler stopped');
}

async function scheduleReminder(reminder) {
  if (!reminderQueue) await initQueues();
  
  const delay = reminder.remindAt.getTime() - Date.now();
  if (delay <= 0) {
    await reminderQueue.add('deliver', { reminderId: reminder._id }, {
      jobId: `reminder_${reminder._id}`,
      removeOnComplete: true,
    });
  } else {
    await reminderQueue.add('deliver', { reminderId: reminder._id }, {
      jobId: `reminder_${reminder._id}`,
      delay,
      removeOnComplete: true,
    });
  }
}

async function getSchedulerState(name) {
  return SchedulerState.findOne({ name });
}

module.exports = { startScheduler, stopScheduler, scheduleReminder, getSchedulerState };