import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Button,
  TextField,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  Flag as FlagIcon,
  EmojiEvents as TrophyIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  LocalFireDepartment as FireIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

const Stat = ({ label, value, sub, color }) => (
  <Box sx={{ textAlign: 'center', p: 1 }}>
    <Typography variant="h6" sx={{ fontWeight: 'bold', color: color || 'text.primary', lineHeight: 1.2 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {label}
    </Typography>
    {sub && (
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
        {sub}
      </Typography>
    )}
  </Box>
);

const fmtKg = (n, signed = false) => {
  if (n == null || Number.isNaN(n)) return '--';
  const s = Math.abs(n).toFixed(1);
  if (!signed) return `${s} kg`;
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s} kg`;
};

const WeightJourney = ({ journey, onQuickLog, onEditGoal }) => {
  const [quick, setQuick] = useState('');

  if (!journey) return null;
  const j = journey;
  const isLoss = j.direction !== 'gain';
  // For loss goals a drop is good; for gain goals a rise is good
  const goodColor = '#2e7d32';
  const badColor = '#d32f2f';
  const rateColor =
    j.weeklyRate == null ? 'text.primary' : (j.weeklyRate < 0) === isLoss && j.weeklyRate !== 0 ? goodColor : badColor;

  const etaText = (() => {
    switch (j.etaState) {
      case 'reached': return { v: 'Goal reached 🎉', s: '' };
      case 'date': return { v: format(j.etaDate, 'd MMM yyyy'), s: 'at current pace' };
      case 'wrong-way': return { v: 'Off course', s: 'trend is moving away' };
      case 'no-pace': return { v: 'Need more data', s: 'log a few more days' };
      default: return { v: '--', s: '' };
    }
  })();

  const submitQuick = () => {
    const v = parseFloat(quick);
    if (!v || v <= 0) return;
    onQuickLog(v);
    setQuick('');
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            🏁 My Journey
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              size="small"
              icon={<FireIcon />}
              label={`${j.streak} day streak`}
              color={j.streak >= 3 ? 'warning' : 'default'}
              variant={j.streak >= 3 ? 'filled' : 'outlined'}
            />
            <Chip size="small" variant="outlined" label={`${j.logged30}/30 days logged`} />
            <Button size="small" startIcon={<TuneIcon />} onClick={onEditGoal}>
              Goal setup
            </Button>
          </Box>
        </Box>

        {/* Quick log */}
        {!j.loggedToday && (
          <Box
            sx={{
              display: 'flex', gap: 1, mb: 2, p: 1.5, borderRadius: 2,
              bgcolor: 'action.hover', alignItems: 'center', flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, flex: '1 1 140px' }}>
              ⚖️ Log today's weight
            </Typography>
            <TextField
              size="small"
              type="number"
              placeholder={`${j.current}`}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
              inputProps={{ step: 0.1, min: 0 }}
              sx={{ width: 120 }}
            />
            <Button variant="contained" size="small" onClick={submitQuick} disabled={!quick}>
              Save
            </Button>
          </Box>
        )}

        {/* Progress */}
        {j.target != null ? (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Start {fmtKg(j.startWeight)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {j.progressPct != null ? `${j.progressPct.toFixed(0)}% of the way` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <FlagIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom' }} /> Goal {fmtKg(j.target)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={j.progressPct || 0}
              sx={{ height: 12, borderRadius: 6, bgcolor: 'grey.200', '& .MuiLinearProgress-bar': { borderRadius: 6 } }}
            />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              {j.remaining === 0
                ? 'You have reached your goal weight! 🎉'
                : `${fmtKg(j.remaining)} to go · ${fmtKg(Math.max(0, j.lostSoFar))} ${isLoss ? 'lost' : 'gained'} so far`}
            </Typography>
          </Box>
        ) : (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={onEditGoal}>Set goal</Button>}
          >
            Set a goal weight to see your progress bar, pace and finish date.
          </Alert>
        )}

        <Grid container>
          <Grid item xs={6} sm={3}>
            <Stat
              label={isLoss ? 'Total change' : 'Total change'}
              value={fmtKg(j.changeFromStart, true)}
              color={j.changeFromStart === 0 ? undefined : (j.changeFromStart < 0) === isLoss ? goodColor : badColor}
              sub={`since ${format(j.startDate, 'd MMM')}`}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Stat
              label="Weekly pace"
              value={j.weeklyRate == null ? '--' : `${j.weeklyRate > 0 ? '+' : j.weeklyRate < 0 ? '−' : ''}${Math.abs(j.weeklyRate).toFixed(2)} kg`}
              color={rateColor}
              sub={j.requiredRate ? `need ${j.requiredRate} kg/wk` : 'last 4 weeks'}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Stat label="Projected finish" value={etaText.v} sub={etaText.s} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Stat
              label="Best streak"
              value={`${j.bestStreak} day${j.bestStreak === 1 ? '' : 's'}`}
              sub={`${j.entries} weigh-ins`}
            />
          </Grid>
          <Grid item xs={4}>
            <Stat label="Lowest" value={fmtKg(j.lowest)} />
          </Grid>
          <Grid item xs={4}>
            <Stat label="Highest" value={fmtKg(j.highest)} />
          </Grid>
          <Grid item xs={4}>
            <Stat
              label="Goal date"
              value={j.goalDate ? format(j.goalDate, 'd MMM yy') : '--'}
              sub={j.daysToGoalDate != null && j.daysToGoalDate > 0 ? `${j.daysToGoalDate} days left` : undefined}
            />
          </Grid>
        </Grid>

        {j.insights.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {j.insights.map((ins) => (
              <Alert key={ins.text} severity={ins.type} sx={{ py: 0 }}>
                {ins.text}
              </Alert>
            ))}
          </Box>
        )}

        {/* Milestones */}
        {j.milestones.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              <TrophyIcon sx={{ fontSize: 18, verticalAlign: 'text-bottom', mr: 0.5, color: '#f9a825' }} />
              Milestones
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {j.milestones.map((m) => (
                <Chip
                  key={m.kg}
                  size="small"
                  icon={m.reachedOn ? <CheckIcon /> : <PendingIcon />}
                  color={m.reachedOn ? 'success' : 'default'}
                  variant={m.reachedOn ? 'filled' : 'outlined'}
                  label={`${m.isGoal ? 'Goal' : `${m.kg} kg`} · ${m.level} kg${m.reachedOn ? ` · ${format(m.reachedOn, 'd MMM')}` : ''}`}
                />
              ))}
            </Box>
          </>
        )}

        {/* Weekly summary */}
        {j.weekly.length > 1 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              📅 Weekly averages
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Week of</TableCell>
                    <TableCell align="right">Avg</TableCell>
                    <TableCell align="right">vs prev</TableCell>
                    <TableCell align="right">Logs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {j.weekly.map((w) => (
                    <TableRow key={w.key}>
                      <TableCell>{format(w.start, 'd MMM')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{w.avg.toFixed(1)} kg</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 'bold',
                          color: w.change == null || w.change === 0 ? 'text.secondary' : (w.change < 0) === isLoss ? goodColor : badColor,
                        }}
                      >
                        {w.change == null ? '--' : `${w.change > 0 ? '+' : ''}${w.change.toFixed(1)}`}
                      </TableCell>
                      <TableCell align="right">{w.count}/7</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WeightJourney;
