const Tool = require('./base');
const supabase = require('../services/supabase');

class LogMealTool extends Tool {
  constructor() {
    super('log_meal', 'Log a meal or food intake for nutrition tracking.');
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
        imageUrl: { type: 'string', description: 'URL of a food photo' },
      },
      required: ['userId', 'food'],
    };
  }

  async execute({ userId, food, mealType, calories, protein, carbs, fat, notes, date, imageUrl }) {
    await supabase.insert('food_log', [{
      user_id: supabase.dataUserId(userId),
      food_name: food,
      meal_type: mealType || 'snack',
      calories: Math.round(calories || 0),
      protein: Math.round(protein || 0),
      carbs: Math.round(carbs || 0),
      fat: Math.round(fat || 0),
      date: date || new Date().toISOString().split('T')[0],
    }]);
    return `Logged: ${food} (${mealType || 'snack'}) — ${calories || 0} cal`;
  }
}

class GetNutritionReportTool extends Tool {
  constructor() {
    super('get_nutrition_report', 'Get a nutrition summary for a date range.');
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
    const start = from || new Date().toISOString().split('T')[0];
    const end = to || start;

    const entries = await supabase.select('food_log', {
      match: { user_id: supabase.dataUserId(userId) },
      extraQuery: `&date=gte.${start}&date=lte.${end}`,
      order: 'date.asc',
    });

    if (!entries || entries.length === 0) {
      return `No meals logged in this period.`;
    }

    const totals = entries.reduce((acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      count: acc.count + 1,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });

    const avg = (v) => Math.round(v / entries.length);
    const lines = [
      `Nutrition Report (${start} — ${end})`,
      `Total meals: ${entries.length}`,
      '',
      'Totals:',
      `  Calories: ${totals.calories} cal`,
      `  Protein:  ${totals.protein}g`,
      `  Carbs:    ${totals.carbs}g`,
      `  Fat:      ${totals.fat}g`,
      '',
      'Per meal avg:',
      `  Calories: ${avg(totals.calories)} cal`,
      `  Protein:  ${avg(totals.protein)}g`,
      `  Carbs:    ${avg(totals.carbs)}g`,
      `  Fat:      ${avg(totals.fat)}g`,
    ];
    return lines.join('\n');
  }
}

module.exports = { LogMealTool, GetNutritionReportTool };
