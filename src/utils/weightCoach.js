import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns';
import { weeklySlope } from './weightAnalytics';

const round1 = (n) => Math.round(n * 10) / 10;

export const DAILY_GOALS = { water: 8, steps: 8000, sleep: 7.5, workout: 30 };

const latestOf = (measurements, key) => {
  for (let i = (measurements || []).length - 1; i >= 0; i -= 1) {
    const v = Number(measurements[i][key]);
    if (v > 0) return v;
  }
  return null;
};

/** US-Navy body-fat estimate + waist-to-height ratio from the latest tape measurements. */
export const bodyComposition = ({ measurements, height, gender, weight }) => {
  const waist = latestOf(measurements, 'waist');
  const neck = latestOf(measurements, 'neck');
  const hips = latestOf(measurements, 'hips');
  if (!height) return null;
  const out = { whtr: null, bodyFat: null, leanMass: null, fatMass: null };
  if (waist) out.whtr = Math.round((waist / height) * 100) / 100;
  if (waist && neck) {
    let bf = null;
    if (gender === 'female' && hips && waist + hips - neck > 0) {
      bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.221 * Math.log10(height)) - 450;
    } else if (gender !== 'female' && waist - neck > 0) {
      bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
    }
    if (bf != null && bf > 2 && bf < 60) {
      out.bodyFat = round1(bf);
      if (weight) {
        out.fatMass = round1((weight * bf) / 100);
        out.leanMass = round1(weight - out.fatMass);
      }
    }
  }
  return out.whtr == null && out.bodyFat == null ? null : out;
};

/** Non-null when the last 14 days (>=4 weigh-ins) show no real movement. */
export const detectPlateau = (weights) => {
  const today = startOfDay(new Date());
  const recent = (weights || [])
    .filter((e) => differenceInCalendarDays(today, startOfDay(e.date)) <= 14)
    .sort((a, b) => a.date - b.date);
  if (recent.length < 4) return null;
  const slope = weeklySlope(recent);
  const ws = recent.map((e) => e.weight);
  const range = Math.max(...ws) - Math.min(...ws);
  if (slope != null && Math.abs(slope) < 0.1 && range < 1) return { range: round1(range) };
  return null;
};

/** Averages over the last `days` days of the daily log object (keyed 'yyyy-MM-dd'). */
export const summarizeDaily = (daily, days = 7) => {
  const today = startOfDay(new Date());
  const acc = { water: [], steps: [], sleep: [], workout: [] };
  let activeDays = 0;
  for (let i = 0; i < days; i += 1) {
    const rec = daily?.[format(addDays(today, -i), 'yyyy-MM-dd')];
    if (rec) {
      Object.keys(acc).forEach((k) => {
        if (rec[k] != null && rec[k] !== '') acc[k].push(Number(rec[k]));
      });
      if (Number(rec.workout) > 0) activeDays += 1;
    }
  }
  const avg = (a) => (a.length ? round1(a.reduce((s, v) => s + v, 0) / a.length) : null);
  const steps = avg(acc.steps);
  return {
    water: avg(acc.water),
    steps: steps == null ? null : Math.round(steps),
    sleep: avg(acc.sleep),
    workout: avg(acc.workout),
    activeDays,
    workoutTotal: acc.workout.reduce((s, v) => s + v, 0),
    loggedDays: Math.max(acc.water.length, acc.steps.length, acc.sleep.length, acc.workout.length),
  };
};

/** This Mon-Sun week vs last week. */
export const weeklyCheckin = (weights, daily) => {
  const today = startOfDay(new Date());
  const thisStart = startOfWeek(today, { weekStartsOn: 1 });
  const lastStart = addDays(thisStart, -7);
  const between = (from, to) => (weights || []).filter((e) => {
    const d = startOfDay(e.date);
    return d >= from && d < to;
  });
  const avg = (a) => (a.length ? a.reduce((s, e) => s + e.weight, 0) / a.length : null);
  const thisW = between(thisStart, addDays(thisStart, 7));
  const a = avg(thisW);
  const b = avg(between(lastStart, thisStart));
  const habits = (from) => {
    let workout = 0;
    let steps = 0;
    let n = 0;
    for (let i = 0; i < 7; i += 1) {
      const r = daily?.[format(addDays(from, i), 'yyyy-MM-dd')];
      if (r) {
        workout += Number(r.workout) || 0;
        steps += Number(r.steps) || 0;
        n += 1;
      }
    }
    return { workout, avgSteps: n ? Math.round(steps / n) : null };
  };
  const now = habits(thisStart);
  return {
    weekStart: thisStart,
    avg: a == null ? null : round1(a),
    change: a != null && b != null ? round1(a - b) : null,
    logs: thisW.length,
    workout: now.workout,
    avgSteps: now.avgSteps,
    lastWorkout: habits(lastStart).workout,
  };
};

/** Trainer-style advice from everything we know. Returns [{ type, text }]. */
export const coachTips = ({ journey, plateau, daily7, bodyComp, checkin }) => {
  const tips = [];
  if (!journey) {
    tips.push({ type: 'info', text: 'Weigh in at the same time every morning (after the toilet, before drinking) so the trend is clean.' });
    return tips;
  }
  if (plateau) {
    tips.push({ type: 'warning', text: `Plateau: weight has moved only ${plateau.range} kg in 2 weeks. Try 2,000 more steps a day, one extra strength session, or 30 more minutes of sleep before changing anything drastic.` });
  }
  if (daily7.sleep != null && daily7.sleep < 6.5) {
    tips.push({ type: 'warning', text: `You average ${daily7.sleep} h of sleep. Under 7 h raises hunger hormones and slows fat loss — protect sleep first.` });
  }
  if (daily7.water != null && daily7.water < DAILY_GOALS.water - 2) {
    tips.push({ type: 'info', text: `Water averages ${daily7.water} glasses. Aim for ${DAILY_GOALS.water}.` });
  }
  if (daily7.steps != null && daily7.steps < 6000) {
    tips.push({ type: 'info', text: `Steps average ${daily7.steps}. Add 1,000 a week toward ${DAILY_GOALS.steps}; daily movement burns more than most workouts.` });
  }
  if (daily7.loggedDays > 0 && daily7.activeDays < 3) {
    tips.push({ type: 'info', text: `Only ${daily7.activeDays} active day(s) this week. Aim for 3-4: 2 strength sessions (keeps muscle while you lose fat) plus walking or cardio.` });
  }
  if (checkin && checkin.change != null && checkin.logs >= 3 && checkin.change > 0.5) {
    tips.push({ type: 'warning', text: `This week's average is up ${checkin.change} kg on last week. One high week is usually water — watch the next 3 days before reacting.` });
  }
  if (bodyComp && bodyComp.whtr != null) {
    tips.push({
      type: bodyComp.whtr < 0.5 ? 'success' : 'info',
      text: `Waist-to-height ratio ${bodyComp.whtr} — ${bodyComp.whtr < 0.5 ? 'in the healthy zone (below 0.5).' : 'keep bringing it toward 0.5; your waist is the best fat-loss signal.'}`,
    });
  }
  if (journey.weeklyRate != null && journey.weeklyRate < -0.1 && journey.weeklyRate > -1) {
    tips.push({ type: 'success', text: 'Pace is in the sustainable 0.25-1 kg/week range. Keep strength training to preserve muscle.' });
  }
  if (tips.length === 0) tips.push({ type: 'success', text: 'Everything looks on track. Keep logging daily — consistency beats intensity.' });
  return tips;
};

/** CSV of weigh-ins joined with daily habits. */
export const buildCsv = (weights, daily = {}) => {
  // Quote, and neutralise leading = + - @ so spreadsheets never evaluate a note as a formula
  const esc = (v) => {
    let t = String(v ?? '');
    if (/^[=+\-@]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const rows = ['date,weight_kg,mood,tags,note,water,steps,sleep_h,workout_min'];
  [...weights].sort((a, b) => a.date - b.date).forEach((w) => {
    const key = format(w.date, 'yyyy-MM-dd');
    const d = daily[key] || {};
    rows.push([key, w.weight, w.mood || '', esc((w.tags || []).join('; ')), esc(w.note), d.water ?? '', d.steps ?? '', d.sleep ?? '', d.workout ?? ''].join(','));
  });
  return rows.join('\n');
};
