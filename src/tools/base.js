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

module.exports = Tool;
