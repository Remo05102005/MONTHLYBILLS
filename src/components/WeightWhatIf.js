import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Slider, Chip } from '@mui/material';
import { format } from 'date-fns';
import { projectFinish } from '../utils/weightAnalytics';

const WeightWhatIf = ({ journey }) => {
  const [rate, setRate] = useState(0.5);

  // Only meaningful for a loss goal that is not yet reached
  if (!journey || journey.target == null || journey.direction !== 'loss' || !journey.remaining) return null;

  const proj = projectFinish(journey, rate);
  const current = journey.weeklyRate != null && journey.weeklyRate < 0 ? Math.abs(journey.weeklyRate) : null;
  const currentProj = current ? projectFinish(journey, current) : null;
  const daysDiff = proj && currentProj ? Math.round((currentProj.date - proj.date) / 86400000) : null;
  const pctPerWeek = (rate / journey.current) * 100;
  const goalDateOk = proj && journey.goalDate ? proj.date <= journey.goalDate : null;

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>🔮 What if…</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          If I lose <strong>{rate.toFixed(2)} kg</strong> every week from now on
        </Typography>

        <Slider
          value={rate}
          min={0.1}
          max={1.5}
          step={0.05}
          onChange={(e, v) => setRate(v)}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v.toFixed(2)} kg/wk`}
          sx={{ mb: 1 }}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <Chip key={r} size="small" label={`${r} kg/wk`} onClick={() => setRate(r)}
              variant={rate === r ? 'filled' : 'outlined'} color="primary" />
          ))}
          {current && (
            <Chip size="small" label={`My pace ${current.toFixed(2)}`} onClick={() => setRate(Math.min(1.5, Math.max(0.1, Math.round(current * 20) / 20)))}
              variant="outlined" color="secondary" />
          )}
        </Box>

        {proj && (
          <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{format(proj.date, 'd MMM yyyy')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {journey.remaining.toFixed(1)} kg to go · about {Math.ceil(proj.weeks)} weeks
            </Typography>
            {daysDiff != null && daysDiff !== 0 && (
              <Typography variant="body2" sx={{ color: daysDiff > 0 ? 'success.main' : 'warning.main', fontWeight: 600 }}>
                {Math.abs(daysDiff)} days {daysDiff > 0 ? 'sooner' : 'later'} than your current pace
              </Typography>
            )}
            {goalDateOk != null && (
              <Typography variant="body2" sx={{ color: goalDateOk ? 'success.main' : 'warning.main' }}>
                {goalDateOk ? 'Meets your goal date ✓' : `Misses your goal date (${format(journey.goalDate, 'd MMM')})`}
              </Typography>
            )}
            {pctPerWeek > 1 && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                That is over 1% of body weight per week — aggressive and hard to sustain.
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default WeightWhatIf;
