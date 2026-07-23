const MealEntry = require('../../src/database/models/MealEntry');
const UserProfile = require('../../src/database/models/UserProfile');
const WeightLog = require('../../src/database/models/WeightLog');
const DailyTotals = require('../../src/database/models/DailyTotals');

describe('MealEntry Model', () => {
  const userId = 'test_user_1';

  test('creates a meal entry with foods and calculates totals', async () => {
    const entry = new MealEntry({
      userId,
      date: new Date('2024-01-15'),
      mealType: 'breakfast',
      foods: [
        { name: 'Eggs', amount: 2, unit: 'piece', calories: 160, protein: 13, carbs: 1, fat: 11 },
        { name: 'Toast', amount: 1, unit: 'slice', calories: 80, protein: 3, carbs: 15, fat: 1 },
      ],
    });
    await entry.save();

    expect(entry.totals.calories).toBe(240);
    expect(entry.totals.protein).toBe(16);
    expect(entry.totals.carbs).toBe(16);
    expect(entry.totals.fat).toBe(12);
    expect(entry.mealType).toBe('breakfast');
  });

  test('calculates totals on save via pre-save hook', async () => {
    const entry = await MealEntry.create({
      userId,
      date: new Date('2024-01-15'),
      mealType: 'lunch',
      foods: [
        { name: 'Chicken', amount: 150, unit: 'g', calories: 250, protein: 35, carbs: 0, fat: 10 },
      ],
    });

    expect(entry.totals.calories).toBe(250);
    expect(entry.totals.protein).toBe(35);
  });

  test('requires userId and date', async () => {
    const entry = new MealEntry({ mealType: 'dinner', foods: [] });
    await expect(entry.save()).rejects.toThrow();
  });

  test('validates mealType enum', async () => {
    const entry = new MealEntry({
      userId,
      date: new Date(),
      mealType: 'invalid',
      foods: [],
    });
    await expect(entry.save()).rejects.toThrow();
  });

  test('defaults mealType to snack', async () => {
    const entry = await MealEntry.create({
      userId,
      date: new Date(),
      foods: [{ name: 'Apple', amount: 1, unit: 'piece', calories: 95, protein: 0, carbs: 25, fat: 0 }],
    });
    expect(entry.mealType).toBe('snack');
  });
});

describe('UserProfile Model', () => {
  test('creates profile with default goals', async () => {
    const profile = await UserProfile.create({ userId: 'test_user_2' });
    
    expect(profile.goals.calories).toBe(2000);
    expect(profile.goals.protein).toBe(150);
    expect(profile.goals.carbs).toBe(200);
    expect(profile.goals.fat).toBe(70);
    expect(profile.units).toBe('metric');
    expect(profile.timezone).toBe('Africa/Cairo');
    expect(profile.streak).toBe(0);
  });

  test('enforces unique userId', async () => {
    await UserProfile.create({ userId: 'test_user_3' });
    const dup = new UserProfile({ userId: 'test_user_3' });
    await expect(dup.save()).rejects.toThrow();
  });

  test('updates updatedAt on save', async () => {
    const profile = await UserProfile.create({ userId: 'test_user_4' });
    const originalUpdated = profile.updatedAt;
    
    await new Promise(r => setTimeout(r, 10));
    profile.goals.calories = 2500;
    await profile.save();
    
    expect(profile.updatedAt.getTime()).toBeGreaterThan(originalUpdated.getTime());
  });

  test('accepts custom goals', async () => {
    const profile = await UserProfile.create({
      userId: 'test_user_5',
      goals: { calories: 1800, protein: 140, carbs: 180, fat: 60 },
      weightGoal: 70,
    });
    
    expect(profile.goals.calories).toBe(1800);
    expect(profile.weightGoal).toBe(70);
  });
});

describe('WeightLog Model', () => {
  const userId = 'test_user_6';

  test('creates weight log', async () => {
    const log = await WeightLog.create({
      userId,
      date: new Date('2024-01-15'),
      weight: 75.5,
      bodyFat: 18.5,
    });
    
    expect(log.weight).toBe(75.5);
    expect(log.bodyFat).toBe(18.5);
  });

  test('enforces unique userId + date', async () => {
    await WeightLog.create({ userId, date: new Date('2024-01-15'), weight: 75 });
    const dup = new WeightLog({ userId, date: new Date('2024-01-15'), weight: 76 });
    await expect(dup.save()).rejects.toThrow();
  });

  test('defaults source to text', async () => {
    const log = await WeightLog.create({ userId, date: new Date(), weight: 75 });
    expect(log.source).toBe('text');
  });
});

describe('DailyTotals Model', () => {
  const userId = 'test_user_7';

  test('creates daily totals with goals snapshot', async () => {
    const totals = await DailyTotals.create({
      userId,
      date: new Date('2024-01-15'),
      totals: { calories: 1500, protein: 100, carbs: 150, fat: 50 },
      goals: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
      mealsCount: 3,
      streak: 5,
      weight: 75,
    });
    
    expect(totals.totals.calories).toBe(1500);
    expect(totals.goals.calories).toBe(2000);
    expect(totals.streak).toBe(5);
  });

  test('enforces unique userId + date', async () => {
    await DailyTotals.create({ userId, date: new Date('2024-01-15'), totals: {}, goals: {} });
    const dup = new DailyTotals({ userId, date: new Date('2024-01-15'), totals: {}, goals: {} });
    await expect(dup.save()).rejects.toThrow();
  });

  test('defaults mealsCount and streak to 0', async () => {
    const totals = await DailyTotals.create({
      userId,
      date: new Date(),
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      goals: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
    });
    expect(totals.mealsCount).toBe(0);
    expect(totals.streak).toBe(0);
  });
});