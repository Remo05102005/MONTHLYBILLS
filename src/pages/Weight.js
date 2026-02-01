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
  Drawer,
  CircularProgress,
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
  Restaurant as RestaurantIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, isSameDay, parseISO, isAfter, startOfDay, subDays } from 'date-fns';
import html2canvas from 'html2canvas';
import { useAuth } from '../contexts/AuthContext';
import { 
  addWeightToDB, 
  updateWeightInDB, 
  deleteWeightFromDB, 
  subscribeToWeights,
  fetchLast30DaysWeights,
  fetchHeight,
  saveHeight,
  fetchTargetWeight,
  saveTargetWeight,
  fetchGender,
  saveGender,
  addFoodToWeightRecord,
  updateFoodInWeightRecord,
  deleteFoodFromWeightRecord,
  subscribeToFoodInWeightRecord
} from '../firebase/weight';
import { addFoodIntakeToDB, updateFoodIntakeInDB, deleteFoodIntakeFromDB, subscribeToFoodIntake } from '../firebase/food';
import { generateWeightReport, generateWeightImage } from '../utils/pdfGenerator';
import FoodIntakeModal from '../components/FoodIntakeModal';
import FoodIntakeList from '../components/FoodIntakeList';

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

  // Food Intake State
  const [foodIntakeData, setFoodIntakeData] = useState([]);
  const [foodIntakeLoading, setFoodIntakeLoading] = useState(false);
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [editingFoodEntry, setEditingFoodEntry] = useState(null);
  const [confirmDeleteFood, setConfirmDeleteFood] = useState(null);
  const [isFoodListOpen, setIsFoodListOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState('');

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
        console.log('Weight data received:', data);
        if (data) {
          const weightsArray = Object.entries(data).map(([id, weight]) => {
            console.log('Processing weight entry:', { id, weight });
            // Try to parse date in different formats
            let dateObj;
            if (weight.date) {
              // Try ISO string format first
              dateObj = new Date(weight.date);
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
            
            console.log('Parsed date:', dateObj, 'for weight date:', weight.date);
            
            // Create a clean weight object without nested properties that might cause issues
            const cleanWeight = {
              id,
              weight: weight.weight,
              createdAt: weight.createdAt,
              updatedAt: weight.updatedAt,
              date: dateObj,
            };
            
            console.log('Clean weight object:', cleanWeight);
            
            return cleanWeight;
          });
          console.log('Processed weights array:', weightsArray);
          weightsArray.sort((a, b) => b.date - a.date); // Most recent first
          console.log('Setting weights state, length:', weightsArray.length);
          setWeights(weightsArray);
        } else {
          console.log('No weight data received');
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

  // Food Intake Subscription for Weight Records
  useEffect(() => {
    if (currentUser && weights.length > 0) {
      // Subscribe to food intake for the selected weight record
      const weightToSubscribe = editingWeight || weights[0];
      const unsubscribe = subscribeToFoodInWeightRecord(currentUser.uid, weightToSubscribe.id, (data) => {
        setFoodIntakeData(data);
        setFoodIntakeLoading(false);
      });

      return () => unsubscribe();
    }
  }, [currentUser, weights, editingWeight]);

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

  // Food Intake Handlers
  const handleOpenFoodModal = (foodEntry = null) => {
    setEditingFoodEntry(foodEntry);
    setIsFoodModalOpen(true);
  };

  const handleCloseFoodModal = () => {
    setIsFoodModalOpen(false);
    setEditingFoodEntry(null);
  };

  const handleSaveFoodIntake = async (foodData) => {
    try {
      if (!weights.length) {
        setError('Please add a weight entry first before adding food intake.');
        return;
      }

      const latestWeight = weights[0];
      
      if (editingFoodEntry) {
        await updateFoodInWeightRecord(currentUser.uid, latestWeight.id, editingFoodEntry.id, foodData);
        setSuccess('Food entry updated successfully! 🍎');
      } else {
        await addFoodToWeightRecord(currentUser.uid, latestWeight.id, foodData);
        setSuccess('Food entry added successfully! 🍎');
      }
      handleCloseFoodModal();
    } catch (err) {
      console.error('Error saving food intake:', err);
      setError('Failed to save food entry. Please try again.');
    }
  };

  const handleDeleteFoodIntake = async (foodEntryId) => {
    try {
      if (!weights.length) {
        setError('No weight entries found. Cannot delete food entry.');
        return;
      }

      const latestWeight = weights[0];
      await deleteFoodFromWeightRecord(currentUser.uid, latestWeight.id, foodEntryId);
      setSuccess('Food entry deleted successfully! 🗑️');
    } catch (err) {
      console.error('Error deleting food intake:', err);
      setError('Failed to delete food entry. Please try again.');
    }
  };

  const handleConfirmDeleteFood = async () => {
    if (confirmDeleteFood) {
      await handleDeleteFoodIntake(confirmDeleteFood.id);
      setConfirmDeleteFood(null);
    }
  };

  const handleCancelDeleteFood = () => {
    setConfirmDeleteFood(null);
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

  // Set default selected month to the most recent month with data
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === format(new Date(), 'yyyy-MM')) {
      // If current month has no data, default to the most recent month with data
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter weights by selected month
  const filteredWeights = useMemo(() => {
    console.log('Filtering weights:', { weights, selectedMonth });
    if (selectedMonth === 'all') {
      console.log('Returning all weights:', weights);
      return weights;
    }
    const filtered = weights.filter(weight =>
      format(weight.date, 'yyyy-MM') === selectedMonth
    );
    console.log('Filtered weights for month:', selectedMonth, filtered);
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
        </Box>
      );
    }
    return null;
  };

  // Enhanced share functionality with better error handling and user feedback
  const handleShareReport = async (reportData, fileName) => {
    try {
      setIsSharing(true);
      setShareProgress('Preparing PDF...');

      // Check if Web Share API is available (mobile devices)
      if (navigator.share && navigator.canShare) {
        try {
          setShareProgress('Converting to shareable format...');
          
          // Convert PDF to blob for sharing
          const pdfBlob = reportData.output('blob');

          // Create a File object for sharing
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

          // Check if we can share this file
          if (navigator.canShare({ files: [file] })) {
            setShareProgress('Sharing via Web Share API...');
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
          setShareProgress('Web Share API not available, downloading instead...');
        }
      }

      // Fallback to download if Web Share API is not available or fails
      setShareProgress('Downloading PDF...');
      reportData.save(fileName);
      setSuccess('Report downloaded successfully! 📱');

    } catch (err) {
      console.error('Share error:', err);
      setError(`Failed to share report: ${err.message}`);
    } finally {
      setIsSharing(false);
      setShareProgress('');
    }
  };

  // Enhanced image sharing with better error handling and user feedback
  const handleShareImage = async () => {
    try {
      setIsSharing(true);
      setShareProgress('Capturing chart...');

      // Get the chart container reference for image generation
      const chartContainer = document.querySelector('.recharts-wrapper');
      if (!chartContainer) {
        throw new Error('Chart not found. Please try again.');
      }

      setShareProgress('Generating image...');

      // Use html2canvas to capture the chart
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
          console.log('Web Share API failed for image, falling back to download:', shareError);
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
                    const days = isMobile ? [7, 14, 30] : [7, 30, 60, 90, 120, 365];
                    const currentIndex = days.indexOf(selectedDays);
                    const nextIndex = (currentIndex + 1) % days.length;
                    setSelectedDays(days[nextIndex]);
                  }}
                  sx={{ cursor: 'pointer', bgcolor: 'primary.light', color: 'white' }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Chart"}>
                  <IconButton
                    size="small"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    sx={{ 
                      color: 'text.secondary',
                      bgcolor: isFullscreen ? 'primary.light' : 'transparent',
                      '&:hover': {
                        bgcolor: isFullscreen ? 'primary.main' : 'grey.200',
                        color: isFullscreen ? 'white' : 'text.primary'
                      }
                    }}
                  >
                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Tooltip>
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
              <Box sx={{
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
                      domain={['dataMin - 2', 'dataMax + 2']}
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
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}

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

        {/* Recent Entries */}
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
                    {filteredWeights.map((weight, filteredIndex) => {
                      const bmi = calculateBMI(weight.weight, height);
                      const bmiCategory = getBMICategory(bmi);

                      // Find the index in the full weights array for status calculation
                      const fullIndex = weights.findIndex(w => w.id === weight.id);
                      const prevWeight = weights[fullIndex + 1]?.weight;
                      const change = prevWeight ? weight.weight - prevWeight : null;

                      // Calculate status indicators based on full dataset
                      const isLatest = fullIndex === 0;
                      const isLowest = weights.length > 1 && weight.weight === Math.min(...weights.map(w => w.weight));
                      const isHighest = weights.length > 1 && weight.weight === Math.max(...weights.map(w => w.weight));

                      // Check for local peaks (higher than both neighbors in full dataset)
                      const isPeak = weights.length > 2 &&
                        fullIndex > 0 && fullIndex < weights.length - 1 &&
                        weight.weight > prevWeight && weight.weight > weights[fullIndex - 1]?.weight;

                      // Check for local valleys (lower than both neighbors in full dataset)
                      const isValley = weights.length > 2 &&
                        fullIndex > 0 && fullIndex < weights.length - 1 &&
                        weight.weight < prevWeight && weight.weight < weights[fullIndex - 1]?.weight;

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
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                  setEditingWeight(weight);
                                  setIsFoodListOpen(true);
                                }}
                                sx={{ 
                                  borderColor: 'primary.main',
                                  color: 'primary.main',
                                  fontSize: '0.75rem',
                                  '&:hover': {
                                    borderColor: 'primary.dark',
                                    backgroundColor: 'primary.light',
                                    color: 'white'
                                  }
                                }}
                              >
                                🍽️ View Food
                              </Button>
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
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">Food</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} align="center">Actions</TableCell>
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
                            <TableCell align="center">
                              <Tooltip title="View/Edit Food Intake">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    // Set the current weight as the context for food tracking
                                    // This will show food entries for this specific weight record
                                    setEditingWeight(weight);
                                    setIsFoodListOpen(true);
                                  }}
                                  sx={{ 
                                    borderColor: 'primary.main',
                                    color: 'primary.main',
                                    '&:hover': {
                                      borderColor: 'primary.dark',
                                      backgroundColor: 'primary.light',
                                      color: 'white'
                                    }
                                  }}
                                >
                                  🍽️ View Food
                                </Button>
                              </Tooltip>
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

      {/* Food Intake Modal */}
      <FoodIntakeModal
        open={isFoodModalOpen}
        onClose={handleCloseFoodModal}
        onSave={handleSaveFoodIntake}
        initialData={editingFoodEntry}
        isLoading={foodIntakeLoading}
        date={editingWeight ? format(subDays(editingWeight.date, 1), 'yyyy-MM-dd') : format(subDays(new Date(), 1), 'yyyy-MM-dd')}
      />

      {/* Delete Food Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDeleteFood)}
        onClose={handleCancelDeleteFood}
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
          🗑️ Confirm Delete Food Entry
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this food entry?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={handleCancelDeleteFood}>Cancel</Button>
          <Button
            onClick={handleConfirmDeleteFood}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Fullscreen Chart Dialog */}
      <Dialog
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
        disableScrollLock={true}
        disableEnforceFocus={true}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        PaperProps={{
          sx: { 
            borderRadius: 0,
            backgroundColor: 'white',
            height: '100vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              📈 Fullscreen Weight Chart
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
            <Tooltip title="Exit Fullscreen">
              <IconButton
                size="small"
                onClick={() => setIsFullscreen(false)}
                sx={{ color: 'text.secondary' }}
              >
                <FullscreenExitIcon />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={(event) => setShareMenuAnchor(event.currentTarget)}
              sx={{ color: 'text.secondary' }}
            >
              <ShareIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3, overflow: 'hidden' }}>
          <Box sx={{ 
            height: isMobile ? 400 : 500,
            width: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            backgroundColor: 'white',
            // Enhanced scrollbar styling for fullscreen mode
            '&::-webkit-scrollbar': {
              height: '12px',
              width: '12px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'grey.100',
              borderRadius: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'grey.500',
              borderRadius: '6px',
              border: '2px solid white',
              '&:hover': {
                backgroundColor: 'grey.700',
              },
            },
            // Add subtle shadow to indicate scrollable content
            '&::after': {
              content: '""',
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '20px',
              background: 'linear-gradient(to left, rgba(0,0,0,0.1), transparent)',
              pointerEvents: 'none',
              opacity: 0,
              transition: 'opacity 0.3s ease',
            },
            '&:hover::after': {
              opacity: 1,
            }
          }}>
            <ResponsiveContainer width={chartData.length * 60} height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  fontSize={isMobile ? 12 : 14}
                  interval={0} // Show all ticks for detailed view
                  angle={isMobile ? -45 : -30}
                  textAnchor={isMobile ? 'end' : 'middle'}
                  height={isMobile ? 80 : 70}
                  tick={{ fill: '#666', fontSize: isMobile ? 10 : 12 }}
                  tickLine={{ stroke: '#e0e0e0' }}
                  axisLine={{ stroke: '#e0e0e0' }}
                />
                <YAxis
                  stroke="#666"
                  fontSize={isMobile ? 12 : 14}
                  domain={['dataMin - 2', 'dataMax + 2']}
                  width={isMobile ? 60 : 80}
                  tick={{ fill: '#666', fontSize: isMobile ? 10 : 12 }}
                  tickLine={{ stroke: '#e0e0e0' }}
                  axisLine={{ stroke: '#e0e0e0' }}
                />
                <RechartsTooltip 
                  content={CustomTooltip} 
                  cursor={{ stroke: '#667eea', strokeWidth: 3, strokeDasharray: '5 5' }}
                  wrapperStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />

                {/* BMI Zone lines */}
                <ReferenceLine
                  y={idealWeightRange.min}
                  stroke="#e91e63"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{ value: "Underweight", position: "topLeft", fontSize: isMobile ? 10 : 12 }}
                />
                <ReferenceLine
                  y={idealWeightRange.max}
                  stroke="#4caf50"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{ value: "Normal", position: "topLeft", fontSize: isMobile ? 10 : 12 }}
                />
                <ReferenceLine
                  y={idealWeightRange.max + ((idealWeightRange.max - idealWeightRange.min) * 0.2)}
                  stroke="#ff9800"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{ value: "Overweight", position: "topLeft", fontSize: isMobile ? 10 : 12 }}
                />

                {/* Target weight line */}
                {targetWeight ? (
                  <ReferenceLine
                    y={targetWeight}
                    stroke="#2196f3"
                    strokeWidth={3}
                    strokeDasharray="8 8"
                    label={{ value: `Target`, position: "topRight", fontSize: isMobile ? 12 : 14, fill: "#2196f3" }}
                  />
                ) : currentBMI && (
                  <ReferenceLine
                    y={currentBMI < 18.5 ? idealWeightRange.min : idealWeightRange.max}
                    stroke="#2196f3"
                    strokeWidth={3}
                    strokeDasharray="8 8"
                    label={{
                      value: `BMI Target: ${currentBMI < 18.5 ? idealWeightRange.min.toFixed(1) : idealWeightRange.max.toFixed(1)}kg`,
                      position: "topRight",
                      fontSize: isMobile ? 12 : 14,
                      fill: "#2196f3"
                    }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#667eea"
                  strokeWidth={isMobile ? 3 : 4}
                  dot={{ fill: '#667eea', strokeWidth: isMobile ? 1 : 2, r: isMobile ? 4 : 5 }}
                  activeDot={{ r: isMobile ? 5 : 7, stroke: '#667eea', strokeWidth: isMobile ? 1 : 2 }}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </DialogContent>
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
              const chartContainer = document.querySelector('.recharts-wrapper');
              const doc = await generateWeightReport(weights, selectedDays, idealWeightRange.min, chartContainer ? { current: chartContainer } : null);
              const fileName = `weight_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
              await handleShareReport(doc, fileName);
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
            primary="Share PDF" 
            secondary={isSharing && shareProgress.includes('PDF') ? shareProgress : ''}
          />
          {isSharing && shareProgress.includes('PDF') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}
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

      {/* Food List Modal */}
      <Dialog
        open={isFoodListOpen}
        onClose={() => setIsFoodListOpen(false)}
        maxWidth="md"
        fullWidth
        disableScrollLock={true}
        disableEnforceFocus={true}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogContent>
          <FoodIntakeList
            foodIntakeData={foodIntakeData}
            isLoading={foodIntakeLoading}
            date={editingWeight ? format(subDays(editingWeight.date, 1), 'yyyy-MM-dd') : format(subDays(new Date(), 1), 'yyyy-MM-dd')}
            onAdd={() => handleOpenFoodModal()}
            onEdit={(entry) => handleOpenFoodModal(entry)}
            onDelete={(entryId) => setConfirmDeleteFood({ id: entryId })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setIsFoodListOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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