import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Snackbar,
  Alert,
  LinearProgress,
  Fab,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MonitorWeight as WeightIcon,
  DateRange as DateRangeIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, isSameDay, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { addWeightToDB, updateWeightInDB, deleteWeightFromDB, subscribeToWeights, fetchLast30DaysWeights, fetchTargetWeight, saveTargetWeight } from '../firebase/weight';
import { generateWeightReport, generateWeightImage } from '../utils/pdfGenerator';

const Weight = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();

  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState(null);
  const [selectedDays, setSelectedDays] = useState(isMobile ? 14 : 30);
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [targetWeight, setTargetWeight] = useState(70);
  const [modalMode, setModalMode] = useState('add-weight'); // 'add-weight' or 'set-target'

  // Form data
  const [formData, setFormData] = useState({
    date: new Date(),
    weight: '',
    targetWeight: '',
  });

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = subscribeToWeights(currentUser.uid, (data) => {
        if (data) {
          const weightsArray = Object.entries(data).map(([id, weight]) => ({
            id,
            ...weight,
            date: new Date(weight.date),
          }));
          weightsArray.sort((a, b) => b.date - a.date); // Most recent first
          setWeights(weightsArray);
        } else {
          setWeights([]);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  // Fetch target weight on component load
  useEffect(() => {
    const loadTargetWeight = async () => {
      if (currentUser) {
        try {
          const target = await fetchTargetWeight(currentUser.uid);
          setTargetWeight(target);
        } catch (error) {
          console.error('Error fetching target weight:', error);
          // Keep default value of 70
        }
      }
    };
    loadTargetWeight();
  }, [currentUser]);

  const handleOpenAddModal = (weight = null) => {
    if (weight) {
      setEditingWeight(weight);
      setFormData({
        date: weight.date,
        weight: weight.weight.toString(),
        targetWeight: targetWeight.toString(),
      });
    } else {
      setEditingWeight(null);
      setFormData({
        date: new Date(),
        weight: '',
        targetWeight: targetWeight.toString(),
      });
    }
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingWeight(null);
    setFormData({
      date: new Date(),
      weight: '',
      targetWeight: '',
    });
  };

  const handleSaveWeight = async () => {
    let targetWeightValue;

    if (modalMode === 'set-target') {
      // Only save target weight
      targetWeightValue = parseFloat(formData.targetWeight);
      if (isNaN(targetWeightValue) || targetWeightValue <= 0) {
        setError('Please enter a valid target weight');
        return;
      }

      try {
        await saveTargetWeight(currentUser.uid, targetWeightValue);
        setTargetWeight(targetWeightValue);
        setSuccess('Target weight updated successfully! 🎯');
        handleCloseModal();
      } catch (err) {
        console.error('Error saving target weight:', err);
        setError('Failed to save target weight. Please try again.');
      }
      return;
    }

    // For add-weight mode or editing
    if (!formData.weight || !formData.date) {
      setError('Please fill in all fields');
      return;
    }

    const weightValue = parseFloat(formData.weight);
    if (isNaN(weightValue) || weightValue <= 0) {
      setError('Please enter a valid weight');
      return;
    }

    try {
      const weightData = {
        date: formData.date.toISOString().split('T')[0], // Store as YYYY-MM-DD
        weight: weightValue,
        createdAt: editingWeight ? editingWeight.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingWeight) {
        await updateWeightInDB(currentUser.uid, editingWeight.id, weightData);
        setSuccess('Weight updated successfully! ⚖️');
      } else {
        await addWeightToDB(currentUser.uid, weightData);
        setSuccess('Weight added successfully! ⚖️');
      }
      handleCloseModal();
    } catch (err) {
      console.error('Error saving weight:', err);
      setError('Failed to save weight. Please try again.');
    }
  };

  const handleDeleteWeight = async (weightId) => {
    try {
      await deleteWeightFromDB(currentUser.uid, weightId);
      setSuccess('Weight deleted successfully!');
    } catch (err) {
      console.error('Error deleting weight:', err);
      setError('Failed to delete weight. Please try again.');
    }
  };

  // Prepare chart data based on selected days
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();

    for (let i = selectedDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Find weight for this date
      const weightEntry = weights.find(w =>
        format(w.date, 'yyyy-MM-dd') === dateStr
      );

      data.push({
        date: selectedDays > 60 ? format(date, 'MM/dd') : format(date, 'MMM dd'), // Shorter format for longer periods
        fullDate: dateStr,
        weight: weightEntry ? weightEntry.weight : null,
      });
    }

    return data;
  }, [weights, selectedDays]);

  const currentWeight = weights.length > 0 ? weights[0].weight : null;
  const weightChange = weights.length > 1 ? weights[0].weight - weights[1].weight : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box sx={{
          bgcolor: 'background.paper',
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 2
        }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {label}
          </Typography>
          {data.weight ? (
            <Typography variant="body2" color="primary">
              Weight: {data.weight} kg
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No data
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  const handleShareReport = async (reportData, fileName) => {
    try {
      // Check if Web Share API is available (mobile devices)
      if (navigator.share && navigator.canShare) {
        try {
          // Convert PDF to blob for sharing
          const pdfBlob = reportData.output('blob');

          // Create a File object for sharing
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

          // Check if we can share this file
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Weight Tracker Report',
              text: 'Check out my weight progress report!',
              files: [file]
            });

            setSuccess('Report shared successfully! 📱');
            return;
          }
        } catch (shareError) {
          console.log('Web Share API failed, falling back to download:', shareError);
        }
      }

      // Fallback to download if Web Share API is not available or fails
      reportData.save(fileName);
      setSuccess('Report downloaded successfully! 📱');

    } catch (err) {
      console.error('Share error:', err);
      setError(`Failed to share report: ${err.message}`);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: 'grey.50',
      pb: isMobile ? 10 : 4
    }}>
      {/* Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        p: isMobile ? 3 : 4,
        pb: isMobile ? 4 : 5
      }}>
        <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 'bold', mb: 1 }}>
          ⚖️ Weight Tracker
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
          Monitor your weight progress over time
        </Typography>

        {/* Stats Cards */}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {currentWeight ? `${currentWeight} kg` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Current Weight
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{
                  fontWeight: 'bold',
                  color: weightChange > 0 ? '#ffcccb' : weightChange < 0 ? '#90ee90' : 'white'
                }}>
                  {weightChange !== 0 ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Change (last entry)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Chart Section */}
      <Box sx={{ p: isMobile ? 2 : 3, pt: 3 }}>
        <Card sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  📈 Weight Trend
                </Typography>
                <Chip
                  icon={<DateRangeIcon />}
                  label={`${selectedDays} days`}
                  size="small"
                  onClick={() => {
                    const days = [7, 30, 60, 90, 120, 365];
                    const currentIndex = days.indexOf(selectedDays);
                    const nextIndex = (currentIndex + 1) % days.length;
                    setSelectedDays(days[nextIndex]);
                  }}
                  sx={{ cursor: 'pointer', bgcolor: 'primary.light', color: 'white' }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={(event) => setShareMenuAnchor(event.currentTarget)}
                  sx={{ color: 'text.secondary' }}
                >
                  <ShareIcon />
                </IconButton>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinearProgress sx={{ width: '50%' }} />
              </Box>
            ) : (
              <Box sx={{
                height: 300,
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                '& .recharts-wrapper': {
                  margin: '0 auto',
                }
              }}>
                <ResponsiveContainer width={Math.max(600, chartData.length * 40)} height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis
                      dataKey="date"
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={theme.palette.text.secondary}
                      fontSize={12}
                      domain={['dataMin - 2', 'dataMax + 2']}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Benchmark lines */}
                    <ReferenceLine
                      y={targetWeight}
                      stroke="#4caf50"
                      strokeDasharray="5 5"
                      label={{ value: "Target", position: "topRight" }}
                    />
                    

                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#667eea"
                      strokeWidth={3}
                      dot={{ fill: '#667eea', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#667eea', strokeWidth: 2 }}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}

            {/* Benchmark Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
              <Chip
                label={`Target: ${targetWeight} kg`}
                sx={{ bgcolor: '#4caf50', color: 'white' }}
                size="small"
              />

            </Box>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              📝 Recent Entries
            </Typography>

            {loading ? (
              <LinearProgress />
            ) : weights.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <WeightIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No weight entries yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start tracking your weight progress!
                </Typography>
              </Box>
            ) : (
              weights.slice(0, 10).map((weight) => (
                <Box
                  key={weight.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {weight.weight} kg
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(weight.date, 'MMM dd, yyyy')}
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenAddModal(weight)}
                      sx={{ color: 'primary.main', mr: 1 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteWeight(weight.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Add Weight FAB */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: isMobile ? 80 : 24,
          right: isMobile ? 16 : 24,
          zIndex: 1000,
        }}
        onClick={() => handleOpenAddModal()}
      >
        <AddIcon />
      </Fab>

      {/* Add/Edit Weight Dialog */}
      <Dialog
        open={isAddModalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editingWeight ? '✏️ Edit Weight' : '⚖️ Weight Entry'}
        </DialogTitle>
        <DialogContent>
          {!editingWeight && (
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend" sx={{ fontWeight: 'bold', mb: 2 }}>
                What would you like to do?
              </FormLabel>
              <RadioGroup
                aria-label="entry-type"
                name="entry-type"
                value={modalMode}
                onChange={(e) => setModalMode(e.target.value)}
                sx={{ flexDirection: 'row', gap: 2 }}
              >
                <FormControlLabel
                  value="add-weight"
                  control={<Radio />}
                  label="📝 Add Weight Entry"
                  sx={{ flex: 1 }}
                />
                <FormControlLabel
                  value="set-target"
                  control={<Radio />}
                  label="🎯 Set Target Weight"
                  sx={{ flex: 1 }}
                />
              </RadioGroup>
            </FormControl>
          )}

          {modalMode === 'add-weight' || editingWeight ? (
            <>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="📅 Date"
                  value={formData.date}
                  onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                  slotProps={{
                    textField: { fullWidth: true, sx: { mb: 2, mt: 1 } }
                  }}
                  format="dd/MM/yyyy"
                />
              </LocalizationProvider>

              <TextField
                fullWidth
                label="⚖️ Weight (kg)"
                type="number"
                placeholder="e.g., 70.5"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                InputProps={{
                  inputProps: { min: 0, step: 0.1 }
                }}
                sx={{ mb: 2 }}
              />
            </>
          ) : (
            <TextField
              fullWidth
              label="🎯 Target Weight (kg)"
              type="number"
              placeholder="e.g., 70.0"
              value={formData.targetWeight}
              onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
              InputProps={{
                inputProps: { min: 0, step: 0.1 }
              }}
              sx={{ mt: 1 }}
              helperText={`Current target: ${targetWeight} kg`}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSaveWeight}
            variant="contained"
            disabled={
              modalMode === 'add-weight' || editingWeight
                ? (!formData.weight || !formData.date)
                : !formData.targetWeight
            }
          >
            {modalMode === 'add-weight' || editingWeight ? (editingWeight ? 'Update Weight' : 'Add Weight') : 'Set Target Weight'}
          </Button>
        </DialogActions>
      </Dialog>



      {/* Share Menu */}
      <Menu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={() => setShareMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          onClick={async () => {
            setShareMenuAnchor(null);
            try {
              const doc = generateWeightReport(weights, selectedDays, targetWeight);
              const fileName = `weight_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
              await handleShareReport(doc, fileName);
            } catch (error) {
              console.error('Error generating PDF:', error);
              setError('Failed to generate PDF report. Please try again.');
            }
          }}
        >
          <ListItemIcon>
            <PdfIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Share PDF" />
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setShareMenuAnchor(null);
            try {
              // We need to get the chart container for image generation
              const chartContainer = document.querySelector('.recharts-wrapper');
              if (chartContainer) {
                await generateWeightImage(weights, selectedDays, targetWeight, { current: chartContainer });
                // Note: generateWeightImage already handles sharing internally
              } else {
                setError('Chart not found. Please try again.');
              }
            } catch (error) {
              console.error('Error sharing image:', error);
              setError('Failed to share chart image. Please try again.');
            }
          }}
        >
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Share Image" />
        </MenuItem>
      </Menu>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccess(null)}
          severity="success"
          sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}
        >
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setError(null)}
          severity="error"
          sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Weight;
