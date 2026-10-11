import React, { useEffect, useRef, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, LinearProgress, Grid, Snackbar, Alert } from '@mui/material';
import { format } from 'date-fns';
import { saveDailyLog } from '../firebase/weight';
import { DAILY_GOALS, summarizeDaily } from '../utils/weightCoach';

const FIELDS = [
  { key: 'water', label: '💧 Water', unit: 'glasses', step: 1 },
  { key: 'steps', label: '👟 Steps', unit: 'steps', step: 500 },
  { key: 'sleep', label: '😴 Sleep', unit: 'hours', step: 0.5 },
  { key: 'workout', label: '🏋️ Workout', unit: 'min', step: 5 },
];

const WeightHabits = ({ uid, daily }) => {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [vals, setVals] = useState({});
  const [msg, setMsg] = useState(null);
  const avg = summarizeDaily(daily, 7);

  // Re-sync from the database only when the stored values change, never mid-typing
  const lastStored = useRef('');
  useEffect(() => {
    const t = (daily && daily[todayKey]) || {};
    const stored = JSON.stringify(FIELDS.map((f) => t[f.key] ?? ''));
    if (stored === lastStored.current) return;
    lastStored.current = stored;
    setVals(Object.fromEntries(FIELDS.map((f) => [f.key, t[f.key] ?? ''])));
  }, [daily, todayKey]);

  const save = async () => {
    const data = {};
    FIELDS.forEach((f) => {
      const n = parseFloat(vals[f.key]);
      // null removes the stored value when the field was cleared
      data[f.key] = !Number.isNaN(n) && n >= 0 ? n : null;
    });
    try {
      await saveDailyLog(uid, todayKey, data);
      setMsg({ s: 'success', t: "Today's habits saved ✅" });
    } catch (e) {
      console.error('Error saving daily log:', e);
      setMsg({ s: 'error', t: 'Could not save. Try again.' });
    }
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>✅ Today's habits</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Weight moves because of what you do every day. Log these four.
        </Typography>
        <Grid container spacing={2}>
          {FIELDS.map((f) => {
            const goal = DAILY_GOALS[f.key];
            const pct = Math.min(100, ((parseFloat(vals[f.key]) || 0) / goal) * 100);
            return (
              <Grid item xs={6} md={3} key={f.key}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={`${f.label} (${f.unit})`}
                  value={vals[f.key] ?? ''}
                  inputProps={{ min: 0, step: f.step }}
                  onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                />
                <LinearProgress variant="determinate" value={pct} color={pct >= 100 ? 'success' : 'primary'} sx={{ mt: 0.75, height: 6, borderRadius: 3 }} />
                <Typography variant="caption" color="text.secondary">
                  goal {goal} · 7-day avg {avg[f.key] ?? '--'}
                </Typography>
              </Grid>
            );
          })}
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {avg.activeDays} active day(s) · {avg.workoutTotal} workout min in the last 7 days
          </Typography>
          <Button variant="contained" size="small" onClick={save}>Save today</Button>
        </Box>
      </CardContent>
      <Snackbar open={!!msg} autoHideDuration={3000} onClose={() => setMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={msg ? msg.s : 'info'} onClose={() => setMsg(null)}>{msg ? msg.t : ''}</Alert>
      </Snackbar>
    </Card>
  );
};

export default WeightHabits;
