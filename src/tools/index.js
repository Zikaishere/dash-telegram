class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  getAll() {
    return Array.from(this.tools.values());
  }

  getFunctionDefinitions() {
    return this.getAll().map((tool) => tool.toFunctionDefinition());
  }

  async execute(name, params) {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }
    return tool.execute(params);
  }
}

const ReminderTool = require('./reminder');

const registry = new ToolRegistry();
registry.register(new ReminderTool());

module.exports = registry;
