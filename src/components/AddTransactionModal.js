import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Tabs,
  Tab,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Close as CloseIcon } from '@mui/icons-material';
import { removeUndefined } from '../utils/cleanObject';

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
  const [transactionType, setTransactionType] = useState('expense');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [otherCategory, setOtherCategory] = useState('');
  const [errors, setErrors] = useState({});

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
      } else {
        setTransactionType('expense');
        setCategory('');
        setSubCategory('');
        setAmount('');
        setDescription('');
        setDate(new Date());
        setOtherCategory('');
        setErrors({});
      }
    }
  }, [open, initialData]);

  const validateForm = () => {
    const newErrors = {};
    if (!category && !otherCategory) {
      newErrors.category = 'Please select a category';
    }
    // Check if category has subcategories and subcategory is required
    if (expenseCategories[category] && expenseCategories[category].length > 0 && !subCategory) {
      newErrors.subCategory = 'Please select a subcategory';
    }
    if (category === 'Others' && !otherCategory) {
      newErrors.otherCategory = 'Please specify the category';
    }
    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(amount) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid positive number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      const transaction = removeUndefined({
        id: initialData && initialData.id ? initialData.id : undefined,
        type: transactionType,
        category: category === 'Others' ? otherCategory : category,
        subCategory: subCategory || undefined,
        amount: parseFloat(amount),
        description: description || undefined,
        date: date.toISOString(),
      });
      onSave(transaction);
      onClose();
    }
  };

  const handleAmountChange = (event) => {
    const value = event.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
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
        <Typography variant="h6">Add Transaction</Typography>
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
        <Box sx={{ width: '100%', mb: 2 }}>
          <Tabs
            value={transactionType}
            onChange={(e, newValue) => setTransactionType(newValue)}
            centered
            variant={isMobile ? "fullWidth" : "standard"}
          >
            <Tab value="expense" label="Expense" />
            <Tab value="income" label="Income" />
          </Tabs>
        </Box>

        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth error={!!errors.category}>
            <FormLabel>Category</FormLabel>
            <RadioGroup
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubCategory('');
                setOtherCategory('');
              }}
            >
              {(transactionType === 'expense' ? Object.keys(expenseCategories) : incomeCategories).map(
                (cat) => (
                  <FormControlLabel
                    key={cat}
                    value={cat}
                    control={<Radio />}
                    label={cat}
                  />
                )
              )}
            </RadioGroup>
            {errors.category && (
              <Typography color="error" variant="caption">
                {errors.category}
              </Typography>
            )}
          </FormControl>

          {category === 'Others' && (
            <TextField
              fullWidth
              label="Specify Category"
              value={otherCategory}
              onChange={(e) => setOtherCategory(e.target.value)}
              error={!!errors.otherCategory}
              helperText={errors.otherCategory}
              sx={{ mt: 2 }}
            />
          )}

          {expenseCategories[category] && expenseCategories[category].length > 0 && (
            <FormControl fullWidth error={!!errors.subCategory} sx={{ mt: 2 }}>
              <InputLabel>Select Subcategory</InputLabel>
              <Select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                label="Select Subcategory"
              >
                {expenseCategories[category].map((subCat) => (
                  <MenuItem key={subCat} value={subCat}>
                    {subCat}
                  </MenuItem>
                ))}
              </Select>
              {errors.subCategory && (
                <Typography color="error" variant="caption">
                  {errors.subCategory}
                </Typography>
              )}
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Amount"
            value={amount}
            onChange={handleAmountChange}
            error={!!errors.amount}
            helperText={errors.amount}
            sx={{ mt: 2 }}
            InputProps={{
              startAdornment: <InputAdornment position="start">₹</InputAdornment>,
            }}
          />

          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            sx={{ mt: 2 }}
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Date"
              value={date}
              onChange={setDate}
              renderInput={(params) => (
                <TextField {...params} fullWidth sx={{ mt: 2 }} />
              )}
            />
          </LocalizationProvider>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          fullWidth={isMobile}
          sx={{ ml: isMobile ? 0 : 1 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddTransactionModal; 