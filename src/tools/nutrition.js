const { Tool } = require('./base');
const MealEntry = require('../database/models/MealEntry');
const UserProfile = require('../database/models/UserProfile');
const DailyTotals = require('../database/models/DailyTotals');
const WeightLog = require('../database/models/WeightLog');

function getUserDate(userTimezone = 'Africa/Cairo') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

function getDateRange(date, userTimezone = 'Africa/Cairo') {
  const base = date || getUserDate(userTimezone);
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getOrCreateProfile(userId) {
  let profile = await UserProfile.findOne({ userId });
  if (!profile) {
    profile = await UserProfile.create({ userId });
  }
  return profile;
}

async function updateDailyTotals(userId, date, profile) {
  const { start, end } = getDateRange(date, profile.timezone);
  
  const entries = await MealEntry.find({
    userId,
    date: { $gte: start, $lte: end },
  });

  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + (e.totals?.calories || 0),
    protein: acc.protein + (e.totals?.protein || 0),
    carbs: acc.carbs + (e.totals?.carbs || 0),
    fat: acc.fat + (e.totals?.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const weightLog = await WeightLog.findOne({
    userId,
    date: { $gte: start, $lte: end },
  }).sort({ date: -1 });

  const streak = profile.streak || 0;
  const lastLogged = profile.lastLoggedDate;
  const today = new Date(start);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = streak;
  if (entries.length > 0) {
    if (!lastLogged || lastLogged < yesterday) {
      newStreak = streak + 1;
    }
  }

  await DailyTotals.findOneAndUpdate(
    { userId, date: start },
    {
      $set: {
        totals,
        goals: profile.goals,
        mealsCount: entries.length,
        streak: newStreak,
        weight: weightLog?.weight,
      },
    },
    { upsert: true, new: true }
  );

  return { totals, mealsCount: entries.length, streak: newStreak, weight: weightLog?.weight };
}

async function generateCoachingMessage(totals, goals, streak) {
  const lines = [];
  
  if (totals.protein < goals.protein) {
    const deficit = goals.protein - totals.protein;
    lines.push(`You're ${deficit}g short of your protein goal (${goals.protein}g).`);
    if (deficit <= 30) {
      lines.push(`A can of tuna (~25g), 200g Greek yogurt (~20g), or 100g chicken (~31g) would close the gap.`);
    } else {
      lines.push(`Consider adding a protein-rich meal or shake.`);
    }
  }
  
  const remainingCalories = goals.calories - totals.calories;
  if (remainingCalories < 200 && remainingCalories > 0) {
    lines.push(`You have ~${remainingCalories} kcal left for today.`);
  } else if (remainingCalories <= 0) {
    lines.push(`You've exceeded your calorie goal by ${Math.abs(remainingCalories)} kcal.`);
  }

  if (streak >= 7) {
    lines.push(`🔥 ${streak}-day logging streak! Keep it up!`);
  } else if (streak >= 3) {
    lines.push(`✨ ${streak}-day streak!`);
  }

  return lines.join(' ');
}

class LogMealTool extends Tool {
  constructor() {
    super('log_meal', 'Log a meal or food intake for nutrition tracking. Parses natural language, estimates macros, and saves structured meal entry.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        text: { type: 'string', description: 'Natural language description of the meal (e.g. "2 boiled eggs and toast")' },
        foods: { 
          type: 'array', 
          description: 'Pre-parsed food items from vision analysis. Each item: {name, amount, unit, calories, protein, carbs, fat}',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amount: { type: 'number' },
              unit: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
            },
            required: ['name', 'amount', 'unit', 'calories', 'protein', 'carbs', 'fat']
          }
        },
        mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Meal type' },
        date: { type: 'string', description: 'ISO date (defaults to today in user timezone)' },
        imageUrl: { type: 'string', description: 'URL of a food photo for vision analysis' },
        voiceTranscript: { type: 'string', description: 'Transcribed voice message' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, text, foods, mealType, date, imageUrl, voiceTranscript }) {
    const profile = await getOrCreateProfile(userId);
    const userDate = date ? new Date(date) : getUserDate(profile.timezone);
    const { start, end } = getDateRange(userDate, profile.timezone);

    let foodsWithMacros;
    if (foods && foods.length > 0) {
      // Use pre-parsed food data from vision analysis
      foodsWithMacros = foods.map(f => ({
        name: f.name,
        amount: f.amount,
        unit: f.unit,
        calories: Math.round(f.calories),
        protein: Math.round(f.protein),
        carbs: Math.round(f.carbs),
        fat: Math.round(f.fat),
        isEstimate: true,
        source: 'photo',
      }));
    } else {
      // Parse from text/voice
      const parsedFoods = await this._parseFoods(text || voiceTranscript || '', imageUrl);
      foodsWithMacros = await this._calculateMacros(parsedFoods);
    }

    const mealEntry = new MealEntry({
      userId,
      date: start,
      mealType: mealType || this._inferMealType(userDate),
      foods: foodsWithMacros,
      notes: text || '',
      imageUrl: imageUrl || '',
      voiceTranscript: voiceTranscript || '',
    });
    await mealEntry.save();

    const daily = await updateDailyTotals(userId, userDate, profile);
    const coaching = await generateCoachingMessage(daily.totals, profile.goals, daily.streak);

    const lines = [
      `✅ Logged ${mealType || this._inferMealType(userDate)}.`,
      '',
      ...foodsWithMacros.map(f => 
        `• ${f.name} (${f.amount}${f.unit}): ${f.calories} kcal, ${f.protein}g P, ${f.carbs}g C, ${f.fat}g F${f.isEstimate ? ' (est.)' : ''}`
      ),
      '',
      `Total: ${daily.totals.calories} kcal | ${daily.totals.protein}g P | ${daily.totals.carbs}g C | ${daily.totals.fat}g F`,
      '',
      `Today: ${daily.totals.calories} / ${profile.goals.calories} kcal | ${daily.totals.protein} / ${profile.goals.protein}g protein`,
    ];

    if (coaching) {
      lines.push('', `💡 ${coaching}`);
    }

    if (daily.streak >= 3) {
      lines.push(`🔥 ${daily.streak}-day streak!`);
    }

    return lines.join('\n');
  }

  _inferMealType(date) {
    const hour = date.getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    if (hour < 21) return 'dinner';
    return 'snack';
  }

  async _parseFoods(text, imageUrl) {
    if (!text && !imageUrl) return [];
    
    const foods = [];
    const items = (text || '').split(/[,;and]/).map(s => s.trim()).filter(Boolean);
    
    for (const item of items) {
      const match = item.match(/^(\d+(?:\.\d+)?)\s*(g|ml|oz|cup|piece|slice|tbsp|tsp)?\s*(.+)$/i);
      if (match) {
        foods.push({
          name: match[3].trim(),
          amount: parseFloat(match[1]),
          unit: match[2]?.toLowerCase() || 'g',
        });
      } else {
        foods.push({
          name: item,
          amount: 100,
          unit: 'g',
        });
      }
    }
    
    return foods;
  }

  async _calculateMacros(foods) {
    return foods.map(f => ({
      ...f,
      calories: Math.round(f.amount * 1.5),
      protein: Math.round(f.amount * 0.1),
      carbs: Math.round(f.amount * 0.2),
      fat: Math.round(f.amount * 0.05),
      isEstimate: true,
    }));
  }
}

class GetDailySummaryTool extends Tool {
  constructor() {
    super('get_daily_summary', 'Get today\'s nutrition summary with totals, goals, and coaching.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        date: { type: 'string', description: 'ISO date (defaults to today in user timezone)' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, date }) {
    const profile = await getOrCreateProfile(userId);
    const userDate = date ? new Date(date) : getUserDate(profile.timezone);
    const { start, end } = getDateRange(userDate, profile.timezone);

    const entries = await MealEntry.find({
      userId,
      date: { $gte: start, $lte: end },
    }).sort({ mealType: 1, createdAt: 1 });

    const daily = await updateDailyTotals(userId, userDate, profile);

    const mealsByType = entries.reduce((acc, e) => {
      if (!acc[e.mealType]) acc[e.mealType] = [];
      acc[e.mealType].push(e);
      return acc;
    }, {});

    const lines = [
      `📊 ${userDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      daily.streak >= 3 ? `🔥 ${daily.streak}-day streak!` : '',
      '',
      'Meals:',
    ];

    const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
    for (const type of mealOrder) {
      const meals = mealsByType[type] || [];
      if (meals.length === 0) continue;
      lines.push(`  ${type.charAt(0).toUpperCase() + type.slice(1)}:`);
      for (const meal of meals) {
        lines.push(`    ${meal.foods.map(f => `${f.name} (${f.calories} kcal)`).join(', ')} — ${meal.totals.calories} kcal`);
      }
    }

    lines.push(
      '',
      'Totals:',
      `  🔥 ${daily.totals.calories} / ${profile.goals.calories} kcal`,
      `  🥩 ${daily.totals.protein} / ${profile.goals.protein}g protein`,
      `  🍞 ${daily.totals.carbs} / ${profile.goals.carbs}g carbs`,
      `  🥑 ${daily.totals.fat} / ${profile.goals.fat}g fat`,
    );

    const coaching = await generateCoachingMessage(daily.totals, profile.goals, daily.streak);
    if (coaching) {
      lines.push('', `💡 ${coaching}`);
    }

    return lines.join('\n');
  }
}

class GetWeeklyReportTool extends Tool {
  constructor() {
    super('get_weekly_report', 'Get a weekly nutrition report with averages, trends, and streak info.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        weekStart: { type: 'string', description: 'ISO date for week start (Monday), defaults to this week' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, weekStart }) {
    const profile = await getOrCreateProfile(userId);
    const base = weekStart ? new Date(weekStart) : new Date();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const dailyTotals = await DailyTotals.find({
      userId,
      date: { $gte: monday, $lte: sunday },
    }).sort({ date: 1 });

    const weightLogs = await WeightLog.find({
      userId,
      date: { $gte: monday, $lte: sunday },
    }).sort({ date: 1 });

    const daysWithMeals = dailyTotals.filter(d => d.mealsCount > 0);
    const avgCalories = daysWithMeals.length > 0 
      ? Math.round(dailyTotals.reduce((a, d) => a + d.totals.calories, 0) / daysWithMeals.length)
      : 0;
    const avgProtein = daysWithMeals.length > 0
      ? Math.round(dailyTotals.reduce((a, d) => a + d.totals.protein, 0) / daysWithMeals.length)
      : 0;
    const proteinGoalDays = dailyTotals.filter(d => d.totals.protein >= d.goals.protein).length;

    const weightChange = weightLogs.length >= 2 
      ? (weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight).toFixed(1)
      : 'N/A';

    const maxStreak = Math.max(...dailyTotals.map(d => d.streak), 0);
    const missedDays = 7 - daysWithMeals.length;

    const lines = [
      `📈 Weekly Report (${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      '',
      'Averages:',
      `  🔥 ${avgCalories} kcal avg`,
      `  🥩 ${avgProtein}g protein avg`,
      `  ✅ Protein goal hit: ${proteinGoalDays}/7 days`,
      '',
      `Weight: ${weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight + ' kg' : 'No data'} (${weightChange} kg this week)`,
      `Streak: ${maxStreak} days max`,
      `Missed days: ${missedDays}`,
      '',
      'Daily breakdown:',
    ];

    for (const d of dailyTotals) {
      const dayName = d.date.toLocaleDateString('en-US', { weekday: 'short' });
      const pct = d.goals.calories > 0 ? Math.round((d.totals.calories / d.goals.calories) * 100) : 0;
      lines.push(`  ${dayName}: ${d.totals.calories} kcal (${pct}%), ${d.totals.protein}g P, ${d.mealsCount} meals${d.streak > 0 ? ` 🔥${d.streak}` : ''}`);
    }

    return lines.join('\n');
  }
}

class SetGoalsTool extends Tool {
  constructor() {
    super('set_goals', 'Set or update the user\'s nutrition goals (calories, protein, carbs, fat, weight goal).');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        calories: { type: 'number', description: 'Daily calorie goal' },
        protein: { type: 'number', description: 'Daily protein goal (grams)' },
        carbs: { type: 'number', description: 'Daily carbs goal (grams)' },
        fat: { type: 'number', description: 'Daily fat goal (grams)' },
        weightGoal: { type: 'number', description: 'Target weight (kg)' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, calories, protein, carbs, fat, weightGoal }) {
    const profile = await getOrCreateProfile(userId);
    
    if (calories) profile.goals.calories = calories;
    if (protein) profile.goals.protein = protein;
    if (carbs) profile.goals.carbs = carbs;
    if (fat) profile.goals.fat = fat;
    if (weightGoal) profile.weightGoal = weightGoal;
    
    await profile.save();

    return `Goals updated:\n🔥 ${profile.goals.calories} kcal\n🥩 ${profile.goals.protein}g protein\n🍞 ${profile.goals.carbs}g carbs\n🥑 ${profile.goals.fat}g fat${weightGoal ? `\n⚖️ Target weight: ${weightGoal} kg` : ''}`;
  }
}

class LogWeightTool extends Tool {
  constructor() {
    super('log_weight', 'Log the user\'s weight. Tracks trends and provides coaching.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        weight: { type: 'number', description: 'Weight in kg' },
        date: { type: 'string', description: 'ISO date (defaults to today)' },
        bodyFat: { type: 'number', description: 'Body fat percentage (optional)' },
      },
      required: ['userId', 'weight'],
    };
  }

  async execute({ userId, weight, date, bodyFat }) {
    const profile = await getOrCreateProfile(userId);
    const userDate = date ? new Date(date) : getUserDate(profile.timezone);
    const { start, end } = getDateRange(userDate, profile.timezone);

    const existing = await WeightLog.findOne({ userId, date: { $gte: start, $lte: end } });
    if (existing) {
      existing.weight = weight;
      existing.bodyFat = bodyFat;
      await existing.save();
    } else {
      await WeightLog.create({ userId, date: start, weight, bodyFat });
    }

    const trend7d = await this._getTrend(userId, 7);
    const trend30d = await this._getTrend(userId, 30);
    const coaching = this._generateWeightCoaching(weight, profile.weightGoal, trend7d);

    return `⚖️ Weight logged: ${weight} kg${bodyFat ? ` (${bodyFat}% body fat)` : ''}\n${trend7d !== null ? `📈 7-day trend: ${trend7d > 0 ? '+' : ''}${trend7d.toFixed(1)} kg` : ''}\n${trend30d !== null ? `📊 30-day trend: ${trend30d > 0 ? '+' : ''}${trend30d.toFixed(1)} kg` : ''}\n${coaching}`;
  }

  async _getTrend(userId, days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const logs = await WeightLog.find({
      userId,
      date: { $gte: since },
    }).sort({ date: 1 });

    if (logs.length < 2) return null;
    return logs[logs.length - 1].weight - logs[0].weight;
  }

  _generateWeightCoaching(current, goal, trend7d) {
    if (!goal) return '';
    const diff = current - goal;
    if (Math.abs(diff) < 0.5) return '🎯 You\'re at your target weight!';
    if (diff > 0) {
      if (trend7d !== null && trend7d < 0) return `📉 Trending down — ${diff.toFixed(1)} kg to goal. Keep it up!`;
      return `⚖️ ${diff.toFixed(1)} kg above goal. Consider a slight calorie deficit.`;
    } else {
      if (trend7d !== null && trend7d > 0) return `📈 Trending up — ${Math.abs(diff).toFixed(1)} kg to goal.`;
      return `⚖️ ${Math.abs(diff).toFixed(1)} kg below goal. Consider increasing calories.`;
    }
  }
}

class GetWeightHistoryTool extends Tool {
  constructor() {
    super('get_weight_history', 'Get the user\'s weight history with trends.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        days: { type: 'number', description: 'Number of days of history (default 30)' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, days = 30 }) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const logs = await WeightLog.find({
      userId,
      date: { $gte: since },
    }).sort({ date: 1 });

    if (logs.length === 0) return 'No weight logs found.';

    const lines = [`⚖️ Weight History (${logs.length} entries)`];
    for (const log of logs) {
      lines.push(`  ${log.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${log.weight} kg${log.bodyFat ? ` (${log.bodyFat}% BF)` : ''}`);
    }

    if (logs.length >= 2) {
      const totalChange = logs[logs.length - 1].weight - logs[0].weight;
      lines.push(`\nChange: ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} kg over ${days} days`);
    }

    return lines.join('\n');
  }
}

module.exports = { 
  LogMealTool, 
  GetDailySummaryTool, 
  GetWeeklyReportTool, 
  SetGoalsTool, 
  LogWeightTool, 
  GetWeightHistoryTool 
};