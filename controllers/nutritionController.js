const NutritionLog = require('../models/nutritionLogModel');
const User = require('../models/userModel');

// Helper: 'YYYY-MM-DD' string for a Date
const toDateStr = (date) => date.toISOString().split('T')[0];

// Helper: get start of week (Monday) for a given date
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: calculate streak (consecutive days within goal, going backwards from today)
const calcStreak = (logs, todayStr) => {
  const logMap = {};
  logs.forEach(l => { logMap[l.date] = l.withinGoal; });

  let streak = 0;
  const cursor = new Date(todayStr);

  while (true) {
    const key = toDateStr(cursor);
    if (logMap[key]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

// GET /api/nutrition/summary?date=YYYY-MM-DD
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const dateStr = req.query.date || toDateStr(new Date());

    const user = await User.findById(userId).select('calorieGoal macroGoals').lean();
    const calorieGoal = user.calorieGoal || 2000;
    const macroGoals = user.macroGoals || {
      protein: 120, carbs: 280, fat: 233, fiber: 38, sugar: 50
    };

    // Week range (Mon–Sun) containing the requested date
    const weekStart = getWeekStart(new Date(dateStr));
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return toDateStr(d);
    });

    // Fetch all logs for the week + past 90 days (for streak)
    const streakStart = new Date(dateStr);
    streakStart.setDate(streakStart.getDate() - 90);

    const logs = await NutritionLog.find({
      user: userId,
      date: { $gte: toDateStr(streakStart), $lte: dateStr }
    }).lean();

    // Today's log
    const todayLog = logs.find(l => l.date === dateStr) || {
      consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
      withinGoal: false
    };

    // Weekly calendar data
    const weeklyData = weekDays.map(day => {
      const log = logs.find(l => l.date === day);
      return {
        date: day,
        calories: log?.consumed?.calories || 0,
        withinGoal: log?.withinGoal || false
      };
    });

    // How many days this week stayed within goal
    const withinGoalThisWeek = weeklyData.filter(d => d.withinGoal).length;

    // Streak
    const streak = calcStreak(logs, dateStr);

    res.json({
      success: true,
      data: {
        streak,
        date: dateStr,
        calorieGoal,
        // Today's totals
        consumed: {
          calories: todayLog.consumed.calories,
          protein:  todayLog.consumed.protein,
          carbs:    todayLog.consumed.carbs,
          fat:      todayLog.consumed.fat,
          fiber:    todayLog.consumed.fiber,
          sugar:    todayLog.consumed.sugar
        },
        // Goals for macros
        goals: macroGoals,
        // Weekly stat
        withinGoalThisWeek,
        withinGoalMessage: `Stayed within limit ${withinGoalThisWeek} times this week`,
        // Weekly calendar
        weeklyCalendar: weeklyData
      }
    });
  } catch (err) {
    console.error('Nutrition summary error:', err);
    res.status(500).json({ message: 'Failed to fetch nutrition summary' });
  }
};

// GET /api/nutrition/goals — get user's calorie + macro goals
exports.getGoals = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('calorieGoal macroGoals').lean();
    res.json({
      success: true,
      data: {
        calorieGoal: user.calorieGoal || 2000,
        macroGoals: user.macroGoals || {
          protein: 120, carbs: 280, fat: 233, fiber: 38, sugar: 50
        }
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch goals' });
  }
};

// PUT /api/nutrition/goals — update calorie + macro goals
exports.updateGoals = async (req, res) => {
  try {
    const { calorieGoal, macroGoals } = req.body;
    const update = {};
    if (calorieGoal !== undefined) update.calorieGoal = calorieGoal;
    if (macroGoals) update.macroGoals = macroGoals;

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
      .select('calorieGoal macroGoals');

    res.json({ success: true, message: 'Goals updated', data: user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update goals' });
  }
};
