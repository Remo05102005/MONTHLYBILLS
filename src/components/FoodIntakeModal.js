import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Typography,
  Chip,
  Autocomplete,
  CircularProgress,
  Alert,
  LinearProgress
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { format } from 'date-fns';
import { useTheme, useMediaQuery } from '@mui/material';
import nutrientService from '../services/nutrientService';

const unitOptions = [
  { value: 'pieces', label: 'Pieces' },
  { value: 'pack', label: 'Pack' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'ml', label: 'Milliliters (ml)' }
];

const FoodIntakeModal = ({ 
  open, 
  onClose, 
  onSave, 
  initialData = null,
  isLoading = false,
  date // New prop for the date context
}) => {
  const [formData, setFormData] = useState({
    foodItem: '',
    quantity: '',
    unit: 'pieces',
    time: new Date()
  });
  
  const [errors, setErrors] = useState({});
  const [foodSuggestions, setFoodSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'fetching', 'saving', 'completed', ''
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveError, setSaveError] = useState(null);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Edit mode: load existing data
        // Create a new Date object with current date but preserve the time from initialData
        const currentTime = new Date();
        if (initialData.time) {
          const [hours, minutes] = initialData.time.split(':').map(Number);
          currentTime.setHours(hours, minutes, 0, 0);
        }
        
        setFormData({
          foodItem: initialData.foodItem || '',
          quantity: initialData.quantity || '',
          unit: initialData.unit || 'pieces',
          time: currentTime
        });
      } else {
        // Add mode: reset form completely
        setFormData({
          foodItem: '',
          quantity: '',
          unit: 'pieces',
          time: new Date()
        });
        setFoodSuggestions([]);
      }
      setErrors({});
      setSaveError(null);
    }
  }, [open, initialData]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.foodItem || formData.foodItem.trim().length === 0) {
      newErrors.foodItem = 'Food item is required';
    } else if (formData.foodItem.length > 100) {
      newErrors.foodItem = 'Food item must be less than 100 characters';
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Quantity must be a positive number';
    }

    if (!formData.unit) {
      newErrors.unit = 'Unit is required';
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // Get food suggestions when typing food item
    if (field === 'foodItem') {
      getFoodSuggestions(value);
    }
  };

  const getFoodSuggestions = async (input) => {
    if (!input || input.length < 2) {
      setFoodSuggestions([]);
      return;
    }

    setSuggestionsLoading(true);
    try {
      const suggestions = await nutrientService.getFoodSuggestions(input, 15);
      setFoodSuggestions(suggestions);
    } catch (error) {
      console.error('Error getting food suggestions:', error);
      setFoodSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const timeString = format(formData.time, 'HH:mm');
    const foodData = {
      foodItem: formData.foodItem.trim(),
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      time: timeString
    };

    console.log('Starting save process for food data:', foodData);

    // Start save process with stages
    setSaveStatus('fetching');
    setSaveProgress(10);
    setSaveError(null);

    try {
      // Stage 1: Fetch nutrient data using new flow (check foodData → API call → calculate)
      console.log('Stage 1: Fetching nutrient data using new flow...');
      setSaveStatus('fetching');
      setSaveProgress(30);
      const nutrientData = await nutrientService.getNutrientDataForQuantity(
        foodData.foodItem, 
        foodData.quantity, 
        foodData.unit
      );

      console.log('Nutrient data fetched:', nutrientData);
      
      if (nutrientData) {
        console.log('Stage 2: Saving food intake data to weight record...');
        setSaveProgress(60);
        setSaveStatus('saving');
        
        // Stage 2: Save food intake data with calculated nutrients to weight record
        const foodDataWithNutrients = {
          ...foodData,
          nutrients: nutrientData
        };

        console.log('Food data with nutrients:', foodDataWithNutrients);

        setSaveProgress(80);
        setSaveStatus('completed');
        setSaveProgress(100);
        console.log('Stage 3: Processing complete!');

        // Add a small delay to show completion
        setTimeout(() => {
          console.log('Calling onSave with final data:', foodDataWithNutrients);
          onSave(foodDataWithNutrients);
          setSaveStatus('');
          setSaveProgress(0);
        }, 500);
      } else {
        console.log('No nutrient data available for food item');
        // Provide specific feedback about API quota
        setSaveError('Unable to fetch nutrient data. This might be due to API quota limits. Please try again later or add the food item without nutrient tracking.');
        setSaveStatus('');
        setSaveProgress(0);
      }

    } catch (error) {
      console.error('Error during save process:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Provide specific feedback for quota errors
      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        setSaveError('API quota exceeded. Please try again later or add the food item without nutrient tracking.');
      } else {
        setSaveError('Failed to save food intake. Please try again.');
      }
      
      setSaveStatus('');
      setSaveProgress(0);
    }
  };

  const isEditMode = !!initialData;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 3
        }
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight="bold">
            {isEditMode ? 'Edit Food Intake' : 'Add Food Intake'}
          </Typography>
          <Chip 
            label={`Previous Day: ${date ? format(new Date(date), 'MMM dd, yyyy') : format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'MMM dd, yyyy')}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          
          {/* Food Item Input with Enhanced Autocomplete */}
          <Autocomplete
            freeSolo
            options={foodSuggestions.map((option) => option.foodItem)}
            loading={suggestionsLoading}
            value={formData.foodItem}
            onInputChange={(event, newInputValue, reason) => {
              // Only trigger search for user input, not for option selection
              if (reason === 'input') {
                handleInputChange('foodItem', newInputValue);
              }
            }}
            onChange={(event, newValue) => {
              // When user selects from dropdown, update form
              if (newValue) {
                handleInputChange('foodItem', newValue);
              }
            }}
            filterOptions={(options, { inputValue }) => {
              // Custom filtering to improve search results
              if (!inputValue) return [];
              
              const filtered = options.filter(option => 
                option.toLowerCase().includes(inputValue.toLowerCase())
              );
              
              // Sort by relevance: exact match first, then starts with, then contains
              return filtered.sort((a, b) => {
                const aExact = a.toLowerCase() === inputValue.toLowerCase();
                const bExact = b.toLowerCase() === inputValue.toLowerCase();
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                const aStarts = a.toLowerCase().startsWith(inputValue.toLowerCase());
                const bStarts = b.toLowerCase().startsWith(inputValue.toLowerCase());
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                return a.localeCompare(b);
              });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Food Item"
                error={!!errors.foodItem}
                helperText={errors.foodItem}
                placeholder="e.g., Apple, Rice, Chicken"
                disabled={isLoading}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {suggestionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />

          {/* Quantity and Unit Inputs */}
          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              label="Quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              error={!!errors.quantity}
              helperText={errors.quantity}
              disabled={isLoading}
              InputProps={{
                inputProps: { min: 0, step: '0.01' }
              }}
            />
            
            <FormControl fullWidth error={!!errors.unit}>
              <InputLabel>Unit</InputLabel>
              <Select
                value={formData.unit}
                label="Unit"
                onChange={(e) => handleInputChange('unit', e.target.value)}
                disabled={isLoading}
              >
                {unitOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Time Input */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TimePicker
              label="Time Consumed"
              value={formData.time}
              onChange={(newValue) => handleInputChange('time', newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth 
                  error={!!errors.time}
                  helperText={errors.time}
                  disabled={isLoading}
                />
              )}
              ampm={false} // Use 24-hour format for consistency
            />
          </LocalizationProvider>

          {/* Form Tips */}
          <Box sx={{ mt: 1, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Tips:
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              • Enter one food item per entry
              • Use descriptive food names for better tracking
              • Time helps track eating patterns
              • Quantity units help with portion control
            </Typography>
          </Box>

          {/* Save Error Message */}
          {saveError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {saveError}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        padding: 2,
        borderTop: '1px solid #e0e0e0'
      }}>
        <Button 
          onClick={onClose} 
          disabled={isLoading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isLoading || saveStatus === 'fetching' || saveStatus === 'saving'}
          variant="contained"
          color="primary"
        >
          {saveStatus === 'fetching' && 'Fetching Nutrients...'}
          {saveStatus === 'saving' && 'Saving Data...'}
          {saveStatus === 'completed' && 'Completed!'}
          {saveStatus === '' && (isEditMode ? 'Update' : 'Save')}
        </Button>
      </DialogActions>

      {/* Save Process Progress */}
      {(saveStatus === 'fetching' || saveStatus === 'saving' || saveStatus === 'completed') && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography variant="caption" color="textSecondary" gutterBottom>
            {saveStatus === 'fetching' && 'Step 1: Fetching nutrient data from AI... (30%)'}
            {saveStatus === 'saving' && 'Step 2: Saving food intake data... (60%)'}
            {saveStatus === 'completed' && 'Step 3: Processing complete! (100%)'}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={saveProgress} 
            sx={{ mt: 1 }} 
          />
        </Box>
      )}
    </Dialog>
  );
};

export default FoodIntakeModal;
