const express = require('express');
const Conversation = require('./database/models/Conversation');
const Event = require('./database/models/Event');
const Task = require('./database/models/Task');
const NutritionLog = require('./database/models/NutritionLog');
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

    const match = { userId };
    if (status === 'done') match.status = 'done';
    else if (status === 'pending') match.status = 'pending';

    let query = Task.find(match).sort({ dueDate: 1, createdAt: -1 });
    if (tag) query = query.find({ tags: tag });

    const tasks = await query.exec();
    res.json(tasks || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { userId, title, dueDate, priority, tags } = req.body;
    if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });
    const task = new Task({
      userId, title, dueDate: dueDate || null,
      priority: priority || 'medium', tags: tags || [], status: 'pending',
    });
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
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

    const match = { userId };
    if (from || to) match.start = {};
    if (from) match.start.$gte = new Date(from);
    if (to) match.start.$lte = new Date(to);

    const events = await Event.find(match).sort({ start: 1 });
    res.json(events || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { userId, title, start, end, allDay, notes } = req.body;
    if (!userId || !title || !start) return res.status(400).json({ error: 'userId, title and start required' });
    const event = new Event({
      userId, title, start: new Date(start), end: end ? new Date(end) : null,
      allDay: allDay || false, notes: notes || '',
    });
    await event.save();
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
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

    const match = { userId };
    if (from || to) match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);

    const entries = await NutritionLog.find(match).sort({ date: -1 });
    res.json(entries || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/nutrition', async (req, res) => {
  try {
    const { userId, date, mealType, food, calories, protein, carbs, fat, notes, imageUrl } = req.body;
    if (!userId || !food) return res.status(400).json({ error: 'userId and food required' });
    const entry = new NutritionLog({
      userId, food,
      mealType: mealType || 'snack', date: date ? new Date(date) : new Date(),
      calories: Math.round(calories || 0), protein: Math.round(protein || 0),
      carbs: Math.round(carbs || 0), fat: Math.round(fat || 0),
      notes: notes || '', imageUrl: imageUrl || '',
    });
    await entry.save();
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;