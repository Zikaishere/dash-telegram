const Tool = require('./base');
const NutritionLog = require('../database/models/NutritionLog');

class LogMealTool extends Tool {
  constructor() {
    super('log_meal', 'Log a meal or food intake for nutrition tracking. Includes calories, protein, carbs, fat, and meal type.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        food: { type: 'string', description: 'Description of the food eaten' },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Which meal' },
        calories: { type: 'number', description: 'Estimated calories' },
        protein: { type: 'number', description: 'Protein in grams' },
        carbs: { type: 'number', description: 'Carbohydrates in grams' },
        fat: { type: 'number', description: 'Fat in grams' },
        notes: { type: 'string', description: 'Optional notes' },
        date: { type: 'string', description: 'Date in ISO format (defaults to today)' },
        imageUrl: { type: 'string', description: 'URL of a food photo (for AI vision analysis)' },
      },
      required: ['userId', 'food'],
    };
  }

  async execute({ userId, food, mealType, calories, protein, carbs, fat, notes, date, imageUrl }) {
    const entry = new NutritionLog({
      userId,
      food,
      mealType: mealType || 'snack',
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
      notes: notes || '',
      imageUrl: imageUrl || '',
      date: date ? new Date(date) : new Date(),
    });
    await entry.save();
    return `Logged: ${food} (${mealType || 'snack'}) — ${calories || 0} cal, ${protein || 0}g protein, ${carbs || 0}g carbs, ${fat || 0}g fat`;
  }
}

class GetNutritionReportTool extends Tool {
  constructor() {
    super('get_nutrition_report', 'Get a nutrition summary for a date range. Shows totals and averages for calories and macros.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        from: { type: 'string', description: 'ISO date start of range (defaults to today)' },
        to: { type: 'string', description: 'ISO date end of range (defaults to today)' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, from, to }) {
    const start = from ? new Date(from) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = to ? new Date(to) : new Date(start);
    end.setHours(23, 59, 59, 999);

    const entries = await NutritionLog.find({
      userId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    if (entries.length === 0) {
      return `No meals logged between ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} and ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
    }

    const totals = entries.reduce((acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      meals: acc.meals + 1,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });

    const avg = (v) => Math.round(v / entries.length);

    const lines = [
      `Nutrition Report (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      `Total meals: ${entries.length}`,
      '',
      'Totals:',
      `  Calories: ${totals.calories} cal`,
      `  Protein:  ${totals.protein}g`,
      `  Carbs:    ${totals.carbs}g`,
      `  Fat:      ${totals.fat}g`,
      '',
      'Per meal average:',
      `  Calories: ${avg(totals.calories)} cal`,
      `  Protein:  ${avg(totals.protein)}g`,
      `  Carbs:    ${avg(totals.carbs)}g`,
      `  Fat:      ${avg(totals.fat)}g`,
      '',
      'Meals:',
      ...entries.map(e => {
        const time = e.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `  ${time} [${e.mealType}] ${e.food} — ${e.calories || '?'} cal`;
      }),
    ];

    return lines.join('\n');
  }
}

module.exports = { LogMealTool, GetNutritionReportTool };
