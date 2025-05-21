import React, { useMemo, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Fab,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Insights as InsightsIcon,
  PictureAsPdf as PdfIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Equalizer as EqualizerIcon,
} from '@mui/icons-material';
import { addTransactionAsync, fetchTransactions, setTransactions, deleteTransactionAsync, updateTransactionAsync } from '../store/transactionSlice';
import { fetchTransactionsByDateRange } from '../firebase/transactions';
import { auth } from '../firebase/config';
import { generateMonthlyReport } from '../utils/reportGenerator';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, isWithinInterval, eachDayOfInterval } from 'date-fns';
import AddTransactionModal from '../components/AddTransactionModal';
import { useAuth } from '../contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentUser } = useAuth();
  const transactions = useSelector(state => state.transactions.transactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [reportTransactions, setReportTransactions] = useState([]);
  const [openReportMonthDialog, setOpenReportMonthDialog] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState(new Date());
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  useEffect(() => {
    if (currentUser) {
      dispatch(fetchTransactions());
    } else {
      dispatch(setTransactions([]));
    }
    // eslint-disable-next-line
  }, [currentUser]);

  const filteredTransactions = useMemo(() => {
    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);
    return transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  }, [transactions, selectedMonth]);

  // Group transactions by day
  const dailyTransactions = useMemo(() => {
    let startDate = startOfMonth(selectedMonth);
    let endDate = endOfMonth(selectedMonth);
    // Get all days in the selected period
    const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
    // Create a map of days with their transactions
    const dailyMap = {};
    daysInPeriod.forEach(day => {
      dailyMap[format(day, 'yyyy-MM-dd')] = {
        date: day,
        income: 0,
        expense: 0,
        balance: 0,
        transactions: []
      };
    });
    // Add transactions to their respective days
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const dayKey = format(date, 'yyyy-MM-dd');
      if (dailyMap[dayKey]) {
        dailyMap[dayKey].transactions.push(transaction);
        if (transaction.type === 'income') {
          dailyMap[dayKey].income += Number(transaction.amount);
        } else {
          dailyMap[dayKey].expense += Number(transaction.amount);
        }
        dailyMap[dayKey].balance = dailyMap[dayKey].income - dailyMap[dayKey].expense;
      }
    });
    return Object.values(dailyMap);
  }, [filteredTransactions, selectedMonth]);

  const statistics = useMemo(() => {
    try {
      // Calculate total income and expenses
      const totalIncome = dailyTransactions.reduce((sum, day) => sum + day.income, 0);
      const totalExpenses = dailyTransactions.reduce((sum, day) => sum + day.expense, 0);
      const savings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

      // Calculate daily statistics
      const daysWithExpenses = dailyTransactions.filter(day => day.expense > 0);
      const minDailyExpense = daysWithExpenses.length > 0 
        ? Math.min(...daysWithExpenses.map(day => day.expense)) 
        : 0;
      const maxDailyExpense = daysWithExpenses.length > 0 
        ? Math.max(...daysWithExpenses.map(day => day.expense)) 
        : 0;
      const avgDailyExpense = daysWithExpenses.length > 0 
        ? totalExpenses / daysWithExpenses.length 
        : 0;

      // Calculate days with no transactions
      const daysWithNoTransactions = dailyTransactions.filter(day => day.transactions.length === 0).length;

      return {
        income: totalIncome,
        expenses: totalExpenses,
        savings,
        savingsRate,
        minDailyExpense,
        maxDailyExpense,
        avgDailyExpense,
        daysWithNoTransactions,
        totalDays: dailyTransactions.length,
        daysWithTransactions: dailyTransactions.length - daysWithNoTransactions,
      };
    } catch (err) {
      console.error('Error calculating statistics:', err);
      return {
        income: 0,
        expenses: 0,
        savings: 0,
        savingsRate: 0,
        minDailyExpense: 0,
        maxDailyExpense: 0,
        avgDailyExpense: 0,
        daysWithNoTransactions: 0,
        totalDays: 0,
        daysWithTransactions: 0,
      };
    }
  }, [dailyTransactions]);

  const handleGenerateReport = () => {
    setOpenReportMonthDialog(true);
  };

  const handleSaveTransaction = async (transaction) => {
    try {
      if (editTransaction && editTransaction.id) {
        await dispatch(updateTransactionAsync({ id: editTransaction.id, transaction }));
        setSuccess('Transaction updated successfully!');
      } else {
        await dispatch(addTransactionAsync(transaction));
        setSuccess('Transaction added successfully!');
      }
      setIsAddModalOpen(false);
      setEditTransaction(null);
    } catch (err) {
      setError('Failed to save transaction. Please try again.');
    }
  };

  const handleCloseSnackbar = () => {
    setError(null);
    setSuccess(null);
  };

  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" color={color}>
          ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  // Update the groupedTransactions calculation
  const groupedTransactions = useMemo(() => {
    // Sort all transactions by date ascending for cumulative sum calculation
    const sorted = [...filteredTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    const dateMap = {};
    
    sorted.forEach(txn => {
      const dayKey = format(new Date(txn.date), 'yyyy-MM-dd');
      if (!dateMap[dayKey]) {
        dateMap[dayKey] = {
          date: dayKey,
          transactions: [],
          dayIncome: 0,
          dayExpense: 0
        };
      }
      const amount = txn.type === 'income' ? Number(txn.amount) : -Number(txn.amount);
      if (txn.type === 'income') {
        dateMap[dayKey].dayIncome += Number(txn.amount);
      } else {
        dateMap[dayKey].dayExpense += Number(txn.amount);
      }
      cumulative += amount;
      // Attach the cumulative sum to the transaction itself
      dateMap[dayKey].transactions.push({ ...txn, cumulativeSum: cumulative });
    });
    
    // Convert to array and sort by date descending for display
    return Object.values(dateMap).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredTransactions]);

  const renderInsightContent = () => {
    switch (selectedInsight) {
      case 'category-breakdown':
        const categoryExpenses = filteredTransactions
          .filter(t => t.type === 'expense')
          .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
            return acc;
          }, {});
        
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Category-wise Expenses</Typography>
            {Object.entries(categoryExpenses).map(([category, amount]) => (
              <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>{category}</Typography>
                <Typography>₹{amount.toLocaleString('en-IN')}</Typography>
              </Box>
            ))}
          </Box>
        );

      case 'top-categories':
        const topCategories = Object.entries(
          filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
              acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
              return acc;
            }, {})
        )
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Top Spending Categories</Typography>
            {topCategories.map(([category, amount], index) => (
              <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>{index + 1}. {category}</Typography>
                <Typography>₹{amount.toLocaleString('en-IN')}</Typography>
              </Box>
            ))}
          </Box>
        );

      case 'savings-analysis':
        const totalIncome = filteredTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const totalExpenses = filteredTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const savings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Savings Analysis</Typography>
            <Typography>Savings Rate: {savingsRate.toFixed(2)}%</Typography>
            <Typography>Total Savings: ₹{savings.toLocaleString('en-IN')}</Typography>
            <Typography>Income: ₹{totalIncome.toLocaleString('en-IN')}</Typography>
            <Typography>Expenses: ₹{totalExpenses.toLocaleString('en-IN')}</Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  // Add ReportMonthDialog component
  const ReportMonthDialog = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Month for Report</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            views={["year", "month"]}
            label="Select Month"
            minDate={new Date('2000-01-01')}
            maxDate={new Date('2100-12-31')}
            value={selectedReportMonth}
            onChange={setSelectedReportMonth}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                sx={{ mt: 2 }}
              />
            )}
          />
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={async () => {
            try {
              setLoading(true);
              const startDate = startOfMonth(selectedReportMonth);
              const endDate = endOfMonth(selectedReportMonth);
              const transactions = await fetchTransactionsByDateRange(auth.currentUser.uid, startDate, endDate);
              const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
              setReportTransactions(txs);
              const doc = generateMonthlyReport(txs, selectedReportMonth);
              doc.save(`financial_monthly_report_${format(selectedReportMonth, 'yyyy-MM')}.pdf`);
              setSuccess('Monthly report generated successfully!');
              onClose();
            } catch (err) {
              console.error('Error generating report:', err);
              setError(`Failed to generate report: ${err.message}`);
            } finally {
              setLoading(false);
            }
          }} 
          color="primary" 
          variant="contained"
        >
          Generate Report
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: isMobile ? 2 : 3, pb: isMobile ? 10 : 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        Welcome to COMMON MAN
      </Typography>

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          views={["year", "month"]}
          label="Select Month"
          minDate={new Date('2000-01-01')}
          maxDate={new Date('2100-12-31')}
          value={selectedMonth}
          onChange={setSelectedMonth}
          renderInput={(params) => (
            <TextField 
              {...params} 
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                }
              }} 
              fullWidth={isMobile} 
            />
          )}
        />
      </LocalizationProvider>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Income"
            value={statistics.income}
            icon={<TrendingUpIcon color="primary" />}
            color="primary"
            subtitle={format(selectedMonth, 'MMMM yyyy')}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Expenditure"
            value={statistics.expenses}
            icon={<TrendingDownIcon color="error" />}
            color="error"
            subtitle={`${filteredTransactions.length} transactions`}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Remaining Balance"
            value={statistics.savings}
            icon={<EqualizerIcon color={statistics.savings >= 0 ? 'success' : 'error'} />}
            color={statistics.savings >= 0 ? 'success.main' : 'error.main'}
            subtitle={statistics.savings >= 0 ? 'Surplus' : 'Deficit'}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={loading ? <CircularProgress size={24} /> : <PdfIcon />}
              onClick={handleGenerateReport}
              disabled={loading}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                py: 1.5
              }}
            >
              Download Monthly Report
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Transaction History
        </Typography>
        {isMobile ? (
          // Mobile: Card/List layout
          <Box>
            {groupedTransactions.map(({ date, transactions, dayIncome, dayExpense }) => (
              <Box key={date} sx={{ mb: 2, p: 2, borderRadius: 2, backgroundColor: 'background.paper', boxShadow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{format(new Date(date), 'dd MMM yyyy')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Income: ₹{dayIncome.toLocaleString('en-IN')} | Expense: ₹{dayExpense.toLocaleString('en-IN')}
                </Typography>
                {transactions.map((txn) => (
                  <Box key={txn.id} sx={{ mt: 1, p: 1, borderRadius: 1, backgroundColor: 'action.hover', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{format(new Date(txn.date), 'HH:mm')}</Typography>
                      <Typography sx={{ color: txn.type === 'income' ? 'success.main' : 'error.main', fontWeight: 'medium' }}>{txn.type}</Typography>
                      <Typography>{txn.category}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ color: txn.type === 'income' ? 'success.main' : 'error.main', fontWeight: 'medium' }}>
                        ₹{Number(txn.amount).toLocaleString('en-IN')}
                      </Typography>
                      <Box>
                        <Button size="small" onClick={() => { setEditTransaction(txn); setIsAddModalOpen(true); }} sx={{ minWidth: 'auto', mr: 1 }}>
                          <span role="img" aria-label="edit">✏️</span>
                        </Button>
                        <Button size="small" color="error" onClick={() => { setTransactionToDelete(txn); setDeleteDialogOpen(true); }} sx={{ minWidth: 'auto' }}>
                          <span role="img" aria-label="delete">🗑️</span>
                        </Button>
                      </Box>
                    </Box>
                    {txn.description && <Typography variant="caption" color="text.secondary">{txn.description}</Typography>}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        ) : (
          // Desktop: Table layout
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Cumulative Balance</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedTransactions.map(({ date, transactions, dayIncome, dayExpense }) => (
                transactions.map((txn, idx) => (
                  <TableRow 
                    key={txn.id}
                    sx={{
                      '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                      '&:hover': { backgroundColor: 'action.selected' }
                    }}
                  >
                    {idx === 0 && (
                      <TableCell rowSpan={transactions.length}>
                        <Box>
                          <Typography variant="subtitle2">
                            {format(new Date(date), 'dd MMM yyyy')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Income: ₹{dayIncome.toLocaleString('en-IN')}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            Expense: ₹{dayExpense.toLocaleString('en-IN')}
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell sx={{ color: txn.cumulativeSum >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                      ₹{txn.cumulativeSum.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>{format(new Date(txn.date), 'HH:mm')}</TableCell>
                    <TableCell>
                      <Typography sx={{ color: txn.type === 'income' ? 'success.main' : 'error.main', fontWeight: 'medium' }}>
                        {txn.type}
                      </Typography>
                    </TableCell>
                    <TableCell>{txn.category}</TableCell>
                    <TableCell>
                      <Typography sx={{ color: txn.type === 'income' ? 'success.main' : 'error.main', fontWeight: 'medium' }}>
                        ₹{Number(txn.amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => { setEditTransaction(txn); setIsAddModalOpen(true); }} sx={{ minWidth: 'auto', mr: 1 }}>
                        <span role="img" aria-label="edit">✏️</span>
                      </Button>
                      <Button size="small" color="error" onClick={() => { setTransactionToDelete(txn); setDeleteDialogOpen(true); }} sx={{ minWidth: 'auto' }}>
                        <span role="img" aria-label="delete">🗑️</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Detailed Insights
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Select Insight Type</InputLabel>
          <Select
            value={selectedInsight}
            label="Select Insight Type"
            onChange={(e) => setSelectedInsight(e.target.value)}
            sx={{
              borderRadius: 2,
              backgroundColor: 'background.paper',
            }}
          >
            <MenuItem value="category-breakdown">Category-wise Expense Breakdown</MenuItem>
            <MenuItem value="top-categories">Top Spending Categories</MenuItem>
            <MenuItem value="savings-analysis">Savings Analysis</MenuItem>
          </Select>
        </FormControl>
        {renderInsightContent()}
      </Box>

      <Fab
        color="primary"
        sx={{ 
          position: 'fixed', 
          bottom: isMobile ? 16 : 24, 
          right: isMobile ? 16 : 24,
          zIndex: 1000,
        }}
        onClick={() => setIsAddModalOpen(true)}
      >
        <AddIcon />
      </Fab>

      <AddTransactionModal
        open={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditTransaction(null); }}
        onSave={handleSaveTransaction}
        initialData={editTransaction}
      />

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

      {/* Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Transaction</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this transaction? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={async () => {
            if (transactionToDelete) {
              await dispatch(deleteTransactionAsync(transactionToDelete.id));
            }
            setDeleteDialogOpen(false);
            setTransactionToDelete(null);
          }} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add the ReportMonthDialog to the JSX */}
      <ReportMonthDialog
        open={openReportMonthDialog}
        onClose={() => setOpenReportMonthDialog(false)}
      />
    </Box>
  );
};

export default Home; 