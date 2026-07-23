# Nutrition Tracking Revamp Plan

## Overview
Completely revamp the nutrition tracking system to be a natural-language-first, conversational experience with:
- Dual-model AI (NVIDIA Nemotron-3-Ultra for text, Nemotron-3-Nano-Omni for vision)
- Natural language food logging
- Photo analysis via vision model
- Voice message support
- Goals, weight tracking, streak, coaching
- Weekly reports
- Modular architecture for future barcode/exercise extensions

---

## Database Schema Changes (MongoDB/Mongoose)

### New Models

#### `UserProfile.js`
```javascript
{
  userId: { type: String, unique: true, index: true },
  goals: {
    calories: { type: Number, default: 2000 },
    protein: { type: Number, default: 150 },
    carbs: { type: Number, default: 200 },
    fat: { type: Number, default: 70 },
  },
  weightGoal: { type: Number }, // target weight in kg
  units: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  timezone: { type: String, default: 'Africa/Cairo' },
  streak: { type: Number, default: 0 },
  lastLoggedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

#### `MealEntry.js` (replaces NutritionLog)
```javascript
{
  userId: { type: String, index: true },
  date: { type: Date, index: true },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], default: 'snack' },
  foods: [{
    name: String,
    amount: Number, // grams or ml
    unit: { type: String, enum: ['g', 'ml', 'oz', 'cup', 'piece', 'slice', 'tbsp', 'tsp'], default: 'g' },
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    isEstimate: { type: Boolean, default: false },
    source: { type: String, enum: ['text', 'photo', 'voice', 'barcode'], default: 'text' },
  }],
  totals: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
  },
  notes: String,
  imageUrl: String,
  voiceTranscript: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}
Indexes: { userId: 1, date: -1 }, { userId: 1, mealType: 1, date: -1 }
```

#### `WeightLog.js`
```javascript
{
  userId: { type: String, index: true },
  date: { type: Date, index: true },
  weight: { type: Number }, // kg
  bodyFat: { type: Number }, // percentage, optional
  notes: String,
  source: { type: String, enum: ['text', 'scale'], default: 'text' },
  createdAt: { type: Date, default: Date.now },
}
Index: { userId: 1, date: -1 }, unique: { userId: 1, date: 1 }
```

#### `DailyTotals.js` (materialized view for fast queries)
```javascript
{
  userId: { type: String, index: true },
  date: { type: Date, index: true },
  totals: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
  },
  goals: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
  },
  mealsCount: Number,
  streak: Number,
  weight: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}
Index: { userId: 1, date: -1 }, unique: { userId: 1, date: 1 }
```

---

## Module Structure

```
src/
├── nutrition/
│   ├── index.js                 # Main exports
│   ├── models/
│   │   ├── UserProfile.js
│   │   ├── MealEntry.js
│   │   ├── WeightLog.js
│   │   └── DailyTotals.js
│   ├── services/
│   │   ├── NutritionParser.js      # Natural language → structured food items
│   │   ├── MacroCalculator.js      # USDA/standard database lookups + estimation
│   │   ├── DailyAggregator.js      # Recompute daily totals, update streak
│   │   ├── CoachEngine.js          # Smart coaching messages
│   │   ├── ReportGenerator.js      # Daily/weekly reports (text + PDF)
│   │   └── VisionAnalyzer.js       # Photo → food items (Nano Omni)
│   ├── tools/
│   │   ├── LogMealTool.js
│   │   ├── GetDailySummaryTool.js
│   │   ├── GetWeeklyReportTool.js
│   │   ├── SetGoalsTool.js
│   │   ├── LogWeightTool.js
│   │   └── GetWeightHistoryTool.js
│   ├── commands/
│   │   ├── nutrition.js            # /nutrition, /goals, /weight, /streak
│   │   └── report.js               # /report daily|weekly
│   └── middleware/
│       └── nutritionDetector.js    # Auto-detect food messages
└── bot/index.js                    # Integrate nutritionDetector
```

---

## Core Services

### 1. NutritionParser (`NutritionParser.js`)
- Input: free text ("2 boiled eggs, 150g chicken breast")
- Output: `[{ name, amount, unit, confidence }]`
- Uses NVIDIA Ultra with structured output (function calling) to parse
- Handles: quantities, units, meal types, implicit amounts
- Caches common food patterns

### 2. MacroCalculator (`MacroCalculator.js`)
- Input: parsed food items
- Output: calories, protein, carbs, fat per item + totals
- Data sources (in priority):
  1. Local USDA SR Legacy cache (JSON, ~8k foods)
  2. OpenFoodFacts API (fallback)
  3. LLM estimation (NVIDIA Ultra) with `isEstimate: true`
- Normalizes to per-100g then scales by amount

### 3. DailyAggregator (`DailyAggregator.js`)
- Recomputes daily totals from MealEntry
- Updates DailyTotals materialized view
- Calculates streak: consecutive days with ≥1 meal logged
- Handles timezone (user's `timezone` from profile)

### 4. CoachEngine (`CoachEngine.js`)
- Generates contextual coaching messages
- Triggers:
  - Protein deficit > 20g → suggest high-protein foods
  - Calories remaining < 200 → "light snack" suggestions
  - Streak milestones (3, 7, 14, 30 days)
  - Weight trend (7-day average vs goal)
  - Missed meal patterns
- Tone: encouraging, non-judgmental, actionable

### 5. ReportGenerator (`ReportGenerator.js`)
- Daily summary: meals, totals vs goals, remaining, streak
- Weekly report: averages, trends, best/worst days, streak, weight change
- Output: formatted text + optional PDF (via pdfkit)

### 6. VisionAnalyzer (`VisionAnalyzer.js`)
- Input: image URL (Telegram file URL)
- Model: NVIDIA Nemotron-3-Nano-Omni (vision)
- Prompt: structured extraction → food items, portions, macros
- Output: same format as NutritionParser + `source: 'photo'`
- Confidence scoring per item

---

## Tools (Function Calling)

### `LogMealTool`
```javascript
{
  userId: string,
  text?: string,           // natural language food description
  imageUrl?: string,       // Telegram photo URL
  voiceTranscript?: string,
  mealType?: 'breakfast'|'lunch'|'dinner'|'snack',
  date?: string,           // ISO date, defaults to today in user TZ
}
→ { mealEntry, dailyTotals, coachingMessage }
```

### `GetDailySummaryTool`
```javascript
{ userId: string, date?: string }
→ { date, meals[], totals, goals, remaining, streak, coachingMessage }
```

### `GetWeeklyReportTool`
```javascript
{ userId: string, weekStart?: string }
→ { weekRange, dailyBreakdown[], averages, trends, weightChange, streak, pdfBuffer? }
```

### `SetGoalsTool`
```javascript
{ userId: string, calories?: number, protein?: number, carbs?: number, fat?: number, weightGoal?: number }
→ { goals, updatedProfile }
```

### `LogWeightTool`
```javascript
{ userId: string, weight: number, date?: string, bodyFat?: number }
→ { weightLog, trend7d, trend30d, coachingMessage }
```

### `GetWeightHistoryTool`
```javascript
{ userId: string, days?: number }
→ { logs[], chartData[], trend }
```

---

## Bot Integration

### Message Detection (`nutritionDetector.js`)
- Runs before main AI handler
- Detects food logging intent via:
  - Keywords: "ate", "had", "eating", "lunch", "dinner", "breakfast", "snack", "calories", "protein", food emojis
  - Pattern: quantity + food noun
  - Photo messages (already handled)
  - Voice messages (new)
- If detected → route to `LogMealTool` directly (bypass general AI)
- Falls back to general AI if confidence < 0.7

### Voice Message Handling
- `bot.on('voice')` → download → transcribe (OpenAI Whisper via OpenRouter or local) → `LogMealTool`

### Commands
| Command | Description |
|---------|-------------|
| `/nutrition` | Today's summary |
| `/goals [calories] [protein] [carbs] [fat]` | View/set goals |
| `/weight [kg]` | Log/view weight |
| `/streak` | Current streak |
| `/report daily|weekly` | Generate report |
| `/resetnutrition` | Clear today's meals (admin) |

---

## Dual-Model Configuration

### `.env` additions
```env
# Primary (text, reasoning, tools)
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3-ultra

# Vision (photo analysis)
NVIDIA_VISION_API_KEY=...          # can be same
NVIDIA_VISION_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_VISION_MODEL=nvidia/nemotron-3-nano-omni

# Fallback (OpenRouter)
OPENROUTER_API_KEY=...
FALLBACK_MODEL=openai/gpt-4o-mini
VISION_FALLBACK_MODEL=openai/gpt-4o-mini
```

### Service Layer (`services/nvidia.js`)
- `generateWithTools()` — uses Ultra, 15 tool iterations
- `generateVision()` — uses Nano Omni, single call, structured output
- `generateFallback()` — OpenRouter for rate limits/errors

---

## Implementation Phases

### Phase 1: Database & Core Models (Day 1)
- [ ] Create 4 new Mongoose models
- [ ] Add indexes, validation, pre-save hooks
- [ ] Migration script for existing NutritionLog → MealEntry

### Phase 2: Parser & Calculator (Day 2)
- [ ] NutritionParser with NVIDIA Ultra function calling
- [ ] MacroCalculator with local USDA cache + LLM fallback
- [ ] Unit tests for common foods

### Phase 3: Aggregator & DailyTotals (Day 2-3)
- [ ] DailyAggregator service
- [ ] Streak calculation with timezone support
- [ ] Materialized view update on every meal log

### Phase 4: Tools & Function Calling (Day 3)
- [ ] Implement 6 tools
- [ ] Register in tool registry
- [ ] Test tool calling flow end-to-end

### Phase 5: Vision & Voice (Day 4)
- [ ] VisionAnalyzer with Nano Omni
- [ ] Photo message handler integration
- [ ] Voice message handler + transcription

### Phase 6: Coaching & Reports (Day 4-5)
- [ ] CoachEngine with rule-based + LLM hybrid
- [ ] ReportGenerator (text + PDF)
- [ ] Weekly trend analysis

### Phase 7: Bot Integration (Day 5)
- [ ] nutritionDetector middleware
- [ ] Command handlers
- [ ] Help text updates

### Phase 8: Testing & Polish (Day 6)
- [ ] E2E test scenarios
- [ ] Edge cases (missing units, ambiguous foods, multi-meal messages)
- [ ] Performance: macro calc < 500ms, vision < 3s
- [ ] Documentation

---

## USDA Data Setup

Download USDA SR Legacy (CSV) → convert to JSON → store in `src/nutrition/data/usda-cache.json`:
```json
{
  "chicken breast": { "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "per": 100, "unit": "g" },
  "egg": { "calories": 155, "protein": 13, "carbs": 1.1, "fat": 11, "per": 100, "unit": "g" },
  ...
}
```
~8,000 items, ~2MB JSON. Load at startup into Map for O(1) lookup.

---

## Example Conversation Flows

### Text Logging
```
User: "2 boiled eggs and toast for breakfast"
Dash: ✅ Logged breakfast.
• 2 eggs (100g): 155 kcal, 13g protein, 1g carbs, 11g fat
• Toast (30g): 80 kcal, 3g protein, 15g carbs, 1g fat
Total: 235 kcal | 16g P | 16g C | 12g F

Today: 235 / 2000 kcal | 16 / 150g protein
```

### Photo Logging
```
User: [sends photo of plate]
Dash: 📸 Analyzing...
✅ Logged lunch (estimated).
• Grilled salmon ~150g: 280 kcal, 39g P, 0g C, 12g F
• Rice ~200g: 260 kcal, 5g P, 56g C, 1g F
• Broccoli ~100g: 35 kcal, 3g P, 7g C, 0g F
Total: 575 kcal | 47g P | 63g C | 13g F
⚠️ Portions estimated from photo — adjust if needed.

Today: 1,320 / 2,000 kcal | 112 / 150g protein
```

### Coaching
```
User: "summary"
Dash: 📊 Today (Mon, Jan 15)
Meals: 3 | Streak: 7 days 🔥

🔥 1,680 / 2,000 kcal (320 left)
🥩 118 / 150g protein (32g short)
🍞 185g carbs
🥑 58g fat

💡 You're 32g short on protein. A can of tuna (25g), 200g Greek yogurt (20g), or 100g chicken (31g) would close the gap.
```

### Weekly Report
```
User: "/report weekly"
Dash: 📈 Weekly Report (Jan 8–14)
Avg: 1,850 kcal | 132g P | 190g C | 62g F
Protein goal hit: 4/7 days
Best day: Thu (158g protein)
Weight: 78.2 → 77.6 kg (-0.6 kg)
Streak: 7 days 🔥
[PDF attached]
```

---

## Future Extensibility

| Feature | Integration Point |
|---------|-------------------|
| Barcode scanning | New tool `ScanBarcodeTool`, MacroCalculator lookup by UPC |
| Exercise logging | New model `ExerciseLog`, DailyTotals adds `caloriesBurned` |
| Recipe builder | MealEntry `foods` → save as recipe, reuse |
| Meal planning | CoachEngine suggests meal plans from goals |
| Water tracking | New field in DailyTotals, simple `/water` command |
| Supplements | MealEntry `foods` with `category: 'supplement'` |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM hallucination on macros | `isEstimate` flag, local USDA cache priority, user correction flow |
| Vision model errors | Confidence scores, "adjust if needed" prompt, manual override |
| Rate limits on NVIDIA | Exponential backoff, OpenRouter fallback, local cache |
| Timezone issues | Store all dates UTC, compute user-day via profile.timezone |
| Data migration | One-time script, preserve old NutritionLog for rollback |

---

## Success Metrics

- Meal logging < 3 messages (ideally 1)
- Macro accuracy: ±10% vs labeled values for common foods
- Vision estimation: ±20% calories for mixed meals
- Daily summary response < 1s
- Weekly report generation < 3s
- Zero data loss on migration