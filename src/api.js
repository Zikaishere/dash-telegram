const express = require('express');
const supabase = require('./services/supabase');
const { generateWithTools } = require('./services/openrouter');
const toolRegistry = require('./tools');

const router = express.Router();
router.use(express.json({ limit: '10mb' }));

// AI Chat
router.post('/ai/chat', async (req, res) => {
  try {
    const { userId, message, research, image, systemPrompt } = req.body;
    if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });

    const systemContext = `User ID: ${userId}`;
    let userContent = message;
    if (research) {
      userContent = 'Research Mode: ON\nDeeply research using web_search multiple times. Compile a thorough report.\n\nUser query: ' + message;
    }
    if (image) userContent += '\n[Image: ' + image + ']';

    const messages = [{ role: 'user', content: userContent }];
    const response = await generateWithTools(messages, toolRegistry, systemContext, null, null, null, research ? 16000 : undefined, null, false, systemPrompt);
    res.json({ content: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tasks
router.get('/tasks', async (req, res) => {
  try {
    const { userId, status, tag } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const uid = supabase.dataUserId(userId);
    const match = { user_id: uid };
    let extra = '';
    if (status === 'done') match.status = 'done';
    else if (status === 'pending') match.status = 'pending';
    if (tag) extra = `&tags=cs.%7B${tag}%7D`;

    const tasks = await supabase.select('todos', { match, order: 'created_at.desc', extraQuery: extra });
    res.json(tasks || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { userId, title, dueDate, priority, tags } = req.body;
    if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });
    const [task] = await supabase.insert('todos', [{
      user_id: supabase.dataUserId(userId), title, due_date: dueDate || null,
      priority: priority || 'medium', tags: tags || [], status: 'pending',
    }]);
    res.json(task || { success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    await supabase.update('todos', { id: req.params.id }, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    await supabase.delete('todos', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Events
router.get('/events', async (req, res) => {
  try {
    const { userId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const match = { user_id: supabase.dataUserId(userId) };
    let extra = '';
    if (from) extra += `&start_time=gte.${from}`;
    if (to) extra += `&start_time=lte.${to}`;
    const events = await supabase.select('calendar_events', { match, order: 'start_time.asc', extraQuery: extra });
    res.json(events || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { userId, title, start, end, allDay, notes } = req.body;
    if (!userId || !title || !start) return res.status(400).json({ error: 'userId, title and start required' });
    const [event] = await supabase.insert('calendar_events', [{
      user_id: supabase.dataUserId(userId), title, start_time: start, end_time: end || null,
      all_day: allDay || false, notes: notes || '',
    }]);
    res.json(event || { success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await supabase.delete('calendar_events', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notes
router.get('/notes', async (req, res) => {
  try {
    const { userId, query } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const match = { user_id: supabase.dataUserId(userId) };
    const extra = query ? `&or=(key.ilike.%25${query}%25,content.ilike.%25${query}%25,tags.cs.%7B${query}%7D)` : '';
    const notes = await supabase.select('notes', { match, order: 'updated_at.desc', extraQuery: extra });
    res.json(notes || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/notes', async (req, res) => {
  try {
    const { userId, key, content, tags } = req.body;
    if (!userId || !key || !content) return res.status(400).json({ error: 'userId, key and content required' });

    const existing = await supabase.select('notes', { match: { user_id: supabase.dataUserId(userId), key } });
    if (existing && existing.length > 0) {
      await supabase.update('notes', { id: existing[0].id }, { content, tags: tags || [] });
      res.json(existing[0]);
    } else {
      const [note] = await supabase.insert('notes', [{ user_id: supabase.dataUserId(userId), key, title: key, content, tags: tags || [] }]);
      res.json(note || { success: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/notes/:key', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await supabase.delete('notes', { user_id: supabase.dataUserId(userId), key: req.params.key });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nutrition
router.get('/nutrition', async (req, res) => {
  try {
    const { userId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const match = { user_id: supabase.dataUserId(userId) };
    let extra = '';
    if (from) extra += `&date=gte.${from}`;
    if (to) extra += `&date=lte.${to}`;
    const entries = await supabase.select('food_log', { match, order: 'logged_at.desc', extraQuery: extra });
    res.json(entries || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/nutrition', async (req, res) => {
  try {
    const { userId, date, mealType, food, calories, protein, carbs, fat, notes, imageUrl } = req.body;
    if (!userId || !food) return res.status(400).json({ error: 'userId and food required' });
    const [entry] = await supabase.insert('food_log', [{
      user_id: supabase.dataUserId(userId), food_name: food,
      meal_type: mealType || 'snack', date: date || new Date().toISOString().split('T')[0],
      calories: Math.round(calories || 0), protein: Math.round(protein || 0),
      carbs: Math.round(carbs || 0), fat: Math.round(fat || 0),
    }]);
    res.json(entry || { success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
