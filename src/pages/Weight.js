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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Select,
  FormControl as MuiFormControl,
  InputLabel,
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, isSameDay, parseISO, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { addWeightToDB, updateWeightInDB, deleteWeightFromDB, subscribeToWeights, fetchLast30DaysWeights, fetchHeight, saveHeight, fetchTargetWeight, saveTargetWeight, fetchGender, saveGender } from '../firebase/weight';
import { generateWeightReport, generateWeightImage } from '../utils/pdfGenerator';

// BMI calculation functions
const calculateBMI = (weight, height) => {
  // weight in kg, height in cm
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
};

const getBMICategory = (bmi) => {
  if (bmi < 18.5) return { category: 'Underweight', color: '#e91e63' }; // pink
  if (bmi < 25) return { category: 'Normal', color: '#4caf50' }; // green
  if (bmi < 30) return { category: 'Overweight', color: '#ff9800' }; // orange
  return { category: 'Obese', color: '#f44336' }; // red
};

const getIdealWeightRange = (height, gender = 'male') => {
  const heightInMeters = height / 100;
  // BMI ranges are generally the same for both genders, but we can show slight variations
  // For females, slightly lower BMI might be acceptable due to different body composition
  const minBMI = gender === 'female' ? 18.0 : 18.5;
  const maxBMI = 24.9; // Same for both genders

  const minWeight = minBMI * (heightInMeters * heightInMeters);
  const maxWeight = maxBMI * (heightInMeters * heightInMeters);
  return { min: minWeight, max: maxWeight };
};

const Weight = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();

  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState(null);
  const [selectedDays, setSelectedDays] = useState(isMobile ? 14 : 30);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM')); // Current month by default
  const [dateRange, setDateRange] = useState(null); // For custom date filtering
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [height, setHeight] = useState(170); // height in cm
  const [targetWeight, setTargetWeight] = useState(null); // custom target weight, null means use BMI normal range
  const [gender, setGender] = useState('male'); // 'male' or 'female'
  const [modalMode, setModalMode] = useState('add-weight'); // 'add-weight', 'set-height', 'set-target', or 'set-gender'
  const [confirmDeleteWeight, setConfirmDeleteWeight] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    date: new Date(),
    weight: '',
    height: '',
    targetWeight: '',
    gender: gender,
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

  // Fetch height on component load
  useEffect(() => {
    const loadHeight = async () => {
      if (currentUser) {
        try {
          const userHeight = await fetchHeight(currentUser.uid);
          setHeight(userHeight);
        } catch (error) {
          console.error('Error fetching height:', error);
          // Keep default value of 170
        }
      }
    };
    loadHeight();
  }, [currentUser]);

  // Fetch custom target weight on component load
  useEffect(() => {
    const loadTargetWeight = async () => {
      if (currentUser) {
        try {
          const userTargetWeight = await fetchTargetWeight(currentUser.uid);
          setTargetWeight(userTargetWeight);
        } catch (error) {
          console.error('Error fetching target weight:', error);
          // Keep default value of null
        }
      }
    };
    loadTargetWeight();
  }, [currentUser]);

  // Fetch gender on component load
  useEffect(() => {
    const loadGender = async () => {
      if (currentUser) {
        try {
          const userGender = await fetchGender(currentUser.uid);
          setGender(userGender);
        } catch (error) {
          console.error('Error fetching gender:', error);
          // Keep default value of 'male'
        }
      }
    };
    loadGender();
  }, [currentUser]);

  const handleOpenAddModal = (weight = null) => {
    if (weight) {
      setEditingWeight(weight);
      setModalMode('add-weight'); // Reset to add-weight mode when editing
      setFormData({
        date: weight.date,
        weight: weight.weight.toString(),
        height: height.toString(),
        gender: gender,
      });
    } else {
      setEditingWeight(null);
      setFormData({
        date: new Date(),
        weight: '',
        height: height.toString(),
        gender: gender,
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
      height: '',
    });
  };

  const handleSaveWeight = async () => {
    let heightValue;
    let targetWeightValue;

    if (modalMode === 'set-height') {
      // Only save height
      heightValue = parseFloat(formData.height);
      if (isNaN(heightValue) || heightValue <= 0 || heightValue > 300) {
        setError('Please enter a valid height (in cm)');
        return;
      }

      try {
        await saveHeight(currentUser.uid, heightValue);
        setHeight(heightValue);
        setSuccess('Height updated successfully! 📏');
        handleCloseModal();
      } catch (err) {
        console.error('Error saving height:', err);
        setError('Failed to save height. Please try again.');
      }
      return;
    }

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

    if (modalMode === 'set-gender') {
      // Only save gender
      try {
        await saveGender(currentUser.uid, formData.gender);
        setGender(formData.gender);
        setSuccess('Gender updated successfully! 👤');
        handleCloseModal();
      } catch (err) {
        console.error('Error saving gender:', err);
        setError('Failed to save gender. Please try again.');
      }
      return;
    }

    // For add-weight mode or editing
    if (!formData.weight || !formData.date) {
      setError('Please fill in all fields');
      return;
    }

    // Check if date is in the future
    if (isAfter(startOfDay(formData.date), startOfDay(new Date()))) {
      setError('Cannot add weight entries for future dates');
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

  const handleConfirmDelete = async () => {
    if (confirmDeleteWeight) {
      await handleDeleteWeight(confirmDeleteWeight.id);
      setConfirmDeleteWeight(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteWeight(null);
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
  const currentBMI = currentWeight ? calculateBMI(currentWeight, height) : null;
  const bmiCategory = currentBMI ? getBMICategory(currentBMI) : null;
  const idealWeightRange = getIdealWeightRange(height, gender);

  // Calculate estimated days to reach target weight using movement estimation
  const calculateDaysToTarget = () => {
    if (!currentWeight || weights.length < 2) return null;

    // Determine target weight
    let targetWeightValue;
    let targetType;

    if (targetWeight) {
      // Custom target weight is set
      targetWeightValue = targetWeight;
      targetType = "custom target";
    } else {
      // Use BMI normal range
      if (currentBMI >= 18.5 && currentBMI <= 24.9) {
        return "Already reached";
      }

      // Determine target weight based on current BMI
      if (currentBMI < 18.5) {
        // Underweight - aim for minimum normal weight
        targetWeightValue = idealWeightRange.min;
      } else {
        // Overweight/Obese - aim for maximum normal weight
        targetWeightValue = idealWeightRange.max;
      }
      targetType = "normal BMI";
    }

    // If already at target (for custom target)
    if (targetWeight && Math.abs(currentWeight - targetWeight) < 0.1) {
      return "Already reached";
    }

    // Use movement estimation for weight changes (not simple linear)
    const sortedWeights = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));
    const n = sortedWeights.length;

    if (n < 3) return null; // Need at least 3 data points for estimation

    // Calculate recent trend (last 4 weeks or available data)
    const recentWeights = sortedWeights.slice(-Math.min(28, n)); // Last 4 weeks max
    const firstRecent = recentWeights[0];
    const lastRecent = recentWeights[recentWeights.length - 1];

    const daysSpan = Math.max(1, (new Date(lastRecent.date) - new Date(firstRecent.date)) / (1000 * 60 * 60 * 24));
    const weightChange = lastRecent.weight - firstRecent.weight;
    const weeklyRate = (weightChange / daysSpan) * 7; // kg per week

    // Weight loss/gain follows different mechanics - use conservative estimation
    // Sustainable weight loss: ~0.5-1kg per week
    // Sustainable weight gain: ~0.2-0.5kg per week

    const weightNeeded = targetWeightValue - currentWeight;
    const isWeightLoss = weightNeeded < 0;

    // Use more conservative rate for estimation
    let estimatedWeeklyRate;

    if (isWeightLoss) {
      // For weight loss, use recent trend but cap at realistic maximum
      estimatedWeeklyRate = Math.max(weeklyRate, -1.0); // Max 1kg/week loss
      // If recent trend shows slower loss, use even more conservative estimate
      if (weeklyRate > -0.2) {
        estimatedWeeklyRate = -0.5; // Conservative 0.5kg/week loss
      }
    } else {
      // For weight gain, use recent trend but cap at realistic maximum
      estimatedWeeklyRate = Math.min(weeklyRate, 0.5); // Max 0.5kg/week gain
      // If recent trend shows slower gain, use conservative estimate
      if (weeklyRate < 0.1) {
        estimatedWeeklyRate = 0.2; // Conservative 0.2kg/week gain
      }
    }

    if (Math.abs(estimatedWeeklyRate) < 0.01) return "Stable weight"; // No significant change

    const weeksNeeded = Math.abs(weightNeeded) / Math.abs(estimatedWeeklyRate);
    const daysNeeded = weeksNeeded * 7;

    // Add buffer for weight loss/gain plateaus and sustainability
    const adjustedDays = isWeightLoss ? daysNeeded * 1.3 : daysNeeded * 1.2; // 30% buffer for loss, 20% for gain

    if (adjustedDays > 365 * 2) return "Long term goal"; // More than 2 years
    if (adjustedDays < 0) return "Already reached"; // Going in wrong direction

    return Math.ceil(adjustedDays);
  };

  const daysToTarget = calculateDaysToTarget();

  // Get available months from weight data
  const availableMonths = useMemo(() => {
    if (weights.length === 0) return [];

    const months = new Set();
    weights.forEach(weight => {
      const monthKey = format(weight.date, 'yyyy-MM');
      months.add(monthKey);
    });

    return Array.from(months).sort().reverse(); // Most recent first
  }, [weights]);

  // Filter weights by selected month
  const filteredWeights = useMemo(() => {
    if (selectedMonth === 'all') return weights;
    return weights.filter(weight =>
      format(weight.date, 'yyyy-MM') === selectedMonth
    );
  }, [weights, selectedMonth]);

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
        background: 'linear-gradient(135deg, #2d2e32ff 0%, #020202ff 100%)',
        color: 'white',
        p: isMobile ? 3 : 4,
        pb: isMobile ? 4 : 5
      }}>
        <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 'bold', mb: 1 }}>
          Weight Tracker
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
          Monitor your weight progress over time
        </Typography>

        {/* Stats Cards */}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: bmiCategory ? bmiCategory.color : 'white' }}>
                  {currentBMI ? `${currentBMI.toFixed(1)}` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Current BMI
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, color: bmiCategory ? bmiCategory.color : 'white' }}>
                  {bmiCategory ? bmiCategory.category : ''}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                  {idealWeightRange ? `${idealWeightRange.min.toFixed(1)}-${idealWeightRange.max.toFixed(1)} kg` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Ideal Weight Range
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  For {height}cm height
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{
                  fontWeight: 'bold',
                  color: weightChange > 0 ? '#ffcccb' : weightChange < 0 ? '#90ee90' : 'white'
                }}>
                  {weightChange !== 0 ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Latest Change
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  From last entry
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{
                  fontWeight: 'bold',
                  color: daysToTarget === "Already reached" ? '#4caf50' : daysToTarget === "Stable weight" ? '#ff9800' : '#2196f3'
                }}>
                  {typeof daysToTarget === 'number' ? `${daysToTarget}` : daysToTarget || '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Days to {targetWeight ? 'Target' : 'Normal BMI'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {targetWeight ? `Target: ${targetWeight} kg` : 'Based on current trend'}
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

            {/* Quick Filter Buttons for Large Datasets */}
            {weights.length > 30 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label="Last 30 Days"
                  size="small"
                  onClick={() => setSelectedDays(30)}
                  variant={selectedDays === 30 ? 'filled' : 'outlined'}
                  color="primary"
                />
                <Chip
                  label="Last 3 Months"
                  size="small"
                  onClick={() => setSelectedDays(90)}
                  variant={selectedDays === 90 ? 'filled' : 'outlined'}
                  color="primary"
                />
                <Chip
                  label="Last 6 Months"
                  size="small"
                  onClick={() => setSelectedDays(180)}
                  variant={selectedDays === 180 ? 'filled' : 'outlined'}
                  color="primary"
                />
                {weights.length > 200 && (
                  <Chip
                    label="All Time"
                    size="small"
                    onClick={() => setSelectedDays(365)}
                    variant={selectedDays === 365 ? 'filled' : 'outlined'}
                    color="secondary"
                  />
                )}
              </Box>
            )}

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
                <ResponsiveContainer width="100%" height="100%">
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
                    <RechartsTooltip content={CustomTooltip} />

                    {/* BMI Zone lines */}
                    <ReferenceLine
                      y={idealWeightRange.min}
                      stroke="#e91e63"
                      strokeDasharray="3 3"
                      label={{ value: "Underweight", position: "topLeft", fontSize: 10 }}
                    />
                    <ReferenceLine
                      y={idealWeightRange.max}
                      stroke="#4caf50"
                      strokeDasharray="3 3"
                      label={{ value: "Normal", position: "topLeft", fontSize: 10 }}
                    />
                    <ReferenceLine
                      y={idealWeightRange.max + ((idealWeightRange.max - idealWeightRange.min) * 0.2)}
                      stroke="#ff9800"
                      strokeDasharray="3 3"
                      label={{ value: "Overweight", position: "topLeft", fontSize: 10 }}
                    />

                    {/* Target weight line */}
                    {targetWeight ? (
                      <ReferenceLine
                        y={targetWeight}
                        stroke="#2196f3"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{ value: `Target`, position: "topRight", fontSize: 11, fill: "#2196f3" }}
                      />
                    ) : currentBMI && (
                      <ReferenceLine
                        y={currentBMI < 18.5 ? idealWeightRange.min : idealWeightRange.max}
                        stroke="#2196f3"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{
                          value: `BMI Target: ${currentBMI < 18.5 ? idealWeightRange.min.toFixed(1) : idealWeightRange.max.toFixed(1)}kg`,
                          position: "topRight",
                          fontSize: 11,
                          fill: "#2196f3"
                        }}
                      />
                    )}

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

            {/* BMI Categories Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, justifyContent: 'center' }}>
              <Chip
                label="Underweight: <18.5"
                sx={{ bgcolor: '#e91e63', color: 'white' }}
                size="small"
              />
              <Chip
                label="Normal: 18.5-25"
                sx={{ bgcolor: '#4caf50', color: 'white' }}
                size="small"
              />
              <Chip
                label="Overweight: 25-30"
                sx={{ bgcolor: '#ff9800', color: 'white' }}
                size="small"
              />
              <Chip
                label="Obese: >30"
                sx={{ bgcolor: '#f44336', color: 'white' }}
                size="small"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                📊 Weight Records
              </Typography>

              {/* Month Selector */}
              {availableMonths.length > 1 && (
                <MuiFormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={selectedMonth}
                    label="Month"
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {availableMonths.map(month => (
                      <MenuItem key={month} value={month}>
                        {format(new Date(month + '-01'), 'MMM yyyy')}
                      </MenuItem>
                    ))}
                  </Select>
                </MuiFormControl>
              )}
            </Box>

            {loading ? (
              <LinearProgress />
            ) : weights.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <WeightIcon sx={{ fontSize: 72, color: 'grey.300', mb: 3 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No weight entries yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start tracking your weight progress!
                </Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 500 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📅 Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">⚖️ Weight</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">📏 BMI</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">📈 Change</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">🎯 Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">⚙️ Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredWeights.map((weight, filteredIndex) => {
                      const bmi = calculateBMI(weight.weight, height);
                      const bmiCategory = getBMICategory(bmi);

                      // Find the index in the full weights array for status calculation
                      const fullIndex = weights.findIndex(w => w.id === weight.id);
                      const prevWeight = weights[fullIndex + 1]?.weight;
                      const nextWeight = weights[fullIndex - 1]?.weight;
                      const change = prevWeight ? weight.weight - prevWeight : null;

                      // Calculate status indicators based on full dataset
                      const isLatest = fullIndex === 0;
                      const isLowest = weights.length > 1 && weight.weight === Math.min(...weights.map(w => w.weight));
                      const isHighest = weights.length > 1 && weight.weight === Math.max(...weights.map(w => w.weight));

                      // Check for local peaks (higher than both neighbors in full dataset)
                      const isPeak = weights.length > 2 &&
                        fullIndex > 0 && fullIndex < weights.length - 1 &&
                        weight.weight > prevWeight && weight.weight > nextWeight;

                      // Check for local valleys (lower than both neighbors in full dataset)
                      const isValley = weights.length > 2 &&
                        fullIndex > 0 && fullIndex < weights.length - 1 &&
                        weight.weight < prevWeight && weight.weight < nextWeight;

                      // Determine status chips (can have multiple)
                      const statusChips = [];
                      if (isLatest) {
                        statusChips.push(
                          <Chip
                            key="latest"
                            label="Latest"
                            size="small"
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'white',
                              fontSize: '0.65rem',
                              height: 18,
                              mr: 0.5,
                              mb: 0.5
                            }}
                          />
                        );
                      }
                      if (isLowest) {
                        statusChips.push(
                          <Chip
                            key="lowest"
                            label="Lowest"
                            size="small"
                            sx={{
                              bgcolor: '#4caf50',
                              color: 'white',
                              fontSize: '0.65rem',
                              height: 18,
                              mr: 0.5,
                              mb: 0.5
                            }}
                          />
                        );
                      }
                      if (isHighest) {
                        statusChips.push(
                          <Chip
                            key="highest"
                            label="Highest"
                            size="small"
                            sx={{
                              bgcolor: '#f44336',
                              color: 'white',
                              fontSize: '0.65rem',
                              height: 18,
                              mr: 0.5,
                              mb: 0.5
                            }}
                          />
                        );
                      }
                      if (isPeak) {
                        statusChips.push(
                          <Chip
                            key="peak"
                            label="Peak"
                            size="small"
                            sx={{
                              bgcolor: '#ff9800',
                              color: 'white',
                              fontSize: '0.65rem',
                              height: 18,
                              mr: 0.5,
                              mb: 0.5
                            }}
                          />
                        );
                      }
                      if (isValley) {
                        statusChips.push(
                          <Chip
                            key="valley"
                            label="Valley"
                            size="small"
                            sx={{
                              bgcolor: '#9c27b0',
                              color: 'white',
                              fontSize: '0.65rem',
                              height: 18,
                              mr: 0.5,
                              mb: 0.5
                            }}
                          />
                        );
                      }

                      return (
                        <TableRow
                          key={weight.id}
                          sx={{
                            '&:hover': { bgcolor: 'grey.50' },
                            bgcolor: fullIndex === 0 ? 'rgba(76, 175, 80, 0.08)' : 'inherit'
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {format(weight.date, 'MMM dd, yyyy')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(weight.date, 'EEEE')}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {weight.weight} kg
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 'bold',
                                  color: bmiCategory.color,
                                  fontSize: '0.9rem'
                                }}
                              >
                                {bmi.toFixed(1)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: bmiCategory.color, fontSize: '0.7rem' }}>
                                {bmiCategory.category}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            {change !== null ? (
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 'bold',
                                  color: change > 0 ? '#f44336' : change < 0 ? '#4caf50' : 'text.secondary',
                                  fontSize: '0.9rem'
                                }}
                              >
                                {change > 0 ? '+' : ''}{change.toFixed(1)} kg
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                --
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5 }}>
                              {statusChips.length > 0 ? statusChips : (
                                <Typography variant="caption" color="text.secondary">
                                  --
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Edit entry">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenAddModal(weight)}
                                sx={{ color: 'primary.main', mr: 1 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete entry">
                              <IconButton
                                size="small"
                                onClick={() => setConfirmDeleteWeight(weight)}
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
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
        disableScrollLock={true}
        disableEnforceFocus={true}
        disableAutoFocus={true}
        disableRestoreFocus={true}
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
                sx={{ flexDirection: 'column', gap: 1 }}
              >
                <FormControlLabel
                  value="add-weight"
                  control={<Radio />}
                  label="📝 Add Weight Entry"
                />
                <FormControlLabel
                  value="set-height"
                  control={<Radio />}
                  label="📏 Set Height"
                />
                <FormControlLabel
                  value="set-target"
                  control={<Radio />}
                  label="🎯 Set Custom Target Weight"
                />
                <FormControlLabel
                  value="set-gender"
                  control={<Radio />}
                  label="👤 Set Gender"
                />
              </RadioGroup>
            </FormControl>
          )}

          {modalMode === 'set-gender' ? (
            <FormControl component="fieldset" sx={{ mt: 1 }}>
              <FormLabel component="legend" sx={{ fontWeight: 'bold', mb: 2 }}>
                Select your gender
              </FormLabel>
              <RadioGroup
                aria-label="gender"
                name="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                sx={{ flexDirection: 'row', gap: 3 }}
              >
                <FormControlLabel
                  value="male"
                  control={<Radio />}
                  label="👨 Male"
                />
                <FormControlLabel
                  value="female"
                  control={<Radio />}
                  label="👩 Female"
                />
              </RadioGroup>
            </FormControl>
          ) : modalMode === 'add-weight' || editingWeight ? (
            <>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="📅 Date"
                  value={formData.date}
                  onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                  shouldDisableDate={(date) => isAfter(startOfDay(date), startOfDay(new Date()))}
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
          ) : modalMode === 'set-height' ? (
            <TextField
              fullWidth
              label="📏 Height (cm)"
              type="number"
              placeholder="e.g., 170"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              InputProps={{
                inputProps: { min: 50, max: 300, step: 1 }
              }}
              sx={{ mt: 1 }}
              helperText={`Current height: ${height} cm`}
            />
          ) : (
            <TextField
              fullWidth
              label="🎯 Custom Target Weight (kg)"
              type="number"
              placeholder="e.g., 75.0"
              value={formData.targetWeight}
              onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
              InputProps={{
                inputProps: { min: 0, step: 0.1 }
              }}
              sx={{ mt: 1 }}
              helperText={`Current target: ${targetWeight ? `${targetWeight} kg` : 'BMI normal range'}`}
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
                : modalMode === 'set-height'
                ? !formData.height
                : modalMode === 'set-target'
                ? !formData.targetWeight
                : modalMode === 'set-gender'
                ? !formData.gender
                : false
            }
          >
            {modalMode === 'add-weight' || editingWeight
              ? (editingWeight ? 'Update Weight' : 'Add Weight')
              : modalMode === 'set-height'
              ? 'Set Height'
              : modalMode === 'set-target'
              ? 'Set Target Weight'
              : modalMode === 'set-gender'
              ? 'Set Gender'
              : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDeleteWeight)}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
        disableScrollLock={true}
        disableEnforceFocus={true}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>
          🗑️ Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the weight entry for{' '}
            <strong>{confirmDeleteWeight && format(confirmDeleteWeight.date, 'MMM dd, yyyy')}</strong>{' '}
            ({confirmDeleteWeight && `${confirmDeleteWeight.weight} kg`})?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
          >
            Delete
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
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: 3,
            borderRadius: 2,
          }
        }}
        disableScrollLock={true}
      >
        <MenuItem
          onClick={async () => {
            setShareMenuAnchor(null);
            try {
              // Get the chart container reference for PDF
              const chartContainer = document.querySelector('.recharts-wrapper')?.parentElement;
              const doc = await generateWeightReport(weights, selectedDays, idealWeightRange.min, chartContainer ? { current: chartContainer } : null);
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
                await generateWeightImage(weights, selectedDays, idealWeightRange.min, { current: chartContainer });
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
