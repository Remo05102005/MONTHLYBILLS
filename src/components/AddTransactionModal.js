import React, { useState, useEffect, useRef } from 'react';
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
import { Close as CloseIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Save as SaveIcon, Cancel as CancelIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { removeUndefined } from '../utils/cleanObject';
import { useAuth } from '../contexts/AuthContext';
import { saveCustomSubcategory, getCustomSubcategories, checkSubcategoryExists, deleteCustomSubcategory } from '../firebase/customSubcategories';

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

// Default date for a brand-new transaction: if the user is currently browsing
// a past/future month, default into that month (clamped to a valid day) instead
// of always defaulting to today — otherwise a transaction added while viewing
// an old month silently lands in the current month's bucket.
const getDefaultDateForMonth = (selectedMonth) => {
  const today = new Date();
  if (
    !selectedMonth ||
    (selectedMonth.getFullYear() === today.getFullYear() && selectedMonth.getMonth() === today.getMonth())
  ) {
    return today;
  }
  const lastDayOfSelectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const day = Math.min(today.getDate(), lastDayOfSelectedMonth);
  return new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
};

// Custom subcategories can come back from Firebase in a couple of shapes
// (a plain string, { name: ... }, or a legacy { subcategoryName: true } map) —
// normalize to the display name used for chip labels/matching.
const getSubcategoryDisplayName = (subCat) => {
  if (typeof subCat === 'string') {
    return subCat;
  }
  if (typeof subCat === 'object' && subCat !== null) {
    if (subCat.name) {
      return subCat.name;
    }
    return Object.keys(subCat)[0] || String(subCat);
  }
  return String(subCat);
};

const AddTransactionModal = ({ open, onClose, onSave, initialData, selectedMonth, onCustomSubcategoryAdded }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();
  const [transactionType, setTransactionType] = useState('expense');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [subcategoryToDelete, setSubcategoryToDelete] = useState(null);

  // For an "Others" transaction whose subcategory was saved as one-time free text
  // (never persisted as a reusable custom subcategory), the raw text doesn't match
  // the "Other" chip or any custom-subcategory chip, so nothing appears selected
  // when reopening it for edit. This holds that raw text until the custom
  // subcategory list has loaded and we can tell whether it's free text or a
  // known custom subcategory (see the resolution effect below).
  const pendingRawSubCategoryRef = useRef(null);
  // Bumped every time the modal opens, so the custom-subcategory fetch effect
  // below re-runs (and re-resolves pendingRawSubCategoryRef) even when the
  // category is unchanged from the last time it was open — e.g. editing two
  // different "Others" transactions back-to-back wouldn't otherwise trigger
  // that effect a second time.
  const [openSessionId, setOpenSessionId] = useState(0);

  useEffect(() => {
    if (open) {
      setOpenSessionId(id => id + 1);
      // These "Others"/custom-subcategory helper fields are local to a single
      // in-progress edit and must not leak into the next time the modal opens
      // (it stays mounted for the lifetime of the page — only `open` toggles).
      setShowOtherTextBox(false);
      setOtherTextValue('');
      setOtherTextError('');
      setShowCustomSubcategoryInput(false);
      setCustomSubcategoryInput('');
      setCustomSubcategoryError('');
      setDeleteConfirmOpen(false);
      setSubcategoryToDelete(null);

      if (initialData) {
        setTransactionType(initialData.type || 'expense');
        setCategory(initialData.category || '');
        setSubCategory(initialData.subCategory || '');
        setAmount(initialData.amount != null ? String(initialData.amount) : '');
        setDescription(initialData.description || '');
        setDate(initialData.date ? new Date(initialData.date) : new Date());
        setErrors({});
        setShowAdvanced(!!initialData.description);
        // Others' subcategory might be a one-time free-text value rather than a
        // known custom subcategory — resolved once the fetch below tells us which.
        pendingRawSubCategoryRef.current =
          initialData.category === 'Others' && initialData.subCategory
            ? initialData.subCategory
            : null;
      } else {
        setTransactionType('expense');
        setCategory('');
        setSubCategory('');
        setAmount('');
        setDescription('');
        setDate(getDefaultDateForMonth(selectedMonth));
        setErrors({});
        setShowAdvanced(false);
        pendingRawSubCategoryRef.current = null;
      }
    }
  }, [open, initialData, selectedMonth]);

  // Fetch custom subcategories when category changes
  useEffect(() => {
    let cancelled = false;
    const fetchCustomSubcategories = async () => {
      if (category && currentUser) {
        setLoadingCustomSubcategories(true);
        try {
          const subcats = await getCustomSubcategories(currentUser.uid, category);
          if (!cancelled) {
            setCustomSubcategories(subcats || []);
            resolvePendingRawSubCategory(subcats || []);
          }
        } catch (error) {
          console.error('Error fetching custom subcategories:', error);
          if (!cancelled) {
            setCustomSubcategories([]);
            resolvePendingRawSubCategory([]);
          }
        } finally {
          if (!cancelled) setLoadingCustomSubcategories(false);
        }
      } else {
        setCustomSubcategories([]);
      }
    };

    // If the subcategory being edited turns out not to be one of the fetched
    // custom subcategories, it must be a one-time free-text "Other" value —
    // switch the UI into the "Other" chip + text box so it's visible/editable
    // instead of appearing blank because nothing matches it.
    const resolvePendingRawSubCategory = (subcats) => {
      const raw = pendingRawSubCategoryRef.current;
      if (!raw || category !== 'Others') return;
      pendingRawSubCategoryRef.current = null;
      if (raw === 'Other') return;
      const isKnownCustomSubcategory = subcats.some(sc => getSubcategoryDisplayName(sc) === raw);
      if (!isKnownCustomSubcategory) {
        setSubCategory('Other');
        setShowOtherTextBox(true);
        setOtherTextValue(raw);
      }
    };

    fetchCustomSubcategories();
    // Ignore a stale response if the user switches categories again before it resolves.
    return () => { cancelled = true; };
  }, [category, currentUser, openSessionId]);

  const validateForm = () => {
    const newErrors = {};

    // Check category
    if (!category) {
      newErrors.category = 'Please select a category';
    }

    // Check if category has subcategories and subcategory is required
    const hasPredefinedSubcategories = expenseCategories[category] && expenseCategories[category].length > 0;
    const hasCustomSubcategories = customSubcategories && customSubcategories.length > 0;

    // For Others category, always require a subcategory (either custom or "Other" with text)
    if (category === 'Others') {
      if (!subCategory) {
        newErrors.subCategory = 'Please select a subcategory';
      } else if (subCategory === 'Other' && !otherTextValue.trim()) {
        newErrors.subCategory = 'Please enter a description for "Other"';
      }
    } else if ((hasPredefinedSubcategories || hasCustomSubcategories) && !subCategory) {
      newErrors.subCategory = 'Please select a subcategory';
    }

    // Check amount
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(amount) || parseFloat(amount) < 0) {
      newErrors.amount = 'Please enter a valid amount (0 or greater)';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    return isValid;
  };

  const handleSave = async () => {
    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    let finalSubCategory = subCategory;

    // Logic for Others category: create custom subcategory if needed
    if (category === 'Others') {
      // If "Other" is selected and there's text in the text box, use that as the subcategory.
      // This is a one-time value — it is NOT saved to Firebase as a reusable custom subcategory.
      if (subCategory === 'Other' && otherTextValue.trim()) {
        finalSubCategory = otherTextValue.trim();
      }
      // If a custom subcategory is already selected, use it as is
      else if (subCategory && subCategory !== 'Other') {
        finalSubCategory = subCategory;
      }
      // If no subcategory is selected, set to undefined
      else {
        finalSubCategory = undefined;
      }
    }

    const transaction = removeUndefined({
      id: initialData && initialData.id ? initialData.id : undefined,
      type: transactionType,
      category: category,
      subCategory: category === 'Others' ? finalSubCategory : (subCategory || undefined),
      amount: parseFloat(amount),
      description: description || undefined,
      date: date.toISOString(),
    });

    onSave(transaction);
    onClose();
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
    setErrors(prev => ({ ...prev, category: '', subCategory: '' }));
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

  // Open delete confirmation dialog
  const openDeleteConfirm = (subcategoryName) => {
    setSubcategoryToDelete(subcategoryName);
    setDeleteConfirmOpen(true);
  };

  // Handle confirmed delete
  const handleConfirmDelete = async () => {
    if (!currentUser || !category || !subcategoryToDelete) return;
    
    try {
      await deleteCustomSubcategory(currentUser.uid, category, subcategoryToDelete);
      // Remove from local state
      setCustomSubcategories(prev => prev.filter(subcat => {
        const name = typeof subcat === 'string' ? subcat : (subcat.name || Object.keys(subcat)[0]);
        return name !== subcategoryToDelete;
      }));
      // Clear selection if deleted subcategory was selected
      if (subCategory === subcategoryToDelete) {
        setSubCategory('');
      }
      // Close dialog and reset
      setDeleteConfirmOpen(false);
      setSubcategoryToDelete(null);
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      setDeleteConfirmOpen(false);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setSubcategoryToDelete(null);
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
                const subCatName = getSubcategoryDisplayName(subCat);

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
                    onDelete={() => openDeleteConfirm(subCatName)}
                    deleteIcon={<DeleteIcon sx={{ fontSize: '1rem', opacity: 0.6, '&:hover': { opacity: 1, color: 'error.main' } }} />}
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: subCategory === subCatName ? 'bold' : 'medium',
                      height: isMobile ? 32 : 28,
                      backgroundColor: subCategory === subCatName ? 'primary.light' : 'grey.50',
                      '& .MuiChip-deleteIcon': {
                        marginLeft: '2px',
                        marginRight: '-2px',
                      }
                    }}
                  />
                );
              })}
              
              {/* Add Custom Subcategory Button - Always visible for Others */}
              <Chip
                label="+"
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
                const subCatName = getSubcategoryDisplayName(subCat);

                return (
                  <Chip
                    key={`${subCatName}-${index}`}
                    label={subCatName}
                    variant={subCategory === subCatName ? "filled" : "outlined"}
                    color={subCategory === subCatName ? "primary" : "default"}
                    size="medium"
                    clickable
                    onClick={() => setSubCategory(subCatName)}
                    onDelete={() => openDeleteConfirm(subCatName)}
                    deleteIcon={<DeleteIcon sx={{ fontSize: '1rem', opacity: 0.6, '&:hover': { opacity: 1, color: 'error.main' } }} />}
                    sx={{
                      fontSize: '0.85rem',
                      fontWeight: subCategory === subCatName ? 'bold' : 'medium',
                      height: isMobile ? 32 : 28,
                      backgroundColor: subCategory === subCatName ? 'primary.light' : 'grey.50',
                      '& .MuiChip-deleteIcon': {
                        marginLeft: '2px',
                        marginRight: '-2px',
                      }
                    }}
                  />
                );
              })}
              {/* Add Custom Subcategory Button - Always visible */}
              <Chip
                label="+"
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
                        
                        // Notify parent component that a custom subcategory was added
                        if (onCustomSubcategoryAdded) {
                          onCustomSubcategoryAdded();
                        }
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

        {/* Transaction Date - always visible, since this determines which month
            the transaction is stored under */}
        <Box sx={{ mb: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Transaction Date"
              value={date}
              onChange={setDate}
              renderInput={(params) => (
                <TextField {...params} fullWidth size="small" error={!!errors.date} helperText={errors.date} />
              )}
            />
          </LocalizationProvider>
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            margin: isMobile ? 2 : 4,
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          pb: 1,
          color: 'error.main'
        }}>
          <DeleteIcon color="error" />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Delete Subcategory
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Are you sure you want to delete this subcategory?
          </Typography>
          <Box sx={{ 
            p: 1.5, 
            bgcolor: 'grey.100', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
              "{subcategoryToDelete}"
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleCancelDelete} 
            color="inherit" 
            variant="outlined" 
            size="small" 
            sx={{ textTransform: 'none', flex: 1 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            variant="contained" 
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            sx={{ 
              textTransform: 'none',
              fontWeight: 'bold',
              flex: 1
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default AddTransactionModal;
