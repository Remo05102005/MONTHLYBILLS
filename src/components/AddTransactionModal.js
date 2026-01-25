import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Tabs,
  Tab,
  Typography,
  Chip,
  Grid,
  Card,
  CardActionArea,
  Collapse,
  InputAdornment,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Close as CloseIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { removeUndefined } from '../utils/cleanObject';
import { useAuth } from '../contexts/AuthContext';
import { saveCustomSubcategory, getCustomSubcategories, checkSubcategoryExists } from '../firebase/customSubcategories';

const expenseCategories = {
  Milk: [],
  Vegetables: [],
  Fruits: [],
  Groceries: [],
  Chicken: [],
  Eggs: [],
  Petrol: ['Bike', 'Scooty', 'Car'],
  Bills: [
    'Phone Bill',
    'Electricity',
    'Toll Gate',
    'Rent',
    'Gas',
    'Cable',
    'Wife',
    'Children',
    'Medical',
    'Fees',
  ],
  Others: [],
};

const incomeCategories = ['Salary', 'Others'];

const AddTransactionModal = ({ open, onClose, onSave, initialData }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();
  const [transactionType, setTransactionType] = useState('expense');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [otherCategory, setOtherCategory] = useState('');
  const [errors, setErrors] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customSubcategoryInput, setCustomSubcategoryInput] = useState('');
  const [showCustomSubcategoryInput, setShowCustomSubcategoryInput] = useState(false);
  const [isSavingCustomSubcategory, setIsSavingCustomSubcategory] = useState(false);
  const [customSubcategoryError, setCustomSubcategoryError] = useState('');
  const [showOtherTextBox, setShowOtherTextBox] = useState(false);
  const [otherTextValue, setOtherTextValue] = useState('');
  const [otherTextError, setOtherTextError] = useState('');
  const [customSubcategories, setCustomSubcategories] = useState([]);
  const [loadingCustomSubcategories, setLoadingCustomSubcategories] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setTransactionType(initialData.type || 'expense');
        setCategory(initialData.category || '');
        setSubCategory(initialData.subCategory || '');
        setAmount(initialData.amount ? String(initialData.amount) : '');
        setDescription(initialData.description || '');
        setDate(initialData.date ? new Date(initialData.date) : new Date());
        setOtherCategory('');
        setErrors({});
        setShowAdvanced(!!initialData.description);
      } else {
        setTransactionType('expense');
        setCategory('');
        setSubCategory('');
        setAmount('');
        setDescription('');
        setDate(new Date());
        setOtherCategory('');
        setErrors({});
        setShowAdvanced(false);
      }
    }
  }, [open, initialData]);

  // Fetch custom subcategories when category changes
  useEffect(() => {
    const fetchCustomSubcategories = async () => {
      if (category && currentUser) {
        setLoadingCustomSubcategories(true);
        try {
          const subcats = await getCustomSubcategories(currentUser.uid, category);
          setCustomSubcategories(subcats || []);
        } catch (error) {
          console.error('Error fetching custom subcategories:', error);
          setCustomSubcategories([]);
        } finally {
          setLoadingCustomSubcategories(false);
        }
      } else {
        setCustomSubcategories([]);
      }
    };

    fetchCustomSubcategories();
  }, [category, currentUser]);

  const validateForm = () => {
    console.log('=== VALIDATION FUNCTION START ===');
    console.log('Input values:', { category, subCategory, otherCategory, otherTextValue, amount, customSubcategories: customSubcategories.length });
    
    const newErrors = {};
    
    // Check category
    if (!category && !otherCategory) {
      newErrors.category = 'Please select a category';
    }
    
    // Check if category has subcategories and subcategory is required
    const hasPredefinedSubcategories = expenseCategories[category] && expenseCategories[category].length > 0;
    const hasCustomSubcategories = customSubcategories && customSubcategories.length > 0;
    
    console.log('Subcategory requirements:', { hasPredefinedSubcategories, hasCustomSubcategories, category, subCategory });
    
    // For Others category, always require a subcategory (either custom or "Other" with text)
    if (category === 'Others') {
      console.log('=== VALIDATING OTHERS CATEGORY ===');
      if (!subCategory) {
        newErrors.subCategory = 'Please select a subcategory';
        console.log('Error: No subcategory selected');
      } else if (subCategory === 'Other' && !otherTextValue.trim()) {
        newErrors.subCategory = 'Please enter a description for "Other"';
        console.log('Error: "Other" selected but no text provided');
      } else {
        console.log('Others category validation passed');
      }
    } else if ((hasPredefinedSubcategories || hasCustomSubcategories) && !subCategory) {
      newErrors.subCategory = 'Please select a subcategory';
      console.log('Error: Subcategory required for this category');
    }
    
    // Additional check for "Other" subcategory text
    if (category === 'Others' && subCategory === 'Other' && !otherTextValue.trim()) {
      newErrors.subCategory = 'Please enter a description for "Other"';
      console.log('Error: "Other" selected but no text provided (duplicate check)');
    }
    
    // For Others category, only require otherCategory if using "Other" subcategory without text
    // Custom subcategories (like "Auto") don't need additional category specification
    if (category === 'Others' && !otherCategory && subCategory === 'Other' && !otherTextValue.trim()) {
      newErrors.otherCategory = 'Please specify the category';
      console.log('Error: Others category requires category specification when using "Other" subcategory without text');
    }
    
    // Check amount
    if (!amount) {
      newErrors.amount = 'Amount is required';
      console.log('Error: Amount is required');
    } else if (isNaN(amount) || parseFloat(amount) < 0) {
      newErrors.amount = 'Please enter a valid amount (0 or greater)';
      console.log('Error: Invalid amount');
    }
    
    console.log('Final errors:', newErrors);
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('Validation result:', isValid);
    console.log('=== VALIDATION FUNCTION END ===');
    return isValid;
  };

  const handleSave = async () => {
    console.log('=== SAVE BUTTON CLICKED ===');
    console.log('Current State:', {
      transactionType,
      category,
      subCategory,
      amount,
      description,
      date: date.toISOString(),
      otherCategory,
      otherTextValue,
      showOtherTextBox,
      customSubcategories: customSubcategories.length
    });
    
    console.log('=== VALIDATION START ===');
    const isValid = validateForm();
    console.log('Validation result:', isValid);
    
    if (!isValid) {
      console.log('=== VALIDATION FAILED ===');
      console.log('Errors:', errors);
      return;
    }
    
    console.log('=== VALIDATION PASSED ===');
    
    let finalSubCategory = subCategory;
    console.log('Initial subCategory:', subCategory);
    
    // Logic for Others category: create custom subcategory if needed
    if (category === 'Others') {
      console.log('=== PROCESSING OTHERS CATEGORY ===');
      
      // If "Other" is selected and there's text in the text box, use that as the subcategory
      if (subCategory === 'Other' && otherTextValue.trim()) {
        console.log('=== CREATING CUSTOM SUBCATEGORY FROM TEXT ===');
        finalSubCategory = otherTextValue.trim();
        console.log('Text-based subcategory:', finalSubCategory);
        
        // Check if this custom subcategory already exists, if not, create it
        if (currentUser) {
          console.log('=== CHECKING IF SUBCATEGORY EXISTS ===');
          const exists = await checkSubcategoryExists(currentUser.uid, 'Others', finalSubCategory);
          console.log('Subcategory exists:', exists);
          
          if (!exists) {
            console.log('=== CREATING NEW CUSTOM SUBCATEGORY ===');
            try {
              await saveCustomSubcategory(currentUser.uid, 'Others', finalSubCategory);
              console.log('Custom subcategory saved to Firebase');
              
              // Add to local state
              const newSubcategory = {
                name: finalSubCategory,
                createdAt: new Date().toISOString()
              };
              setCustomSubcategories(prev => [...prev, newSubcategory]);
              console.log('Added to local state:', newSubcategory);
            } catch (error) {
              console.error('Error saving custom subcategory:', error);
            }
          } else {
            console.log('=== SUBCATEGORY ALREADY EXISTS ===');
          }
        }
      }
      // If a custom subcategory is already selected, use it as is
      else if (subCategory && subCategory !== 'Other') {
        console.log('=== USING EXISTING CUSTOM SUBCATEGORY ===');
        finalSubCategory = subCategory;
        console.log('Selected subcategory:', finalSubCategory);
      }
      // If no subcategory is selected, set to undefined
      else {
        console.log('=== NO SUBCATEGORY SELECTED ===');
        finalSubCategory = undefined;
      }
    }
    
    console.log('=== FINAL TRANSACTION DATA ===');
    const transaction = removeUndefined({
      id: initialData && initialData.id ? initialData.id : undefined,
      type: transactionType,
      category: category === 'Others' ? (finalSubCategory || 'Others') : category,
      subCategory: finalSubCategory ? undefined : undefined,
      amount: parseFloat(amount),
      description: description || undefined,
      date: date.toISOString(),
    });
    
    console.log('Transaction to save:', transaction);
    console.log('=== SAVING TRANSACTION ===');
    
    onSave(transaction);
    onClose();
    
    console.log('=== SAVE PROCESS COMPLETED ===');
  };

  const handleAmountChange = (event) => {
    const value = event.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleCategorySelect = (cat) => {
    setCategory(cat);
    setSubCategory('');
    setOtherCategory('');
    setErrors(prev => ({ ...prev, category: '', subCategory: '', otherCategory: '' }));
    // Reset "Other" text state when category changes
    setShowOtherTextBox(false);
    setOtherTextValue('');
    setOtherTextError('');
  };

  const getCategories = () => {
    return transactionType === 'expense' 
      ? Object.keys(expenseCategories)
      : incomeCategories;
  };

  const getSubCategories = () => {
    return expenseCategories[category] || [];
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('en-IN');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: isMobile ? '90vh' : '80vh',
          margin: isMobile ? 2 : 4,
          overflowY: 'auto',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {initialData ? 'Edit' : 'Add'} Transaction
        </Typography>
        <IconButton 
          edge="end" 
          color="inherit" 
          onClick={onClose} 
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Type Selection */}
        <Box sx={{ width: '100%', mb: 2 }}>
          <Tabs
            value={transactionType}
            onChange={(e, newValue) => {
              setTransactionType(newValue);
              setCategory('');
              setSubCategory('');
              setOtherCategory('');
              setErrors({});
            }}
            centered
            variant={isMobile ? "fullWidth" : "standard"}
          >
            <Tab value="expense" label="Expense" />
            <Tab value="income" label="Income" />
          </Tabs>
        </Box>

        {/* Category Selection - Clean List */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Category
          </Typography>
          <Grid container spacing={1}>
            {getCategories().map((cat) => (
              <Grid item xs={cat === 'Others' || cat === 'Salary' ? 12 : 6} sm={cat === 'Others' || cat === 'Salary' ? 12 : 4} key={cat}>
                <Card
                  variant={category === cat ? "elevated" : "outlined"}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: 2,
                    },
                    borderColor: category === cat ? 'primary.main' : 'divider',
                    backgroundColor: category === cat ? 'primary.light' : 'background.paper',
                    borderWidth: category === cat ? 2 : 1
                  }}
                >
                  <CardActionArea
                    onClick={() => handleCategorySelect(cat)}
                    sx={{
                      p: 1.5,
                      minHeight: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: category === cat ? 'bold' : 'medium',
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        color: category === cat ? 'primary.main' : 'text.primary'
                      }}
                    >
                      {cat}
                    </Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
          {errors.category && (
            <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
              {errors.category}
            </Typography>
          )}
        </Box>

        {/* Others Category - Direct subcategory selection */}
        {category === 'Others' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Subcategory
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {/* Default "Other" subcategory that opens dedicated text box */}
              <Chip
                label="Other"
                variant={subCategory === 'Other' ? "filled" : "outlined"}
                color={subCategory === 'Other' ? "primary" : "default"}
                size="medium"
                clickable
                onClick={() => {
                  setSubCategory('Other');
                  setShowOtherTextBox(true);
                  setShowCustomSubcategoryInput(false);
                  setOtherTextValue('');
                  setOtherTextError('');
                }}
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: subCategory === 'Other' ? 'bold' : 'medium',
                  px: 2,
                  py: 1
                }}
              />
              
              {/* Show custom subcategories for Others category */}
              {customSubcategories.map((subCat, index) => {
                // Handle different data formats from Firebase
                let subCatName;
                if (typeof subCat === 'string') {
                  subCatName = subCat;
                } else if (typeof subCat === 'object' && subCat !== null) {
                  if (subCat.name) {
                    subCatName = subCat.name;
                  } else {
                    // If it's an object but doesn't have a name property,
                    // it might be stored as { "subcategoryName": true } format
                    subCatName = Object.keys(subCat)[0] || String(subCat);
                  }
                } else {
                  subCatName = String(subCat);
                }
                
                return (
                  <Chip
                    key={`${subCatName}-${index}`}
                    label={subCatName}
                    variant={subCategory === subCatName ? "filled" : "outlined"}
                    color={subCategory === subCatName ? "primary" : "default"}
                    size="medium"
                    clickable
                    onClick={() => {
                      setSubCategory(subCatName);
                      // Clear the "Other" text box if it's open when selecting a custom subcategory
                      if (showOtherTextBox) {
                        setShowOtherTextBox(false);
                        setOtherTextValue('');
                        setOtherTextError('');
                      }
                    }}
                    sx={{
                      fontSize: '0.9rem',
                      fontWeight: subCategory === subCatName ? 'bold' : 'medium',
                      px: 2,
                      py: 1,
                      backgroundColor: subCategory === subCatName ? 'primary.light' : 'grey.100'
                    }}
                  />
                );
              })}
              
              {/* Add Custom Subcategory Button - Always visible for Others */}
              <Chip
                label="+ New Subcategory"
                variant="outlined"
                color="primary"
                size="medium"
                clickable
                onClick={() => setShowCustomSubcategoryInput(!showCustomSubcategoryInput)}
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: 'medium',
                  px: 2,
                  py: 1,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  backgroundColor: showCustomSubcategoryInput ? 'primary.light' : 'transparent'
                }}
              />
            </Box>
            
            {/* Custom Subcategory Input - Full row layout for Others */}
            {showCustomSubcategoryInput && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Add Custom Subcategory
                </Typography>
                <TextField
                  fullWidth
                  label="New Subcategory Name"
                  value={customSubcategoryInput}
                  onChange={(e) => {
                    setCustomSubcategoryInput(e.target.value);
                    setCustomSubcategoryError('');
                  }}
                  error={!!customSubcategoryError}
                  helperText={customSubcategoryError}
                  placeholder="e.g., Restaurant, Movies, etc."
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => {
                      setShowCustomSubcategoryInput(false);
                      setCustomSubcategoryInput('');
                      setCustomSubcategoryError('');
                    }}
                    startIcon={<CancelIcon />}
                    disabled={isSavingCustomSubcategory}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={async () => {
                      if (!customSubcategoryInput.trim()) {
                        setCustomSubcategoryError('Please enter a subcategory name');
                        return;
                      }
                      
                      if (!currentUser) {
                        setCustomSubcategoryError('Please sign in to add custom subcategories');
                        return;
                      }
                      
                      try {
                        setIsSavingCustomSubcategory(true);
                        const exists = await checkSubcategoryExists(currentUser.uid, 'Others', customSubcategoryInput.trim());
                        
                        if (exists) {
                          setCustomSubcategoryError('This subcategory already exists');
                          setIsSavingCustomSubcategory(false);
                          return;
                        }
                        
                        await saveCustomSubcategory(currentUser.uid, 'Others', customSubcategoryInput.trim());
                        // Add the new subcategory to the state immediately
                        const newSubcategory = {
                          name: customSubcategoryInput.trim(),
                          createdAt: new Date().toISOString()
                        };
                        setCustomSubcategories(prev => [...prev, newSubcategory]);
                        setSubCategory(customSubcategoryInput.trim());
                        setCustomSubcategoryInput('');
                        setShowCustomSubcategoryInput(false);
                        setCustomSubcategoryError('');
                      } catch (error) {
                        console.error('Error saving custom subcategory:', error);
                        setCustomSubcategoryError('Failed to save subcategory. Please try again.');
                      } finally {
                        setIsSavingCustomSubcategory(false);
                      }
                    }}
                    disabled={isSavingCustomSubcategory}
                    startIcon={isSavingCustomSubcategory ? null : <SaveIcon />}
                  >
                    {isSavingCustomSubcategory ? 'Saving...' : 'Save'}
                  </Button>
                </Box>
                {customSubcategoryError && (
                  <Typography color="error" variant="caption" sx={{ mt: 2, display: 'block' }}>
                    {customSubcategoryError}
                  </Typography>
                )}
              </Box>
            )}

            {/* "Other" Text Box - Simple text input for "Other" subcategory */}
            {showOtherTextBox && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="What did you spend on?"
                  value={otherTextValue}
                  onChange={(e) => {
                    setOtherTextValue(e.target.value);
                    setOtherTextError('');
                  }}
                  error={!!otherTextError}
                  helperText={otherTextError}
                  placeholder="e.g., Restaurant dinner, Movie tickets, etc."
                  size="small"
                />
              </Box>
            )}
            
            {errors.subCategory && (
              <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
                {errors.subCategory}
              </Typography>
            )}
          </Box>
        )}

        {/* Subcategory Selection - Always show for all categories */}
        {category && category !== 'Others' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Subcategory
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {getSubCategories().map((subCat) => (
                <Chip
                  key={subCat}
                  label={subCat}
                  variant={subCategory === subCat ? "filled" : "outlined"}
                  color={subCategory === subCat ? "primary" : "default"}
                  size="medium"
                  clickable
                  onClick={() => setSubCategory(subCat)}
                  sx={{
                    fontSize: '0.9rem',
                    fontWeight: subCategory === subCat ? 'bold' : 'medium',
                    px: 2,
                    py: 1
                  }}
                />
              ))}
              {/* Show custom subcategories */}
              {customSubcategories.map((subCat, index) => {
                // Handle different data formats from Firebase
                let subCatName;
                if (typeof subCat === 'string') {
                  subCatName = subCat;
                } else if (typeof subCat === 'object' && subCat !== null) {
                  if (subCat.name) {
                    subCatName = subCat.name;
                  } else {
                    // If it's an object but doesn't have a name property,
                    // it might be stored as { "subcategoryName": true } format
                    subCatName = Object.keys(subCat)[0] || String(subCat);
                  }
                } else {
                  subCatName = String(subCat);
                }
                
                return (
                  <Chip
                    key={`${subCatName}-${index}`}
                    label={subCatName}
                    variant={subCategory === subCatName ? "filled" : "outlined"}
                    color={subCategory === subCatName ? "primary" : "default"}
                    size="medium"
                    clickable
                    onClick={() => setSubCategory(subCatName)}
                    sx={{
                      fontSize: '0.9rem',
                      fontWeight: subCategory === subCatName ? 'bold' : 'medium',
                      px: 2,
                      py: 1,
                      backgroundColor: subCategory === subCatName ? 'primary.light' : 'grey.100'
                    }}
                  />
                );
              })}
              {/* Add Custom Subcategory Button - Always visible */}
              <Chip
                label="+ New Subcategory"
                variant="outlined"
                color="primary"
                size="medium"
                clickable
                onClick={() => setShowCustomSubcategoryInput(!showCustomSubcategoryInput)}
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: 'medium',
                  px: 2,
                  py: 1,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  backgroundColor: showCustomSubcategoryInput ? 'primary.light' : 'transparent'
                }}
              />
            </Box>
            
            {/* Custom Subcategory Input - Full row layout */}
            {showCustomSubcategoryInput && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Add Custom Subcategory
                </Typography>
                <TextField
                  fullWidth
                  label="New Subcategory Name"
                  value={customSubcategoryInput}
                  onChange={(e) => {
                    setCustomSubcategoryInput(e.target.value);
                    setCustomSubcategoryError('');
                  }}
                  error={!!customSubcategoryError}
                  helperText={customSubcategoryError}
                  placeholder="e.g., Diesel, Petrol, etc."
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => {
                      setShowCustomSubcategoryInput(false);
                      setCustomSubcategoryInput('');
                      setCustomSubcategoryError('');
                    }}
                    startIcon={<CancelIcon />}
                    disabled={isSavingCustomSubcategory}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={async () => {
                      if (!customSubcategoryInput.trim()) {
                        setCustomSubcategoryError('Please enter a subcategory name');
                        return;
                      }
                      
                      if (!currentUser) {
                        setCustomSubcategoryError('Please sign in to add custom subcategories');
                        return;
                      }
                      
                      try {
                        setIsSavingCustomSubcategory(true);
                        const exists = await checkSubcategoryExists(currentUser.uid, category, customSubcategoryInput.trim());
                        
                        if (exists) {
                          setCustomSubcategoryError('This subcategory already exists');
                          setIsSavingCustomSubcategory(false);
                          return;
                        }
                        
                        await saveCustomSubcategory(currentUser.uid, category, customSubcategoryInput.trim());
                        // Add the new subcategory to the state immediately
                        const newSubcategory = {
                          name: customSubcategoryInput.trim(),
                          createdAt: new Date().toISOString()
                        };
                        setCustomSubcategories(prev => [...prev, newSubcategory]);
                        setSubCategory(customSubcategoryInput.trim());
                        setCustomSubcategoryInput('');
                        setShowCustomSubcategoryInput(false);
                        setCustomSubcategoryError('');
                      } catch (error) {
                        console.error('Error saving custom subcategory:', error);
                        setCustomSubcategoryError('Failed to save subcategory. Please try again.');
                      } finally {
                        setIsSavingCustomSubcategory(false);
                      }
                    }}
                    disabled={isSavingCustomSubcategory}
                    startIcon={isSavingCustomSubcategory ? null : <SaveIcon />}
                  >
                    {isSavingCustomSubcategory ? 'Saving...' : 'Save'}
                  </Button>
                </Box>
                {customSubcategoryError && (
                  <Typography color="error" variant="caption" sx={{ mt: 2, display: 'block' }}>
                    {customSubcategoryError}
                  </Typography>
                )}
              </Box>
            )}
            
            {errors.subCategory && (
              <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
                {errors.subCategory}
              </Typography>
            )}
          </Box>
        )}

        {/* Amount Input */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Amount"
            value={amount}
            onChange={handleAmountChange}
            error={!!errors.amount}
            helperText={errors.amount}
            placeholder="0.00"
            size="small"
            type={isMobile ? "number" : "text"}
            inputMode={isMobile ? "decimal" : "text"}
            InputProps={{
              startAdornment: <InputAdornment position="start">₹</InputAdornment>,
            }}
          />
        </Box>

        {/* Advanced Options Toggle */}
        <Box sx={{ mb: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            size="small"
            sx={{
              justifyContent: 'space-between',
              textTransform: 'none',
              fontSize: '0.8rem'
            }}
          >
            {showAdvanced ? 'Hide' : 'Show'} More Options
          </Button>
        </Box>

        {/* Advanced Options */}
        <Collapse in={showAdvanced}>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Additional Details
            </Typography>
            
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              placeholder="Add details about this transaction..."
              size="small"
              sx={{ mb: 2 }}
            />

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Transaction Date"
                value={date}
                onChange={setDate}
                renderInput={(params) => (
                  <TextField {...params} fullWidth size="small" />
                )}
              />
            </LocalizationProvider>
          </Box>
        </Collapse>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit" variant="outlined" size="small" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          size="small"
          sx={{ 
            textTransform: 'none',
            fontWeight: 'bold'
          }}
        >
          {initialData ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddTransactionModal;
