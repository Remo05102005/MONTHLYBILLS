import React, { useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip, Typography, useTheme, useMediaQuery } from '@mui/material';
import {
  Bar, BarChart, Cell, ComposedChart, CartesianGrid, Line, LineChart, PolarAngleAxis,
  RadialBar, RadialBarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area,
} from 'recharts';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import {
  MEASURE_FIELDS, buildTrendMap, parseLocalDate,
} from '../utils/weightAnalytics';
import { DAILY_GOALS } from '../utils/weightCoach';

// Validated categorical slots (blue, orange) + status pair (green good / red off-track)
const useColors = () => {
  const dark = useTheme().palette.mode === 'dark';
  return {
    weight: dark ? '#3987e5' : '#2a78d6',
    trend: dark ? '#d95926' : '#eb6834',
    good: '#008300',
    bad: dark ? '#e66767' : '#e34948',
    grid: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#c3c2b7' : '#52514e',
  };
};

const Panel = ({ title, headline, children, footer }) => (
  <Card sx={{ mb: 3, borderRadius: 2 }}>
    <CardContent>
      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
      {headline && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{headline}</Typography>
      )}
      {children}
      {footer}
    </CardContent>
  </Card>
);

const tooltipStyle = (c) => ({
  contentStyle: { borderRadius: 8, border: `1px solid ${c.grid}`, fontSize: 12 },
  labelStyle: { fontWeight: 600 },
});

/** Big ring + the three numbers that matter. */
export const ProgressHero = ({ journey }) => {
  const c = useColors();
  if (!journey || journey.target == null) return null;
  const pct = Math.round(journey.progressPct || 0);
  const isLoss = journey.direction !== 'gain';
  const eta = journey.etaState === 'date' ? format(journey.etaDate, 'd MMM yyyy')
    : journey.etaState === 'reached' ? 'Reached 🎉' : '--';
  const reached = journey.remaining === 0;

  return (
    <Panel
      title="🎯 Your progress"
      headline={reached ? 'Goal reached — you did it!' : `${pct}% of the way there. Keep going.`}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Box sx={{ position: 'relative', width: 170, height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="78%" outerRadius="100%" data={[{ v: pct }]}
              startAngle={90} endAngle={-270} barSize={16}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="v" cornerRadius={8} fill={c.good} background={{ fill: c.grid }} isAnimationActive={false} />
            </RadialBarChart>
          </ResponsiveContainer>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', lineHeight: 1 }}>{pct}%</Typography>
            <Typography variant="caption" color="text.secondary">complete</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 2.5, textAlign: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: c.good }}>
              {Math.max(0, journey.lostSoFar).toFixed(1)} kg
            </Typography>
            <Typography variant="caption" color="text.secondary">{isLoss ? 'lost' : 'gained'}</Typography>
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{(journey.remaining ?? 0).toFixed(1)} kg</Typography>
            <Typography variant="caption" color="text.secondary">to go</Typography>
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{eta}</Typography>
            <Typography variant="caption" color="text.secondary">finish</Typography>
          </Box>
        </Box>
      </Box>
    </Panel>
  );
};

/** Actual weigh-ins vs the straight-line plan to the goal, with the 7-day trend. */
export const GoalPathChart = ({ weights, journey }) => {
  const c = useColors();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));

  const { data, planLabel, aheadBy, today } = useMemo(() => {
    if (!journey || weights.length === 0) return { data: [] };
    const asc = [...weights].sort((a, b) => a.date - b.date);
    const todayD = startOfDay(new Date());
    const start = startOfDay(journey.startDate);
    const planEnd = journey.goalDate || journey.etaDate || null;
    const end = planEnd && planEnd > todayD ? planEnd : addDays(todayD, 7);
    const span = Math.max(1, differenceInCalendarDays(end, start));
    const step = Math.max(1, Math.ceil(span / 60));
    const trendMap = buildTrendMap(asc);
    const byDay = new Map(asc.map((e) => [format(startOfDay(e.date), 'yyyy-MM-dd'), e.weight]));

    const keys = new Set(byDay.keys());
    for (let i = 0; i <= span; i += step) keys.add(format(addDays(start, i), 'yyyy-MM-dd'));
    keys.add(format(planEnd || end, 'yyyy-MM-dd'));
    keys.add(format(todayD, 'yyyy-MM-dd'));

    const planAt = (d) => {
      if (!planEnd || journey.target == null) return null;
      const total = differenceInCalendarDays(planEnd, start);
      if (total <= 0) return null;
      const t = differenceInCalendarDays(d, start);
      if (t < 0 || t > total) return null;
      return Math.round((journey.startWeight + ((journey.target - journey.startWeight) * t) / total) * 10) / 10;
    };

    const rows = Array.from(keys).sort().filter((k) => parseLocalDate(k) >= start).map((k) => {
      const d = parseLocalDate(k);
      return {
        key: k,
        label: format(d, 'd MMM'),
        weight: byDay.has(k) ? byDay.get(k) : null,
        trend: trendMap[k] ?? null,
        plan: planAt(d),
      };
    });
    const planToday = planAt(todayD);
    return {
      data: rows,
      planLabel: journey.goalDate ? 'Plan to goal date' : 'Projected at current pace',
      aheadBy: planToday != null && journey.direction === 'loss' ? Math.round((planToday - journey.current) * 10) / 10 : null,
      today: format(todayD, 'yyyy-MM-dd'),
    };
  }, [weights, journey]);

  if (data.length < 2) return null;
  const todayLabel = data.find((r) => r.key === today)?.label;
  const headline = aheadBy == null ? 'Your weigh-ins against the 7-day trend'
    : aheadBy > 0.05 ? `You are ${aheadBy} kg ahead of plan 🔥`
      : aheadBy < -0.05 ? `You are ${Math.abs(aheadBy)} kg behind plan — a good week closes it`
        : 'Right on plan';

  return (
    <Panel
      title="📉 Path to goal"
      headline={headline}
      footer={(
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mt: 1 }}>
          <Typography variant="caption" color="text.secondary"><span style={{ color: c.weight }}>●</span> Weigh-in</Typography>
          <Typography variant="caption" color="text.secondary"><span style={{ color: c.trend }}>━</span> 7-day trend</Typography>
          <Typography variant="caption" color="text.secondary"><span style={{ color: c.good }}>┅</span> {planLabel}</Typography>
        </Box>
      )}
    >
      <Box sx={{ height: isMobile ? 240 : 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.weight} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.weight} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis
              tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={36}
              domain={([min, max]) => [Math.floor(Math.min(min, journey.target ?? min) - 1), Math.ceil(max + 1)]}
            />
            <Tooltip {...tooltipStyle(c)} formatter={(v, n) => [`${v} kg`, n]} />
            {journey.target != null && (
              <ReferenceLine y={journey.target} stroke={c.good} strokeWidth={1.5}
                label={{ value: `Goal ${journey.target}`, fill: c.good, fontSize: 11, position: 'insideBottomRight' }} />
            )}
            {todayLabel && <ReferenceLine x={todayLabel} stroke={c.text} strokeDasharray="2 3" label={{ value: 'Today', fill: c.text, fontSize: 10, position: 'top' }} />}
            <Area type="monotone" dataKey="weight" name="Weigh-in" stroke="none" fill="url(#wtFill)" connectNulls isAnimationActive={false} />
            <Line type="linear" dataKey="plan" name={planLabel} stroke={c.good} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="trend" name="7-day trend" stroke={c.trend} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="weight" name="Weigh-in" stroke={c.weight} strokeWidth={0} dot={{ r: 3.5, fill: c.weight, stroke: 'var(--mui-palette-background-paper, #fff)', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Panel>
  );
};

/** One bar per week: change in the weekly average. Green = towards goal. */
export const WeeklyChangeChart = ({ journey }) => {
  const c = useColors();
  const rows = useMemo(() => {
    if (!journey) return [];
    return [...journey.weekly].reverse()
      .filter((w) => w.change != null)
      .map((w) => ({ label: format(w.start, 'd MMM'), change: w.change }));
  }, [journey]);
  if (rows.length < 2) return null;
  const isLoss = journey.direction !== 'gain';
  const good = (v) => (isLoss ? v < 0 : v > 0);
  const wins = rows.filter((r) => good(r.change)).length;
  const total = rows.reduce((s, r) => s + r.change, 0);

  return (
    <Panel
      title="📊 Week by week"
      headline={`${wins} of the last ${rows.length} weeks moved the right way (${total > 0 ? '+' : ''}${total.toFixed(1)} kg overall)`}
    >
      <Box sx={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip {...tooltipStyle(c)} formatter={(v) => [`${v > 0 ? '+' : ''}${v} kg`, 'Change']} cursor={{ fill: c.grid }} />
            <ReferenceLine y={0} stroke={c.text} />
            <Bar dataKey="change" radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.label} fill={good(r.change) ? c.good : c.bad} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Panel>
  );
};

/** Steps for the last 14 days against the daily goal. */
export const StepsChart = ({ daily }) => {
  const c = useColors();
  const rows = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i - 13);
      const rec = daily?.[format(d, 'yyyy-MM-dd')];
      return { label: format(d, 'd'), full: format(d, 'EEE d MMM'), steps: rec && rec.steps != null ? Number(rec.steps) : null };
    });
  }, [daily]);
  const logged = rows.filter((r) => r.steps != null);
  if (logged.length === 0) return null;
  const hit = logged.filter((r) => r.steps >= DAILY_GOALS.steps).length;

  return (
    <Panel title="👟 Daily steps" headline={`Goal of ${DAILY_GOALS.steps.toLocaleString()} reached on ${hit} of ${logged.length} logged days`}>
      <Box sx={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip {...tooltipStyle(c)} labelFormatter={(_, p) => p?.[0]?.payload?.full} formatter={(v) => [Number(v).toLocaleString(), 'Steps']} cursor={{ fill: c.grid }} />
            <ReferenceLine y={DAILY_GOALS.steps} stroke={c.good} strokeDasharray="5 4"
              label={{ value: 'Goal', fill: c.good, fontSize: 11, position: 'insideTopRight' }} />
            <Bar dataKey="steps" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.full} fill={r.steps != null && r.steps >= DAILY_GOALS.steps ? c.good : c.weight} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Panel>
  );
};

/** One tape-measure area over time, selectable. */
export const MeasurementChart = ({ measurements }) => {
  const c = useColors();
  const available = MEASURE_FIELDS.filter((f) => measurements.filter((m) => m[f.key] > 0).length >= 2);
  const [pick, setPick] = useState(null);
  const field = available.find((f) => f.key === pick) || available[0];
  if (!field) return null;

  const rows = measurements.filter((m) => m[field.key] > 0)
    .map((m) => ({ label: format(parseLocalDate(m.date), 'd MMM'), value: Number(m[field.key]) }));
  const change = Math.round((rows[rows.length - 1].value - rows[0].value) * 10) / 10;

  return (
    <Panel
      title="📏 Inches off"
      headline={`${field.label}: ${change > 0 ? '+' : ''}${change} cm since your first entry`}
      footer={null}
    >
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
        {available.map((f) => (
          <Chip key={f.key} size="small" label={f.label} onClick={() => setPick(f.key)}
            color={f.key === field.key ? 'primary' : 'default'} variant={f.key === field.key ? 'filled' : 'outlined'} />
        ))}
      </Box>
      <Box sx={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={36} domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip {...tooltipStyle(c)} formatter={(v) => [`${v} cm`, field.label]} />
            <Line type="monotone" dataKey="value" stroke={c.weight} strokeWidth={2.5} dot={{ r: 4, fill: c.weight }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Panel>
  );
};
