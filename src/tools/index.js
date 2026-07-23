const { Tool } = require('./base');
const ToolRegistry = require('./base').ToolRegistry;

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
const { 
  LogMealTool, 
  GetDailySummaryTool, 
  GetWeeklyReportTool, 
  SetGoalsTool, 
  LogWeightTool, 
  GetWeightHistoryTool 
} = require('./nutrition');

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
registry.register(new LogMealTool());
registry.register(new GetDailySummaryTool());
registry.register(new GetWeeklyReportTool());
registry.register(new SetGoalsTool());
registry.register(new LogWeightTool());
registry.register(new GetWeightHistoryTool());

module.exports = registry;