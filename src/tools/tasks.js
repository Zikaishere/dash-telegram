const Tool = require('./base');
const supabase = require('../services/supabase');

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
    await supabase.insert('todos', {
      user_id: supabase.dataUserId(userId),
      title,
      due_date: dueDate || null,
      priority: priority || 'medium',
      tags: tags || [],
      status: 'pending',
    });
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
    const match = { user_id: supabase.dataUserId(userId) };
    let query = '';
    if (!filter || filter === 'pending') match.status = 'pending';
    else if (filter === 'done') match.status = 'done';
    else if (filter !== 'all') query = `&tags=cs.%7B${filter}%7D`;

    const tasks = await supabase.select('todos', { match, order: 'due_date.asc.nullslast', extraQuery: query });
    if (!tasks || tasks.length === 0) return 'No tasks found.';

    return tasks.map(t => {
      const status = t.status === 'done' ? 'DONE' : 'PENDING';
      const due = t.due_date ? fmtDate(t.due_date) : '';
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
    await supabase.update('todos', { id: taskId, user_id: supabase.dataUserId(userId) }, { status: 'done' });
    return `Task completed.`;
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
    await supabase.delete('todos', { id: taskId, user_id: supabase.dataUserId(userId) });
    return `Task deleted.`;
  }
}

module.exports = { AddTaskTool, ListTasksTool, CompleteTaskTool, DeleteTaskTool };
