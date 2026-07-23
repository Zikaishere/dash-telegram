const { Tool } = require('./base');
const Task = require('../database/models/Task');

function fmtDate(d) {
  if (!d) return '';
  return ' due ' + new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

class AddTaskTool extends Tool {
  constructor() {
    super('add_task', 'Add a task to the user\'s to-do list.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        title: { type: 'string', description: 'Task description' },
        dueDate: { type: 'string', description: 'Optional ISO 8601 due date' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
      },
      required: ['userId', 'title'],
    };
  }

  async execute({ userId, title, dueDate, priority, tags }) {
    const task = new Task({
      userId,
      title,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || 'medium',
      tags: tags || [],
      status: 'pending',
    });
    await task.save();
    return `Task added: "${title}"${fmtDate(dueDate)}`;
  }
}

class ListTasksTool extends Tool {
  constructor() {
    super('list_tasks', "List the user's tasks. Filter by status or tag.");
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        filter: { type: 'string', description: 'Filter: "pending" (default), "done", "all", or a specific tag name' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, filter }) {
    const match = { userId };
    let query = '';
    if (!filter || filter === 'pending') match.status = 'pending';
    else if (filter === 'done') match.status = 'done';
    else if (filter !== 'all') query = filter; // tag filter

    let tasks;
    if (query) {
      tasks = await Task.find({ userId, tags: query, status: { $ne: 'done' } }).sort({ dueDate: 1, createdAt: -1 });
    } else {
      tasks = await Task.find(match).sort({ dueDate: 1, createdAt: -1 });
    }

    if (!tasks || tasks.length === 0) return 'No tasks found.';

    return tasks.map(t => {
      const status = t.status === 'done' ? 'DONE' : 'PENDING';
      const due = t.dueDate ? fmtDate(t.dueDate) : '';
      const tagStr = t.tags?.length ? ` [${t.tags.join(', ')}]` : '';
      return `${status} — ${t.title}${due}${tagStr} (${t.priority})`;
    }).join('\n');
  }
}

class CompleteTaskTool extends Tool {
  constructor() {
    super('complete_task', 'Mark a task as completed by its ID.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        taskId: { type: 'string', description: 'The ID of the task. Ask the user which task to complete.' },
      },
      required: ['userId', 'taskId'],
    };
  }

  async execute({ userId, taskId }) {
    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId },
      { status: 'done' },
      { new: true }
    );
    if (!task) return 'Task not found.';
    return `Task completed: "${task.title}"`;
  }
}

class DeleteTaskTool extends Tool {
  constructor() {
    super('delete_task', 'Delete a task permanently by its ID.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        taskId: { type: 'string', description: 'The ID of the task to delete.' },
      },
      required: ['userId', 'taskId'],
    };
  }

  async execute({ userId, taskId }) {
    const result = await Task.deleteOne({ _id: taskId, userId });
    if (result.deletedCount === 0) return 'Task not found.';
    return 'Task deleted.';
  }
}

module.exports = { AddTaskTool, ListTasksTool, CompleteTaskTool, DeleteTaskTool };