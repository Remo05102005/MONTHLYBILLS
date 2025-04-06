import React, { useMemo, useState } from 'react';
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
import { selectTransactions, addTransaction } from '../store/transactionSlice';
import { generatePDF } from '../utils/pdfGenerator';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, isWithinInterval, eachDayOfInterval } from 'date-fns';
import AddTransactionModal from '../components/AddTransactionModal';

const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const transactions = useSelector(selectTransactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState('month');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate, endDate;

    switch (timePeriod) {
      case 'week':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      default: // month
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    return transactions.filter(t => {
      const date = new Date(t.date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  }, [transactions, timePeriod]);

  // Group transactions by day
  const dailyTransactions = useMemo(() => {
    const now = new Date();
    let startDate, endDate;

    switch (timePeriod) {
      case 'week':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      default: // month
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

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
  }, [filteredTransactions, timePeriod]);

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

  const handleTimePeriodChange = (event, newPeriod) => {
    if (newPeriod !== null) {
      setTimePeriod(newPeriod);
    }
  };

  const handleGenerateReport = async (type) => {
    try {
      setLoading(true);
      setError(null);
      
      // Prepare data for the report
      const reportData = {
        transactions: filteredTransactions,
        statistics: {
          ...statistics,
          period: timePeriod,
          startDate: format(new Date(), 'MMMM yyyy'),
        },
        dailyData: dailyTransactions,
      };
      
      // Log the data being sent to the PDF generator for debugging
      console.log('Generating report with data:', reportData);
      
      await generatePDF(reportData, type);
      setSuccess(`${type === 'monthly' ? 'Monthly' : 'Insights'} report generated successfully!`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(`Failed to generate ${type} report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = (transaction) => {
    try {
      dispatch(addTransaction({
        ...transaction,
        id: Date.now(),
      }));
      setSuccess('Transaction added successfully!');
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError('Failed to add transaction. Please try again.');
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

  return (
    <Box sx={{ p: isMobile ? 2 : 3, pb: isMobile ? 10 : 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome to COMMON MAN
      </Typography>

      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={timePeriod}
          exclusive
          onChange={handleTimePeriodChange}
          aria-label="time period"
          size={isMobile ? "small" : "medium"}
          sx={{ width: isMobile ? '100%' : 'auto' }}
        >
          <ToggleButton value="today" aria-label="today">
            Today
          </ToggleButton>
          <ToggleButton value="week" aria-label="this week">
            This Week
          </ToggleButton>
          <ToggleButton value="month" aria-label="this month">
            This Month
          </ToggleButton>
          <ToggleButton value="year" aria-label="this year">
            This Year
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Income"
            value={statistics.income}
            icon={<TrendingUpIcon color="primary" />}
            color="primary"
            subtitle={format(new Date(), 'MMMM yyyy')}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Expenditure"
            value={statistics.expenses}
            icon={<TrendingDownIcon color="error" />}
            color="error"
            subtitle={`${statistics.daysWithTransactions} days with transactions`}
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

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Daily Expenditure Statistics
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Minimum Daily Expenditure"
            value={statistics.minDailyExpense}
            icon={<TrendingDownIcon color="info" />}
            color="info.main"
            subtitle="Lowest spending day"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Maximum Daily Expenditure"
            value={statistics.maxDailyExpense}
            icon={<TrendingUpIcon color="warning" />}
            color="warning.main"
            subtitle="Highest spending day"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Average Daily Expenditure"
            value={statistics.avgDailyExpense}
            icon={<EqualizerIcon color="secondary" />}
            color="secondary.main"
            subtitle={`Over ${statistics.daysWithTransactions} days`}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CalendarIcon />}
              onClick={() => navigate('/daily-logs')}
            >
              View Daily Activity
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<InsightsIcon />}
              onClick={() => navigate('/insights')}
            >
              View Insights
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={loading ? <CircularProgress size={24} /> : <PdfIcon />}
              onClick={() => handleGenerateReport('monthly')}
              disabled={loading}
            >
              Download Monthly Report
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={loading ? <CircularProgress size={24} /> : <PdfIcon />}
              onClick={() => handleGenerateReport('insights')}
              disabled={loading}
            >
              Download Insights
            </Button>
          </Grid>
        </Grid>
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
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddTransaction}
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
    </Box>
  );
};

export default Home; 