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
const TimerTool = require('./timer');
const WeatherTool = require('./weather');
const WebSearchTool = require('./webSearch');
const { SaveNoteTool, GetNoteTool, SearchNotesTool, DeleteNoteTool } = require('./notes');
const CreatePdfTool = require('./pdf');
const { AddEventTool, GetEventsTool, DeleteEventTool } = require('./calendar');
const { AddTaskTool, ListTasksTool, CompleteTaskTool, DeleteTaskTool } = require('./tasks');
const PomodoroTool = require('./pomodoro');
const { CreateFlashcardTool, QuizMeTool } = require('./study');
const GenerateTimetableTool = require('./timetable');

const registry = new ToolRegistry();
registry.register(new ReminderTool());
registry.register(new TimerTool());
registry.register(new WeatherTool());
registry.register(new WebSearchTool());
registry.register(new SaveNoteTool());
registry.register(new GetNoteTool());
registry.register(new SearchNotesTool());
registry.register(new DeleteNoteTool());
registry.register(new CreatePdfTool());
registry.register(new AddEventTool());
registry.register(new GetEventsTool());
registry.register(new DeleteEventTool());
registry.register(new AddTaskTool());
registry.register(new ListTasksTool());
registry.register(new CompleteTaskTool());
registry.register(new DeleteTaskTool());
registry.register(new PomodoroTool());
registry.register(new CreateFlashcardTool());
registry.register(new QuizMeTool());
registry.register(new GenerateTimetableTool());

module.exports = registry;
