class Tool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  async execute(params) {
    throw new Error(`${this.name}: execute() must be implemented by subclass`);
  }

  toFunctionDefinition() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.getParametersSchema(),
      },
    };
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {},
      additionalProperties: false,
    };
  }
}

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

module.exports = { Tool, ToolRegistry };