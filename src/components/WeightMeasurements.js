import React, { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Snackbar, Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { addMeasurementToDB, deleteMeasurementFromDB } from '../firebase/weight';
import { MEASURE_FIELDS, summarizeMeasurements, parseLocalDate } from '../utils/weightAnalytics';

const emptyForm = () => ({
  date: format(new Date(), 'yyyy-MM-dd'),
  ...Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, ''])),
});

const WeightMeasurements = ({ uid, measurements }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const summary = useMemo(() => summarizeMeasurements(measurements), [measurements]);

  const save = async () => {
    if (!form.date || form.date > format(new Date(), 'yyyy-MM-dd')) {
      setError('Pick today or an earlier date');
      return;
    }
    const data = { date: form.date, createdAt: new Date().toISOString() };
    let any = false;
    MEASURE_FIELDS.forEach(({ key }) => {
      const v = parseFloat(form[key]);
      if (!Number.isNaN(v) && v > 0) { data[key] = v; any = true; }
    });
    if (!any) { setError('Enter at least one measurement'); return; }
    try {
      await addMeasurementToDB(uid, data);
      setOpen(false);
      setForm(emptyForm());
    } catch (e) {
      console.error('Error saving measurements:', e);
      setError('Failed to save measurements. Please try again.');
    }
  };

  const remove = async (id) => {
    try {
      await deleteMeasurementFromDB(uid, id);
    } catch (e) {
      console.error('Error deleting measurement:', e);
      setError('Failed to delete entry.');
    }
  };

  const recent = [...(measurements || [])].reverse().slice(0, 5);

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>📏 Body Measurements</Typography>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add</Button>
        </Box>

        {summary.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            The scale can stall while inches keep dropping. Log waist, hips and more every week or two (in cm).
          </Typography>
        ) : (
          <>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {summary.map((s) => (
                <Grid item xs={6} sm={4} key={s.key}>
                  <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>{s.latest} cm</Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: s.change < 0 ? 'success.main' : s.change > 0 ? 'error.main' : 'text.secondary' }}
                    >
                      {s.count > 1 ? `${s.change > 0 ? '+' : ''}${s.change} cm since start` : 'first entry'}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    {MEASURE_FIELDS.map((f) => <TableCell key={f.key} align="right">{f.label}</TableCell>)}
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recent.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{format(parseLocalDate(m.date), 'd MMM yy')}</TableCell>
                      {MEASURE_FIELDS.map((f) => <TableCell key={f.key} align="right">{m[f.key] ?? '–'}</TableCell>)}
                      <TableCell padding="none">
                        <IconButton size="small" onClick={() => remove(m.id)} aria-label="Delete measurement">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>📏 Add measurements</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth type="date" label="Date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            InputLabelProps={{ shrink: true }} inputProps={{ max: format(new Date(), 'yyyy-MM-dd') }} sx={{ mt: 1, mb: 2 }}
          />
          <Grid container spacing={2}>
            {MEASURE_FIELDS.map((f) => (
              <Grid item xs={6} key={f.key}>
                <TextField
                  fullWidth size="small" type="number" label={`${f.label} (cm)`} value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  inputProps={{ min: 0, step: 0.1 }}
                />
              </Grid>
            ))}
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Leave blank any you did not measure.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
    </Card>
  );
};

export default WeightMeasurements;
