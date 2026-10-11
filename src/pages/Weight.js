import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
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
import { format, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { 
  addWeightToDB, 
  updateWeightInDB, 
  deleteWeightFromDB, 
  subscribeToWeights,
  fetchHeight,
  saveHeight,
  fetchTargetWeight,
  fetchGender,
  saveGender,
  fetchJourneySettings,
  saveJourneySettings,
  subscribeToMeasurements,
  subscribeToDaily,
} from '../firebase/weight';
import PdfPreviewDialog from '../components/PdfPreviewDialog';
import WeightJourney from '../components/WeightJourney';
import WeightMeasurements from '../components/WeightMeasurements';
import WeightBadges from '../components/WeightBadges';
import WeightWhatIf from '../components/WeightWhatIf';
import WeightHabits from '../components/WeightHabits';
import WeightCoach from '../components/WeightCoach';
import { ProgressHero, GoalPathChart, WeeklyChangeChart, StepsChart, MeasurementChart } from '../components/WeightCharts';
import { computeJourney, buildTrendMap, parseLocalDate, MOODS, NOTE_TAGS } from '../utils/weightAnalytics';
import { buildCsv } from '../utils/weightCoach';

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
  const [selectedDays, setSelectedDays] = useState(isMobile ? 7 : 30);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM')); // Current month by default
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [success, setSuccess] = useState(null);
  // Generated weight report waiting in the preview: { doc, fileName }
  const [pdfPreview, setPdfPreview] = useState(null);
  const [error, setError] = useState(null);
  const [height, setHeight] = useState(170); // height in cm
  const [targetWeight, setTargetWeight] = useState(null); // custom target weight, null means use BMI normal range
  const [gender, setGender] = useState('male'); // 'male' or 'female'
  const [modalMode, setModalMode] = useState('add-weight'); // 'add-weight', 'set-journey', 'set-height', or 'set-gender'
  const [confirmDeleteWeight, setConfirmDeleteWeight] = useState(null);
  const [journeySettings, setJourneySettings] = useState({ startWeight: null, startDate: null, goalDate: null });

  const trendChartRef = useRef(null);
  const [tab, setTab] = useState(0); // 0 Today, 1 Progress, 2 History
  const [visibleCount, setVisibleCount] = useState(20);
  const [measurements, setMeasurements] = useState([]);
  const [daily, setDaily] = useState({});
  const [isSharing, setIsSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    date: new Date(),
    weight: '',
    height: '',
    targetWeight: '',
    gender: gender,
    startWeight: '',
    goalDate: '',
    note: '',
    mood: null,
    tags: [],
  });

  useEffect(() => {
    if (!currentUser) return undefined;
    return subscribeToMeasurements(currentUser.uid, setMeasurements);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return undefined;
    return subscribeToDaily(currentUser.uid, setDaily);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = subscribeToWeights(currentUser.uid, (data) => {
        if (data) {
          const weightsArray = Object.entries(data).map(([id, weight]) => {
            // Try to parse date in different formats
            let dateObj;
            if (weight.date) {
              // Try ISO string format first
              // Local-date parse so 'yyyy-MM-dd' doesn't shift a day across timezones
              dateObj = parseLocalDate(weight.date);
              // If invalid date, try other formats
              if (isNaN(dateObj.getTime())) {
                // Try YYYY-MM-DD format
                const parts = weight.date.split('-');
                if (parts.length === 3) {
                  dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
              }
            } else {
              // Fallback to current date if no date provided
              dateObj = new Date();
            }
            
            // Create a clean weight object without nested properties that might cause issues
            const cleanWeight = {
              id,
              weight: weight.weight,
              createdAt: weight.createdAt,
              updatedAt: weight.updatedAt,
              note: weight.note || '',
              mood: weight.mood || null,
              tags: Array.isArray(weight.tags) ? weight.tags : [],
              date: dateObj,
            };
            
            return cleanWeight;
          });
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

  // Fetch journey settings (start weight, goal date)
  useEffect(() => {
    if (!currentUser) return;
    fetchJourneySettings(currentUser.uid).then(setJourneySettings);
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
        targetWeight: targetWeight ? targetWeight.toString() : '',
        startWeight: '',
        goalDate: '',
        note: weight.note || '',
        mood: weight.mood || null,
        tags: weight.tags || [],
      });
    } else {
      setEditingWeight(null);
      setModalMode('add-weight');
      setFormData({
        date: new Date(),
        weight: '',
        height: height.toString(),
        gender: gender,
        targetWeight: targetWeight ? targetWeight.toString() : '',
        startWeight: '',
        goalDate: '',
        note: '',
        mood: null,
        tags: [],
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
      targetWeight: '',
      gender: gender,
      startWeight: '',
      goalDate: '',
      note: '',
      mood: null,
      tags: [],
    });
  };

  const handleOpenGoalSetup = () => {
    setEditingWeight(null);
    setModalMode('set-journey');
    setFormData({
      date: new Date(),
      weight: '',
      height: height.toString(),
      gender,
      targetWeight: targetWeight ? targetWeight.toString() : '',
      startWeight: journey ? journey.startWeight.toString() : '',
      goalDate: journeySettings.goalDate || '',
    });
    setIsAddModalOpen(true);
  };

  // One-tap logging for today (updates today's entry if it already exists)
  const handleQuickLog = async (value) => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const existing = weights.find((w) => format(w.date, 'yyyy-MM-dd') === todayStr);
      const now = new Date().toISOString();
      if (existing) {
        await updateWeightInDB(currentUser.uid, existing.id, {
          date: todayStr, weight: value, createdAt: existing.createdAt || now, updatedAt: now,
        });
      } else {
        await addWeightToDB(currentUser.uid, { date: todayStr, weight: value, createdAt: now, updatedAt: now });
      }
      setSuccess("Today's weight logged! ⚖️");
    } catch (err) {
      console.error('Error quick logging weight:', err);
      setError('Failed to save weight. Please try again.');
    }
  };

  const handleSaveWeight = async () => {
    let heightValue;

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

    if (modalMode === 'set-journey') {
      const target = parseFloat(formData.targetWeight);
      const start = formData.startWeight === '' ? null : parseFloat(formData.startWeight);
      if (isNaN(target) || target <= 0) {
        setError('Please enter a valid goal weight');
        return;
      }
      if (start !== null && (isNaN(start) || start <= 0)) {
        setError('Please enter a valid starting weight');
        return;
      }
      try {
        const goalDate = formData.goalDate || null;
        await saveJourneySettings(currentUser.uid, {
          targetWeight: target,
          startWeight: start,
          goalDate,
        });
        setTargetWeight(target);
        setJourneySettings((s) => ({ ...s, startWeight: start, goalDate }));
        setSuccess('Journey goal saved! 🎯');
        handleCloseModal();
      } catch (err) {
        console.error('Error saving journey settings:', err);
        setError('Failed to save goal. Please try again.');
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
        date: format(formData.date, 'yyyy-MM-dd'), // Local YYYY-MM-DD (toISOString would shift the day in UTC+ zones)
        weight: weightValue,
        note: formData.note.trim(),
        mood: formData.mood || null,
        tags: formData.tags || [],
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
    const trendMap = buildTrendMap([...weights].sort((a, b) => a.date - b.date));

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
        trend: trendMap[dateStr] ?? null,
      });
    }

    return data;
  }, [weights, selectedDays]);

  const { minWeight, maxWeight } = useMemo(() => {
    if (weights.length === 0) return { minWeight: null, maxWeight: null };
    const ws = weights.map((w) => w.weight);
    return { minWeight: Math.min(...ws), maxWeight: Math.max(...ws) };
  }, [weights]);

  const currentWeight = weights.length > 0 ? weights[0].weight : null;
  const weightChange = weights.length > 1 ? weights[0].weight - weights[1].weight : 0;
  const currentBMI = currentWeight ? calculateBMI(currentWeight, height) : null;
  const bmiCategory = currentBMI ? getBMICategory(currentBMI) : null;
  const idealWeightRange = getIdealWeightRange(height, gender);

  // Journey analytics: use the custom goal, else the BMI-normal ceiling when overweight
  const journeyTarget = targetWeight || (currentBMI && currentBMI >= 25 ? idealWeightRange.max : null);
  const journey = useMemo(
    () => computeJourney(weights, {
      startWeight: journeySettings.startWeight,
      startDate: journeySettings.startDate,
      targetWeight: journeyTarget,
      goalDate: journeySettings.goalDate,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weights, journeySettings, journeyTarget]
  );

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

  // Set default selected month to the most recent month with data
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === format(new Date(), 'yyyy-MM')) {
      // If current month has no data, default to the most recent month with data
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter weights by selected month
  const filteredWeights = useMemo(() => {
    if (selectedMonth === 'all') {
      return weights;
    }
    const filtered = weights.filter(weight =>
      format(weight.date, 'yyyy-MM') === selectedMonth
    );
    return filtered;
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
          {data.trend != null && (
            <Typography variant="body2" sx={{ color: '#ff7043' }}>
              7-day avg: {data.trend} kg
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  // Enhanced image sharing with better error handling and user feedback
  const handleShareImage = async () => {
    try {
      setIsSharing(true);
      setShareProgress('Capturing chart...');

      // Get the chart container reference for image generation
      const chartContainer = trendChartRef.current?.querySelector('.recharts-wrapper');
      if (!chartContainer) {
        throw new Error('Chart not found. Please try again.');
      }

      setShareProgress('Generating image...');

      // Use html2canvas to capture the chart
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(chartContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
        width: chartContainer.scrollWidth,
        height: chartContainer.scrollHeight,
      });

      setShareProgress('Converting to image format...');

      // Convert canvas to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png', 0.95);
      });

      if (!blob) {
        throw new Error('Failed to generate image blob');
      }

      const filename = `weight_chart_${format(new Date(), 'yyyy-MM-dd')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      // Check if Web Share API is available and supports file sharing
      if (navigator.share && navigator.canShare) {
        try {
          setShareProgress('Sharing via Web Share API...');
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Weight Tracker Chart',
              text: 'Check out my weight progress chart!',
              files: [file]
            });

            setSuccess('Chart shared successfully! 📱');
            return;
          }
        } catch (shareError) {
          setShareProgress('Web Share API not available, downloading instead...');
        }
      }

      // Fallback to download if Web Share API is not available or fails
      setShareProgress('Downloading image...');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      
      setSuccess('Chart downloaded successfully! 📱');

    } catch (error) {
      console.error('Error sharing image:', error);
      setError(`Failed to share chart image: ${error.message}`);
    } finally {
      setIsSharing(false);
      setShareProgress('');
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
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                  {journey && journey.remaining != null ? `${journey.remaining.toFixed(1)} kg` : '--'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  To goal
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {journey && journey.target != null ? `Goal: ${journey.target.toFixed(1)} kg` : 'Set a goal'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Chart Section */}
      <Box sx={{ p: isMobile ? 2 : 3, pt: 3 }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="fullWidth"
          sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: 2, position: 'sticky', top: 0, zIndex: 10, boxShadow: 1 }}
        >
          <Tab label="Today" />
          <Tab label="Progress" />
          <Tab label="History" />
        </Tabs>
        {tab === 0 && (
          <>
        <WeightJourney
          journey={journey}
          onQuickLog={handleQuickLog}
          onEditGoal={handleOpenGoalSetup}
        />
        {!journey && !loading && (
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>🏁 Start your journey</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set your goal weight and log your first weigh-in to unlock progress, pace and milestones.
              </Typography>
              <Button variant="contained" onClick={handleOpenGoalSetup}>Set my goal</Button>
            </CardContent>
          </Card>
        )}
        <WeightHabits uid={currentUser?.uid} daily={daily} />
        <WeightCoach weights={weights} journey={journey} daily={daily} measurements={measurements} height={height} gender={gender} />
          </>
        )}
        {tab === 1 && (
          <>
        <ProgressHero journey={journey} />
        <GoalPathChart weights={weights} journey={journey} />
        <WeightBadges journey={journey} measurements={measurements} />
        <WeightWhatIf journey={journey} />
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
                    const days = isMobile ? [7, 14, 30] : [7, 30, 60, 90, 120, 365];
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

            {/* Mobile-optimized Quick Filter Buttons */}
            {weights.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {isMobile ? (
                  <>
                    <Chip
                      label="7 Days"
                      size="small"
                      onClick={() => setSelectedDays(7)}
                      variant={selectedDays === 7 ? 'filled' : 'outlined'}
                      color="primary"
                    />
                    <Chip
                      label="14 Days"
                      size="small"
                      onClick={() => setSelectedDays(14)}
                      variant={selectedDays === 14 ? 'filled' : 'outlined'}
                      color="primary"
                    />
                    <Chip
                      label="30 Days"
                      size="small"
                      onClick={() => setSelectedDays(30)}
                      variant={selectedDays === 30 ? 'filled' : 'outlined'}
                      color="primary"
                    />
                    <Chip
                      label="60 Days"
                      size="small"
                      onClick={() => setSelectedDays(60)}
                      variant={selectedDays === 60 ? 'filled' : 'outlined'}
                      color="primary"
                    />
                    <Chip
                      label="90 Days"
                      size="small"
                      onClick={() => setSelectedDays(90)}
                      variant={selectedDays === 90 ? 'filled' : 'outlined'}
                      color="primary"
                    />
                    <Chip
                      label="120 Days"
                      size="small"
                      onClick={() => setSelectedDays(120)}
                      variant={selectedDays === 120 ? 'filled' : 'outlined'}
                      color="primary"
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </Box>
            )}

            {loading ? (
              <Box sx={{ height: isMobile ? 250 : 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinearProgress sx={{ width: '100%' }} />
              </Box>
            ) : (
              <Box ref={trendChartRef} sx={{
                height: isMobile ? 250 : 300,
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                '& .recharts-wrapper': {
                  margin: '0 auto',
                },
                // Enhanced scrollbar styling for better horizontal scrolling
                '&::-webkit-scrollbar': {
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'grey.100',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'grey.400',
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: 'grey.600',
                  },
                },
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis
                      dataKey="date"
                      stroke={theme.palette.text.secondary}
                      fontSize={isMobile ? 10 : 12}
                      interval={isMobile ? 'preserveStart' : 0}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 60 : 50}
                      // Enhanced tick styling for better readability
                      tick={{ fill: theme.palette.text.secondary, fontSize: isMobile ? 10 : 12 }}
                      tickLine={{ stroke: theme.palette.divider }}
                      axisLine={{ stroke: theme.palette.divider }}
                    />
                    <YAxis
                      stroke={theme.palette.text.secondary}
                      fontSize={isMobile ? 10 : 12}
                      domain={([min, max]) => {
                        const lo = journeyTarget ? Math.min(min, journeyTarget) : min;
                        return [Math.floor(lo - 1), Math.ceil(max + 1)];
                      }}
                      width={isMobile ? 40 : 60}
                      // Enhanced Y-axis styling
                      tick={{ fill: theme.palette.text.secondary, fontSize: isMobile ? 10 : 12 }}
                      tickLine={{ stroke: theme.palette.divider }}
                      axisLine={{ stroke: theme.palette.divider }}
                    />
                    <RechartsTooltip 
                      content={CustomTooltip} 
                      // Enhanced tooltip styling
                      cursor={{ stroke: '#667eea', strokeWidth: 2, strokeDasharray: '3 3' }}
                    />

                    {/* BMI Zone lines */}
                    <ReferenceLine
                      y={idealWeightRange.min}
                      stroke="#e91e63"
                      strokeDasharray="3 3"
                      label={{ value: "Underweight", position: "topLeft", fontSize: isMobile ? 8 : 10 }}
                    />
                    <ReferenceLine
                      y={idealWeightRange.max}
                      stroke="#4caf50"
                      strokeDasharray="3 3"
                      label={{ value: "Normal", position: "topLeft", fontSize: isMobile ? 8 : 10 }}
                    />
                    <ReferenceLine
                      y={idealWeightRange.max + ((idealWeightRange.max - idealWeightRange.min) * 0.2)}
                      stroke="#ff9800"
                      strokeDasharray="3 3"
                      label={{ value: "Overweight", position: "topLeft", fontSize: isMobile ? 8 : 10 }}
                    />

                    {/* Target weight line */}
                    {targetWeight ? (
                      <ReferenceLine
                        y={targetWeight}
                        stroke="#2196f3"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{ value: `Target`, position: "topRight", fontSize: isMobile ? 9 : 11, fill: "#2196f3" }}
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
                          fontSize: isMobile ? 9 : 11,
                          fill: "#2196f3"
                        }}
                      />
                    )}

                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#667eea"
                      strokeWidth={isMobile ? 2 : 3}
                      dot={{ fill: '#667eea', strokeWidth: isMobile ? 1 : 2, r: isMobile ? 3 : 4 }}
                      activeDot={{ r: isMobile ? 4 : 6, stroke: '#667eea', strokeWidth: isMobile ? 1 : 2 }}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="trend"
                      name="7-day trend"
                      stroke="#ff7043"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={false}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              <span style={{ color: '#667eea' }}>●</span> Daily weight &nbsp;
              <span style={{ color: '#ff7043' }}>┅</span> 7-day average (the real trend)
            </Typography>

            {/* BMI Categories Legend - Mobile optimized */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 0.5 : 1, mt: 2, justifyContent: 'center' }}>
              <Chip
                label="Underweight: <18.5"
                sx={{ bgcolor: '#e91e63', color: 'white', fontSize: isMobile ? '0.65rem' : '0.75rem' }}
                size={isMobile ? 'small' : 'small'}
              />
              <Chip
                label="Normal: 18.5-25"
                sx={{ bgcolor: '#4caf50', color: 'white', fontSize: isMobile ? '0.65rem' : '0.75rem' }}
                size={isMobile ? 'small' : 'small'}
              />
              <Chip
                label="Overweight: 25-30"
                sx={{ bgcolor: '#ff9800', color: 'white', fontSize: isMobile ? '0.65rem' : '0.75rem' }}
                size={isMobile ? 'small' : 'small'}
              />
              <Chip
                label="Obese: >30"
                sx={{ bgcolor: '#f44336', color: 'white', fontSize: isMobile ? '0.65rem' : '0.75rem' }}
                size={isMobile ? 'small' : 'small'}
              />
            </Box>
          </CardContent>
        </Card>

        <WeeklyChangeChart journey={journey} />
        <StepsChart daily={daily} />
        <MeasurementChart measurements={measurements} />
        <WeightMeasurements uid={currentUser?.uid} measurements={measurements} />
          </>
        )}

        {tab === 2 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Weight Records
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
                {isMobile ? (
                  // Mobile Card View
                  <Grid container spacing={2}>
                    {filteredWeights.slice(0, visibleCount).map((weight) => {
                      const bmi = calculateBMI(weight.weight, height);
                      const bmiCategory = getBMICategory(bmi);

                      // Find the index in the full weights array for status calculation
                      const fullIndex = weights.findIndex(w => w.id === weight.id);
                      const prevWeight = weights[fullIndex + 1]?.weight;
                      const change = prevWeight ? weight.weight - prevWeight : null;

                      // Calculate status indicators based on full dataset
                      const isLowest = weights.length > 1 && weight.weight === minWeight;
                      const isHighest = weights.length > 1 && weight.weight === maxWeight;



                      // Determine status chips (only Lowest and Highest)
                      const statusChips = [];
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

                      return (
                        <Grid item xs={12} key={weight.id}>
                          <Card 
                            sx={{ 
                              p: 2,
                              '&:hover': { bgcolor: 'grey.50' },
                              bgcolor: fullIndex === 0 ? 'rgba(76, 175, 80, 0.08)' : 'inherit'
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 'medium', fontSize: '0.9rem' }}>
                                  {format(weight.date, 'MMM dd, yyyy')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                  {format(weight.date, 'EEEE')}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                                  {weight.weight} kg
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 'bold',
                                      color: bmiCategory.color,
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    BMI: {bmi.toFixed(1)}
                                  </Typography>
                                  <Chip
                                    label={bmiCategory.category}
                                    size="small"
                                    sx={{
                                      bgcolor: bmiCategory.color,
                                      color: 'white',
                                      fontSize: '0.6rem',
                                      height: 16
                                    }}
                                  />
                                </Box>
                              </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Box>
                                {change !== null && (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 'bold',
                                      color: change > 0 ? '#f44336' : change < 0 ? '#4caf50' : 'text.secondary',
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    {change > 0 ? '▲ ' : '▼ '}{Math.abs(change).toFixed(1)} kg
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {statusChips}
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                {weight.mood && <span>{MOODS.find((m) => m.value === weight.mood)?.emoji} </span>}
                                {weight.note && (
                                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                    {weight.note}
                                  </Typography>
                                )}
                                {weight.tags.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                    {weight.tags.map((t) => <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />)}
                                  </Box>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenAddModal(weight)}
                                  sx={{ color: 'primary.main', p: 0.5 }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => setConfirmDeleteWeight(weight)}
                                  sx={{ color: 'error.main', p: 0.5 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                ) : (
                  // Desktop Table View
                  <Table sx={{ minWidth: 500 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">Weight</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">BMI</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">Change</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} >Notes</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredWeights.slice(0, visibleCount).map((weight) => {
                        const bmi = calculateBMI(weight.weight, height);
                        const bmiCategory = getBMICategory(bmi);

                        // Find the index in the full weights array for status calculation
                        const fullIndex = weights.findIndex(w => w.id === weight.id);
                        const prevWeight = weights[fullIndex + 1]?.weight;
                        const change = prevWeight ? weight.weight - prevWeight : null;

                        // Calculate status indicators based on full dataset
                        const isLowest = weights.length > 1 && weight.weight === minWeight;
                        const isHighest = weights.length > 1 && weight.weight === maxWeight;



                        // Determine status chips (only Lowest and Highest)
                        const statusChips = [];
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
                            <TableCell sx={{ maxWidth: 260 }}>
                              {weight.mood && <span>{MOODS.find((m) => m.value === weight.mood)?.emoji} </span>}
                              {weight.note && (
                                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                  {weight.note}
                                </Typography>
                              )}
                              {weight.tags.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                  {weight.tags.map((t) => <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />)}
                                </Box>
                              )}
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
                )}
              </Box>
            )}
            {filteredWeights.length > visibleCount && (
              <Button fullWidth sx={{ mt: 2 }} onClick={() => setVisibleCount((n) => n + 20)}>
                Show more ({filteredWeights.length - visibleCount} older)
              </Button>
            )}
          </CardContent>
        </Card>
        )}

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
                  value="set-journey"
                  control={<Radio />}
                  label="🏁 Set Journey Goal (start, goal, date)"
                />
                <FormControlLabel
                  value="set-height"
                  control={<Radio />}
                  label="📏 Set Height"
                />
                <FormControlLabel
                  value="set-gender"
                  control={<Radio />}
                  label="👤 Set Gender"
                />
              </RadioGroup>
            </FormControl>
          )}

          {modalMode === 'set-journey' && !editingWeight ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label="🎯 Goal Weight (kg)"
                type="number"
                value={formData.targetWeight}
                onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                InputProps={{ inputProps: { min: 0, step: 0.1 } }}
              />
              <TextField
                fullWidth
                label="🚩 Starting Weight (kg)"
                type="number"
                value={formData.startWeight}
                onChange={(e) => setFormData({ ...formData, startWeight: e.target.value })}
                InputProps={{ inputProps: { min: 0, step: 0.1 } }}
                helperText="Leave blank to use your first logged weight"
              />
              <TextField
                fullWidth
                label="📅 Goal Date (optional)"
                type="date"
                value={formData.goalDate}
                onChange={(e) => setFormData({ ...formData, goalDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText="Used to show the weekly pace you need to hit"
              />
            </Box>
          ) : modalMode === 'set-gender' ? (
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

              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>How are you feeling?</Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={formData.mood}
                onChange={(e, v) => setFormData({ ...formData, mood: v })}
                sx={{ mb: 2, flexWrap: 'wrap' }}
              >
                {MOODS.map((m) => (
                  <ToggleButton key={m.value} value={m.value} aria-label={m.label} sx={{ px: 1.5 }}>
                    {m.emoji}&nbsp;{m.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                {NOTE_TAGS.map((t) => {
                  const on = formData.tags.includes(t);
                  return (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      color={on ? 'primary' : 'default'}
                      variant={on ? 'filled' : 'outlined'}
                      onClick={() => setFormData({
                        ...formData,
                        tags: on ? formData.tags.filter((x) => x !== t) : [...formData.tags, t],
                      })}
                    />
                  );
                })}
              </Box>

              <TextField
                fullWidth
                multiline
                minRows={2}
                label="📝 Note (optional)"
                placeholder="Sleep, workout, stress, anything worth remembering"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                inputProps={{ maxLength: 280 }}
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
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSaveWeight}
            variant="contained"
            disabled={
              modalMode === 'add-weight' || editingWeight
                ? (!formData.weight || !formData.date)
                : modalMode === 'set-journey'
                ? !formData.targetWeight
                : modalMode === 'set-height'
                ? !formData.height
                : modalMode === 'set-gender'
                ? !formData.gender
                : false
            }
          >
            {modalMode === 'add-weight' || editingWeight
              ? (editingWeight ? 'Update Weight' : 'Add Weight')
              : modalMode === 'set-journey'
              ? 'Save Goal'
              : modalMode === 'set-height'
              ? 'Set Height'
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
            minWidth: 200,
          }
        }}
        disableScrollLock={true}
      >
        <MenuItem
          onClick={async () => {
            setShareMenuAnchor(null);
            try {
              // Get the chart container reference for PDF
              // The chart is inside a ResponsiveContainer, so we need to find the actual chart wrapper
              const chartContainer = trendChartRef.current?.querySelector('.recharts-wrapper');
              const { generateWeightReport } = await import('../utils/weightReport');
              const doc = await generateWeightReport({
                weights,
                journey,
                measurements,
                daily,
                height,
                gender,
                selectedDays,
                idealRange: idealWeightRange,
                chartEl: chartContainer,
              });
              const fileName = `weight_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
              setPdfPreview({ doc, fileName });
            } catch (error) {
              console.error('Error generating PDF:', error);
              setError('Failed to generate PDF report. Please try again.');
            }
          }}
          disabled={isSharing}
        >
          <ListItemIcon>
            <PdfIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Preview PDF" 
            secondary={isSharing && shareProgress.includes('PDF') ? shareProgress : ''}
          />
          {isSharing && shareProgress.includes('PDF') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setShareMenuAnchor(null);
            const blob = new Blob([buildCsv(weights, daily)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `weight_data_${format(new Date(), 'yyyy-MM-dd')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setSuccess('Data exported as CSV 📄');
          }}
        >
          <ListItemText primary="Export CSV" />
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setShareMenuAnchor(null);
            await handleShareImage();
          }}
          disabled={isSharing}
        >
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary="Share Image" 
            secondary={isSharing && shareProgress.includes('image') ? shareProgress : ''}
          />
          {isSharing && shareProgress.includes('image') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}
        </MenuItem>
      </Menu>

      {/* Loading Overlay for Sharing */}
      {isSharing && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(2px)',
          }}
        >
          <Card sx={{ p: 3, textAlign: 'center', maxWidth: 400 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              {shareProgress || 'Processing...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we prepare your {shareProgress.includes('PDF') ? 'PDF report' : 'chart image'}.
            </Typography>
          </Card>
        </Box>
      )}

      {/* Success/Error Snackbars */}
      {/* Preview the weight report before it is downloaded or shared */}
      <PdfPreviewDialog
        doc={pdfPreview?.doc}
        fileName={pdfPreview?.fileName}
        title="Weight Tracker Report"
        shareText="Check out my weight progress report!"
        onClose={() => setPdfPreview(null)}
        onDone={(msg) => setSuccess(msg)}
        onError={(msg) => setError(msg)}
      />

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