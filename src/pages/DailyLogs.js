import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, Equalizer as EqualizerIcon } from '@mui/icons-material';
import { selectTransactions, updateTransaction, deleteTransaction } from '../store/transactionSlice';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isSameDay, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval, subDays } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const categories = [
  'Food',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Bills',
  'Healthcare',
  'Education',
  'Other',
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7F50'];

const DailyLogs = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const transactions = useSelector(selectTransactions);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: '',
    amount: '',
    description: '',
  });

  // Filter transactions for selected date
  const dailyTransactions = useMemo(() => {
    return transactions
      .filter(t => isSameDay(new Date(t.date), selectedDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedDate]);

  // Calculate statistics for selected date and previous day
  const statistics = useMemo(() => {
    const selectedDayStart = startOfDay(selectedDate);
    const selectedDayEnd = endOfDay(selectedDate);
    const previousDayStart = startOfDay(subDays(selectedDate, 1));
    const previousDayEnd = endOfDay(subDays(selectedDate, 1));
    
    // Transactions for the selected day
    const selectedDayTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= selectedDayStart && date <= selectedDayEnd;
    });
    
    // Transactions for the previous day
    const previousDayTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= previousDayStart && date <= previousDayEnd;
    });

    // All transactions up to the selected day (inclusive)
    const cumulativeTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: selectedDayStart, end: selectedDayEnd });
    });

    // All transactions up to the previous day (inclusive)
    const previousCumulativeTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: previousDayStart, end: previousDayEnd });
    });

    // Selected day calculations
    const selectedDayIncome = selectedDayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const selectedDayExpense = selectedDayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Previous day calculations
    const previousDayIncome = previousDayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const previousDayExpense = previousDayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Cumulative calculations
    const cumulativeIncome = cumulativeTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const cumulativeExpense = cumulativeTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const previousCumulativeIncome = previousCumulativeTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const previousCumulativeExpense = previousCumulativeTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      selectedDayIncome,
      selectedDayExpense,
      previousDayIncome,
      previousDayExpense,
      incomeChange: selectedDayIncome - previousDayIncome,
      expenseChange: selectedDayExpense - previousDayExpense,
      balanceChange: (selectedDayIncome - selectedDayExpense) - (previousDayIncome - previousDayExpense),
      cumulativeIncome,
      cumulativeExpense,
      cumulativeBalance: cumulativeIncome - cumulativeExpense,
      previousCumulativeBalance: previousCumulativeIncome - previousCumulativeExpense,
      cumulativeBalanceChange: (cumulativeIncome - cumulativeExpense) - (previousCumulativeIncome - previousCumulativeExpense),
    };
  }, [transactions, selectedDate]);

  // Calculate category-wise expenses for pie chart
  const categoryData = useMemo(() => {
    const categoryExpenses = {};
    dailyTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + Number(t.amount);
      });

    return Object.entries(categoryExpenses).map(([name, value]) => ({
      name,
      value,
    }));
  }, [dailyTransactions]);

  // Calculate hourly expense distribution for bar chart
  const hourlyData = useMemo(() => {
    const hourlyExpenses = Array(24).fill(0);
    dailyTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const hour = new Date(t.date).getHours();
        hourlyExpenses[hour] += Number(t.amount);
      });

    return hourlyExpenses.map((value, hour) => ({
      hour: `${hour}:00`,
      amount: value,
    }));
  }, [dailyTransactions]);

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      description: transaction.description || '',
    });
    setOpenDialog(true);
  };

  const handleDelete = (id) => {
    try {
      dispatch(deleteTransaction(id));
      setSuccess('Transaction deleted successfully!');
    } catch (err) {
      setError('Failed to delete transaction');
    }
  };

  const handleSave = () => {
    try {
      if (editingTransaction) {
        dispatch(updateTransaction({
          ...editingTransaction,
          ...formData,
          amount: Number(formData.amount),
        }));
        setSuccess('Transaction updated successfully!');
      }
      handleClose();
    } catch (err) {
      setError('Failed to update transaction');
    }
  };

  const handleClose = () => {
    setOpenDialog(false);
    setEditingTransaction(null);
    setFormData({
      type: 'expense',
      category: '',
      amount: '',
      description: '',
    });
  };

  const handleCloseSnackbar = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      <Typography variant="h4" gutterBottom>
        Daily Logs
      </Typography>

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Select Date"
          value={selectedDate}
          onChange={setSelectedDate}
          renderInput={(params) => (
            <TextField {...params} fullWidth sx={{ mb: 3 }} />
          )}
        />
      </LocalizationProvider>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {format(selectedDate, 'dd MMM yyyy')} Income
              </Typography>
              <Typography variant="h4" color="primary">
                ₹{statistics.selectedDayIncome.toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                color={statistics.incomeChange >= 0 ? 'success.main' : 'error.main'}
              >
                {statistics.incomeChange >= 0 ? '+' : ''}
                ₹{Math.abs(statistics.incomeChange).toFixed(2)} from previous day
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {format(selectedDate, 'dd MMM yyyy')} Expenses
              </Typography>
              <Typography variant="h4" color="error">
                ₹{statistics.selectedDayExpense.toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                color={statistics.expenseChange <= 0 ? 'success.main' : 'error.main'}
              >
                {statistics.expenseChange >= 0 ? '+' : ''}
                ₹{Math.abs(statistics.expenseChange).toFixed(2)} from previous day
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {format(selectedDate, 'dd MMM yyyy')} Balance
              </Typography>
              <Typography variant="h4" color={statistics.balanceChange >= 0 ? 'success.main' : 'error.main'}>
                ₹{(statistics.selectedDayIncome - statistics.selectedDayExpense).toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                color={statistics.balanceChange >= 0 ? 'success.main' : 'error.main'}
              >
                {statistics.balanceChange >= 0 ? '+' : ''}
                ₹{Math.abs(statistics.balanceChange).toFixed(2)} from previous day
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cumulative Balance up to {format(selectedDate, 'dd MMM yyyy')}
              </Typography>
              <Typography variant="h4" color={statistics.cumulativeBalance >= 0 ? 'success.main' : 'error.main'}>
                ₹{statistics.cumulativeBalance.toFixed(2)}
              </Typography>
              <Typography
                variant="body2"
                color={statistics.cumulativeBalanceChange >= 0 ? 'success.main' : 'error.main'}
              >
                {statistics.cumulativeBalanceChange >= 0 ? '+' : ''}
                ₹{Math.abs(statistics.cumulativeBalanceChange).toFixed(2)} from previous day
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Total Income: ₹{statistics.cumulativeIncome.toFixed(2)} | 
                Total Expenses: ₹{statistics.cumulativeExpense.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Transactions" />
          <Tab label="Insights" />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(new Date(transaction.date), 'HH:mm')}</TableCell>
                  <TableCell>{transaction.type}</TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell>₹{Number(transaction.amount).toFixed(2)}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEdit(transaction)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(transaction.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Category-wise Expenses for {format(selectedDate, 'dd MMM yyyy')}
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Hourly Expense Distribution for {format(selectedDate, 'dd MMM yyyy')}
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="amount" fill="#8884d8" name="Expense Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={openDialog} onClose={handleClose}>
        <DialogTitle>
          {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                label="Type"
              >
                <MenuItem value="income">Income</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSave}>
            {editingTransaction ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error || !!success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={error ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {error || success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DailyLogs; 