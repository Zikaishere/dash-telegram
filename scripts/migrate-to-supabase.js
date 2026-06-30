// Migrate MongoDB data to Supabase
// Run: node scripts/migrate-to-supabase.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { connectDatabase, disconnectDatabase } = require('../src/database');
const Task = require('../src/database/models/Task');
const Event = require('../src/database/models/Event');
const Note = require('../src/database/models/Note');
const NutritionLog = require('../src/database/models/NutritionLog');
const config = require('../src/config');
const supabase = require('../src/services/supabase');

const USER_ID = config.supabaseUserId;

async function migrateTasks() {
  console.log('\nMigrating tasks...');
  const tasks = await Task.find({}).lean();
  console.log(`  Found ${tasks.length} tasks`);

  for (const t of tasks) {
    try {
      await supabase.insert('todos', [{
        user_id: USER_ID,
        title: t.title,
        due_date: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
        priority: t.priority || 'medium',
        status: t.completed ? 'done' : 'pending',
        tags: t.tags || [],
        created_at: t.createdAt?.toISOString(),
      }], { upsert: true });
    } catch (err) {
      console.error(`  Failed task "${t.title}": ${err.message}`);
    }
  }
  console.log(`  Done: ${tasks.length} tasks migrated`);
}

async function migrateEvents() {
  console.log('\nMigrating events...');
  const events = await Event.find({}).lean();
  console.log(`  Found ${events.length} events`);

  for (const e of events) {
    try {
      await supabase.insert('calendar_events', [{
        user_id: USER_ID,
        title: e.title,
        start_time: e.start.toISOString(),
        end_time: e.end?.toISOString() || null,
        all_day: e.allDay || false,
        notes: e.notes || '',
        telegram_event_id: String(e._id),
      }]);
    } catch (err) {
      console.error(`  Failed event "${e.title}": ${err.message}`);
    }
  }
  console.log(`  Done: ${events.length} events migrated`);
}

async function migrateNotes() {
  console.log('\nMigrating notes...');
  const notes = await Note.find({}).lean();
  console.log(`  Found ${notes.length} notes`);

  for (const n of notes) {
    try {
      await supabase.insert('notes', [{
        user_id: USER_ID,
        key: n.key,
        title: n.key,
        content: n.content,
        tags: n.tags || [],
      }], { upsert: true });
    } catch (err) {
      console.error(`  Failed note "${n.key}": ${err.message}`);
    }
  }
  console.log(`  Done: ${notes.length} notes migrated`);
}

async function migrateNutrition() {
  console.log('\nMigrating nutrition logs...');
  const logs = await NutritionLog.find({}).lean();
  console.log(`  Found ${logs.length} nutrition logs`);

  for (const l of logs) {
    try {
      const dateStr = l.date ? new Date(l.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      await supabase.insert('food_log', [{
        user_id: USER_ID,
        food_name: l.food,
        meal_type: l.mealType || 'snack',
        calories: Math.round(l.calories || 0),
        protein: Math.round(l.protein || 0),
        carbs: Math.round(l.carbs || 0),
        fat: Math.round(l.fat || 0),
        date: dateStr,
      }]);
    } catch (err) {
      console.error(`  Failed nutrition "${l.food}": ${err.message}`);
    }
  }
  console.log(`  Done: ${logs.length} nutrition logs migrated`);
}

async function main() {
  console.log('=== MongoDB → Supabase Migration ===');
  console.log(`Supabase user ID: ${USER_ID}`);
  console.log(`MongoDB URI: ${config.mongodbUri}`);

  try {
    await connectDatabase(config.mongodbUri);
    console.log('Connected to MongoDB');

    await migrateTasks();
    await migrateEvents();
    await migrateNotes();
    await migrateNutrition();

    console.log('\n=== Migration complete ===');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

main();
