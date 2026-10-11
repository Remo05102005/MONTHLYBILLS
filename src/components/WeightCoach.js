import React, { useMemo } from 'react';
import { Alert, Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { format } from 'date-fns';
import {
  bodyComposition, coachTips, detectPlateau, summarizeDaily, weeklyCheckin,
} from '../utils/weightCoach';

const Tile = ({ label, value, sub }) => (
  <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
    <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
    {sub && <Typography variant="caption" color="text.disabled">{sub}</Typography>}
  </Box>
);

const WeightCoach = ({ weights, journey, daily, measurements, height, gender }) => {
  const data = useMemo(() => {
    const checkin = weeklyCheckin(weights, daily);
    const daily7 = summarizeDaily(daily, 7);
    const plateau = detectPlateau(weights);
    const bodyComp = bodyComposition({ measurements, height, gender, weight: weights[0]?.weight });
    return { checkin, bodyComp, tips: coachTips({ journey, plateau, daily7, bodyComp, checkin }) };
  }, [weights, journey, daily, measurements, height, gender]);

  if (!weights.length) return null;
  const { checkin: c, bodyComp: b, tips } = data;

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>🧑‍🏫 Coach</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Week of {format(c.weekStart, 'd MMM')}
        </Typography>
        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Tile
              label="Avg weight"
              value={c.avg == null ? '--' : `${c.avg} kg`}
              sub={c.change == null ? 'no last week' : `${c.change > 0 ? '+' : ''}${c.change} vs last week`}
            />
          </Grid>
          <Grid item xs={6} sm={3}><Tile label="Weigh-ins" value={`${c.logs}/7`} /></Grid>
          <Grid item xs={6} sm={3}><Tile label="Workout min" value={c.workout} sub={`last week ${c.lastWorkout}`} /></Grid>
          <Grid item xs={6} sm={3}><Tile label="Avg steps" value={c.avgSteps ?? '--'} /></Grid>
          {b && b.bodyFat != null && (
            <Grid item xs={6} sm={3}>
              <Tile label="Body fat (est.)" value={`${b.bodyFat}%`} sub={b.leanMass ? `lean ${b.leanMass} kg` : undefined} />
            </Grid>
          )}
          {b && b.whtr != null && (
            <Grid item xs={6} sm={3}>
              <Tile label="Waist / height" value={b.whtr} sub={b.whtr < 0.5 ? 'healthy' : 'aim under 0.5'} />
            </Grid>
          )}
        </Grid>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tips.map((t) => (
            <Alert key={t.text} severity={t.type} sx={{ py: 0 }}>{t.text}</Alert>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default WeightCoach;
