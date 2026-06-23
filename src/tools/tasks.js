const Tool = require('./base');
const Task = require('../database/models/Task');

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
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags (e.g. work, personal, study)' },
      },
      required: ['userId', 'title'],
    };
  }

  async execute({ userId, title, dueDate, priority, tags }) {
    const task = new Task({ userId, title, dueDate: dueDate ? new Date(dueDate) : undefined, priority: priority || 'medium', tags: tags || [] });
    await task.save();
    return `Task added: "${title}"${dueDate ? ' due ' + new Date(dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}`;
  }
}

class ListTasksTool extends Tool {
  constructor() {
    super('list_tasks', 'List the user\'s tasks. Filter by status or tag.');
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
    const query = { userId };
    if (!filter || filter === 'pending') query.completed = false;
    else if (filter === 'done') query.completed = true;
    else if (filter !== 'all') query.tags = filter;

    const tasks = await Task.find(query).sort({ dueDate: 1, priority: -1, createdAt: -1 });
    if (tasks.length === 0) return 'No tasks found.';

    return tasks.map(t => {
      const status = t.completed ? 'DONE' : 'PENDING';
      const due = t.dueDate ? ' due ' + new Date(t.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      const tagStr = t.tags.length ? ` [${t.tags.join(', ')}]` : '';
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
        taskId: { type: 'string', description: 'The MongoDB _id of the task. Ask the user which task to complete.' },
      },
      required: ['userId', 'taskId'],
    };
  }

  async execute({ userId, taskId }) {
    const task = await Task.findOneAndUpdate({ _id: taskId, userId }, { completed: true }, { new: true });
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
        taskId: { type: 'string', description: 'The MongoDB _id of the task to delete.' },
      },
      required: ['userId', 'taskId'],
    };
  }

  async execute({ userId, taskId }) {
    const task = await Task.findOneAndDelete({ _id: taskId, userId });
    if (!task) return 'Task not found.';
    return `Deleted task: "${task.title}"`;
  }
}

module.exports = { AddTaskTool, ListTasksTool, CompleteTaskTool, DeleteTaskTool };
