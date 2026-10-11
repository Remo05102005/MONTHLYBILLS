import {
  differenceInCalendarDays,
  addDays,
  format,
  startOfDay,
  startOfWeek,
  isSameDay,
} from 'date-fns';

const round1 = (n) => Math.round(n * 10) / 10;

export const MOODS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😄', label: 'Great' },
];

export const NOTE_TAGS = ['Workout', 'Walk', 'Poor sleep', 'Stress', 'Travel', 'Sick', 'Cheat day', 'Period'];

export const MEASURE_FIELDS = [
  { key: 'waist', label: 'Waist' },
  { key: 'chest', label: 'Chest' },
  { key: 'hips', label: 'Hips' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'arm', label: 'Arm' },
  { key: 'neck', label: 'Neck' },
];

// Parse 'yyyy-MM-dd' as a local date (new Date('yyyy-MM-dd') is UTC midnight and shifts the day in some zones)
export const parseLocalDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

// Least-squares slope in kg/week over entries (ascending). Returns null if not enough spread.
export const weeklySlope = (entries) => {
  if (entries.length < 2) return null;
  const t0 = startOfDay(entries[0].date);
  const pts = entries.map((e) => ({ x: differenceInCalendarDays(startOfDay(e.date), t0), y: e.weight }));
  const span = pts[pts.length - 1].x - pts[0].x;
  if (span < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  pts.forEach((p) => {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  });
  if (den === 0) return null;
  return (num / den) * 7;
};

/**
 * Trailing moving average (default 7 days) for each entry, keyed by 'yyyy-MM-dd'.
 * Smooths daily water-weight noise so the real trend is visible.
 */
export const buildTrendMap = (entriesAsc, windowDays = 7) => {
  const map = {};
  entriesAsc.forEach((entry) => {
    const end = startOfDay(entry.date);
    const inWindow = entriesAsc.filter((e) => {
      const d = differenceInCalendarDays(end, startOfDay(e.date));
      return d >= 0 && d < windowDays;
    });
    const avg = inWindow.reduce((s, e) => s + e.weight, 0) / inWindow.length;
    map[format(end, 'yyyy-MM-dd')] = round1(avg);
  });
  return map;
};

/**
 * Build everything the journey card needs.
 * @param weights entries (any order) with { id, date: Date, weight: number }
 * @param opts { startWeight, startDate, targetWeight, goalDate }  (all optional)
 */
export const computeJourney = (weights, opts = {}) => {
  if (!weights || weights.length === 0) return null;
  const today = startOfDay(new Date());
  const asc = [...weights].sort((a, b) => a.date - b.date);
  const first = asc[0];
  const latest = asc[asc.length - 1];

  const startWeight = opts.startWeight || first.weight;
  const startDate = opts.startDate ? startOfDay(parseLocalDate(opts.startDate)) : startOfDay(first.date);
  const target = opts.targetWeight || null;
  const goalDate = opts.goalDate ? startOfDay(parseLocalDate(opts.goalDate)) : null;
  const current = latest.weight;

  // Only entries from the journey start count towards pace/progress
  const sinceStart = asc.filter((e) => startOfDay(e.date) >= startDate);
  const series = sinceStart.length ? sinceStart : asc;

  const direction = target == null ? null : target < startWeight ? 'loss' : target > startWeight ? 'gain' : 'maintain';
  const sign = direction === 'gain' ? -1 : 1; // positive "progress" = moving towards target

  const changeFromStart = round1(current - startWeight);
  const lostSoFar = round1((startWeight - current) * sign);
  const totalToGo = target != null ? Math.abs(startWeight - target) : null;
  const remaining = target != null ? round1(Math.max(0, (current - target) * sign)) : null;
  const progressPct =
    totalToGo && totalToGo > 0 ? Math.max(0, Math.min(100, ((startWeight - current) * sign / totalToGo) * 100)) : null;

  // Pace — last 28 days of data, falling back to everything since start
  const recentCut = addDays(today, -28);
  const recent = series.filter((e) => startOfDay(e.date) >= recentCut);
  const paceSeries = recent.length >= 3 ? recent : series;
  const weeklyRate = weeklySlope(paceSeries); // kg/week, negative = losing
  const overallWeeks = Math.max(1, differenceInCalendarDays(startOfDay(latest.date), startDate)) / 7;
  const overallRate = series.length > 1 ? (current - startWeight) / overallWeeks : null;

  // ETA at current pace
  let etaDate = null;
  let etaState = null; // 'reached' | 'wrong-way' | 'no-pace' | 'date'
  if (target != null) {
    if (remaining === 0) etaState = 'reached';
    else if (weeklyRate == null || Math.abs(weeklyRate) < 0.05) etaState = 'no-pace';
    else if ((weeklyRate < 0) !== (target < current)) etaState = 'wrong-way';
    else {
      const weeks = remaining / Math.abs(weeklyRate);
      if (weeks > 104) etaState = 'no-pace';
      else {
        etaDate = addDays(today, Math.ceil(weeks * 7));
        etaState = 'date';
      }
    }
  }

  // Pace required to hit goal date
  let requiredRate = null;
  let daysToGoalDate = null;
  if (goalDate && target != null && remaining > 0) {
    daysToGoalDate = differenceInCalendarDays(goalDate, today);
    if (daysToGoalDate > 0) requiredRate = round1(remaining / (daysToGoalDate / 7));
  }

  // Logging consistency
  const loggedDays = new Set(asc.map((e) => format(startOfDay(e.date), 'yyyy-MM-dd')));
  let streak = 0;
  let cursor = loggedDays.has(format(today, 'yyyy-MM-dd')) ? today : addDays(today, -1);
  while (loggedDays.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  let logged30 = 0;
  for (let i = 0; i < 30; i += 1) {
    if (loggedDays.has(format(addDays(today, -i), 'yyyy-MM-dd'))) logged30 += 1;
  }
  const loggedToday = isSameDay(startOfDay(latest.date), today);
  const daysSinceLast = differenceInCalendarDays(today, startOfDay(latest.date));

  // Weekly summaries (Mon–Sun), newest first
  const weekMap = new Map();
  asc.forEach((e) => {
    const key = format(startOfWeek(e.date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key).push(e);
  });
  const weekKeys = Array.from(weekMap.keys()).sort();
  const weekly = weekKeys.map((key) => {
    const list = weekMap.get(key);
    const avg = list.reduce((s, e) => s + e.weight, 0) / list.length;
    return { key, start: parseLocalDate(key), avg: round1(avg), count: list.length, change: null };
  });
  weekly.forEach((w, i) => {
    if (i > 0) w.change = round1(w.avg - weekly[i - 1].avg);
  });
  const weeklyRecent = weekly.slice(-8).reverse();

  // Milestones: every 1 kg for the first 5 kg, then every 2.5 kg … simplified to 2.5 kg steps (min 1 kg)
  const milestones = [];
  if (target != null && totalToGo > 0) {
    const step = totalToGo <= 6 ? 1 : totalToGo <= 20 ? 2.5 : 5;
    for (let k = step; k < totalToGo; k += step) {
      const level = startWeight - k * sign;
      const hit = series.find((e) => (e.weight - level) * sign <= 0);
      milestones.push({ kg: round1(k), level: round1(level), reachedOn: hit ? hit.date : null });
    }
    const hitGoal = series.find((e) => (e.weight - target) * sign <= 0);
    milestones.push({ kg: round1(totalToGo), level: round1(target), reachedOn: hitGoal ? hitGoal.date : null, isGoal: true });
  }

  // Insights
  const insights = [];
  if (daysSinceLast >= 3) {
    insights.push({ type: 'warning', text: `No weigh-in for ${daysSinceLast} days — log today to keep your trend accurate.` });
  }
  if (weeklyRate != null && direction === 'loss') {
    const pctPerWeek = (Math.abs(weeklyRate) / current) * 100;
    if (weeklyRate < 0 && pctPerWeek > 1) {
      insights.push({ type: 'warning', text: `Losing ${Math.abs(weeklyRate).toFixed(1)} kg/week is faster than the ~1% of body weight that is sustainable. Slow and steady is safer — don't overdo it.` });
    } else if (weeklyRate < -0.1) {
      insights.push({ type: 'success', text: `Great pace — down ${Math.abs(weeklyRate).toFixed(2)} kg/week on average.` });
    } else if (weeklyRate > 0.1) {
      insights.push({ type: 'warning', text: `Trending up ${weeklyRate.toFixed(2)} kg/week. Check your notes for what changed this week.` });
    } else if (paceSeries.length >= 5) {
      insights.push({ type: 'info', text: 'Weight is plateauing. Normal — stay consistent and add some activity.' });
    }
  }
  if (requiredRate != null && weeklyRate != null && direction === 'loss') {
    if (Math.abs(weeklyRate) >= requiredRate && weeklyRate < 0) {
      insights.push({ type: 'success', text: `On track for your goal date (needs ${requiredRate} kg/week).` });
    } else {
      insights.push({ type: 'info', text: `To reach your goal by ${format(goalDate, 'MMM d')} you need ${requiredRate} kg/week.` });
    }
  }
  if (streak >= 3) insights.push({ type: 'success', text: `${streak}-day logging streak 🔥` });

  return {
    startWeight, startDate, current, target, goalDate, direction,
    changeFromStart, lostSoFar, remaining, progressPct,
    weeklyRate: weeklyRate == null ? null : round1(weeklyRate * 100) / 100,
    overallRate, etaDate, etaState, requiredRate, daysToGoalDate,
    streak, bestStreak: longestStreak(asc), logged30, loggedToday, daysSinceLast,
    weekly: weeklyRecent, milestones, insights,
    lowest: Math.min(...asc.map((e) => e.weight)),
    highest: Math.max(...asc.map((e) => e.weight)),
    entries: asc.length,
    daysInJourney: differenceInCalendarDays(today, startDate) + 1,
  };
};

/** Month-by-month summary (newest first): first/last weight, change, average, logs. */
export const buildMonthly = (weights) => {
  if (!weights || weights.length === 0) return [];
  const asc = [...weights].sort((a, b) => a.date - b.date);
  const map = new Map();
  asc.forEach((e) => {
    const key = format(e.date, 'yyyy-MM');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  const keys = Array.from(map.keys()).sort();
  const rows = keys.map((key, i) => {
    const list = map.get(key);
    const first = list[0].weight;
    const last = list[list.length - 1].weight;
    const avg = list.reduce((s, e) => s + e.weight, 0) / list.length;
    // Change vs the previous month's last weigh-in, else vs this month's first
    const prevLast = i > 0 ? map.get(keys[i - 1]).slice(-1)[0].weight : first;
    return { key, label: format(parseLocalDate(`${key}-01`), 'MMM yyyy'), first, last, avg: round1(avg), change: round1(last - prevLast), count: list.length };
  });
  return rows.reverse();
};

/** Latest vs first value of every measurement field. Entries ascending by date. */
export const summarizeMeasurements = (measurements) => {
  if (!measurements || measurements.length === 0) return [];
  return MEASURE_FIELDS.map(({ key, label }) => {
    const pts = measurements.filter((m) => m[key] != null && m[key] !== '');
    if (pts.length === 0) return null;
    const first = Number(pts[0][key]);
    const latest = Number(pts[pts.length - 1][key]);
    return { key, label, first, latest, change: round1(latest - first), count: pts.length };
  }).filter(Boolean);
};

/** Mood average, tag counts and recent notes from weigh-ins (weights any order). */
export const summarizeNotes = (weights) => {
  const list = (weights || []).filter((w) => w.note || w.mood || (w.tags && w.tags.length));
  const moods = list.filter((w) => w.mood).map((w) => w.mood);
  const tagCounts = {};
  list.forEach((w) => (w.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  return {
    avgMood: moods.length ? round1(moods.reduce((s, m) => s + m, 0) / moods.length) : null,
    tagCounts: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]),
    notes: list.filter((w) => w.note).sort((a, b) => b.date - a.date),
  };
};

/** Finish date if the user averages `kgPerWeek` from now. */
export const projectFinish = (journey, kgPerWeek) => {
  if (!journey || journey.target == null || !kgPerWeek || kgPerWeek <= 0) return null;
  if (!journey.remaining) return { weeks: 0, date: startOfDay(new Date()) };
  const weeks = journey.remaining / kgPerWeek;
  return { weeks, date: addDays(startOfDay(new Date()), Math.ceil(weeks * 7)) };
};

/** Earned/locked achievements derived from existing data (nothing is stored). */
export const buildBadges = (journey, measurements = []) => {
  if (!journey) return [];
  const lost = Math.max(0, journey.lostSoFar || 0);
  const best = journey.bestStreak || journey.streak;
  const pct = journey.progressPct || 0;
  return [
    { id: 'first', icon: '⚖️', title: 'First weigh-in', hint: 'Log a weight', earned: journey.entries >= 1 },
    { id: 'streak7', icon: '🔥', title: '7-day streak', hint: 'Log 7 days in a row', earned: best >= 7 },
    { id: 'streak30', icon: '🏅', title: '30-day streak', hint: 'Log 30 days in a row', earned: best >= 30 },
    { id: 'streak100', icon: '👑', title: '100-day streak', hint: 'Log 100 days in a row', earned: best >= 100 },
    { id: 'lost1', icon: '🌱', title: 'First kilo', hint: 'Lose 1 kg', earned: lost >= 1 },
    { id: 'lost5', icon: '💪', title: '5 kg down', hint: 'Lose 5 kg', earned: lost >= 5 },
    { id: 'lost10', icon: '🚀', title: '10 kg down', hint: 'Lose 10 kg', earned: lost >= 10 },
    { id: 'half', icon: '🎯', title: 'Halfway', hint: 'Reach 50% of your goal', earned: pct >= 50 },
    { id: 'goal', icon: '🏆', title: 'Goal reached', hint: 'Hit your goal weight', earned: journey.etaState === 'reached' },
    { id: 'measure', icon: '📏', title: 'Tape measure', hint: 'Log body measurements', earned: measurements.length > 0 },
  ];
};

/** Longest consecutive-day logging run in the data. */
export const longestStreak = (weights) => {
  const days = Array.from(new Set((weights || []).map((e) => format(startOfDay(e.date), 'yyyy-MM-dd')))).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  days.forEach((d) => {
    const cur = parseLocalDate(d);
    run = prev && differenceInCalendarDays(cur, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  });
  return best;
};
