import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchTodos } from '../store/todoSlice';
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
  Divider,
  Fade,
  Chip,
  Stack,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Slider,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Insights as InsightsIcon,
  PictureAsPdf as PdfIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Equalizer as EqualizerIcon,
  Share as ShareIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { addTransactionAsync, fetchTransactions, setTransactions, deleteTransactionAsync, updateTransactionAsync, fetchTransactionsForCurrentMonth, fetchTransactionsByMonth } from '../store/transactionSlice';
import { fetchTransactionsByDateRange, fetchTransactionsForMonth } from '../firebase/transactions';
import { auth } from '../firebase/config';
import { generateMonthlyReport } from '../utils/reportGenerator';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, isWithinInterval, eachDayOfInterval } from 'date-fns';
import AddTransactionModal from '../components/AddTransactionModal';
import SubbaraoChat from '../components/AIAssistant';
import AITestButton from '../components/AITestButton';
import GenAITest from '../components/GenAITest';
import { useAuth } from '../contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { generateCategoryAnalysisPDF } from '../utils/pdfGenerator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import html2canvas from 'html2canvas';

const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentUser } = useAuth();
  const transactions = useSelector(state => state.transactions.transactions);
  const todos = useSelector(state => state.todos.todos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [reportTransactions, setReportTransactions] = useState([]);
  const [openReportMonthDialog, setOpenReportMonthDialog] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState(new Date());
  const [openExpenditureMonthDialog, setOpenExpenditureMonthDialog] = useState(false);
  const [selectedExpenditureMonth, setSelectedExpenditureMonth] = useState(new Date());
  const [openMonthDialog, setOpenMonthDialog] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDescription, setShowDescription] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [subbaraoOpen, setSubbaraoOpen] = useState(false);
  const [graphType, setGraphType] = useState('bar');
  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const shareRef = useRef();
  const dayShareRef = useRef();

  useEffect(() => {
    if (currentUser) {
      dispatch(fetchTransactionsForCurrentMonth());
      dispatch(fetchTodos());
    } else {
      dispatch(setTransactions([]));
    }
    // eslint-disable-next-line
  }, [currentUser]);

  // Fetch transactions when selected month changes
  useEffect(() => {
    if (currentUser) {
      const startDate = startOfMonth(selectedMonth);
      const endDate = endOfMonth(selectedMonth);
      dispatch(fetchTransactionsByMonth({ startDate, endDate }));
    }
    // eslint-disable-next-line
  }, [selectedMonth, currentUser]);

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

  // Prepare chart data for expenditure graph with proper filtering
  const chartData = useMemo(() => {
    // Filter out days with no transactions for cleaner line chart
    const filteredDays = dailyTransactions.filter(day => day.transactions.length > 0);
    
    return filteredDays.map(day => ({
      date: format(day.date, 'dd'),
      fullDate: format(day.date, 'yyyy-MM-dd'),
      expense: day.expense,
      income: day.income,
      transactions: day.transactions.length
    }));
  }, [dailyTransactions]);

  // Custom tooltip for expenditure graph with improved styling
  const ExpenditureTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box sx={{
          bgcolor: 'background.paper',
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          boxShadow: 4,
          minWidth: 200
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
            {data.fullDate}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' }} />
            <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
              Expense: ₹{Math.round(data.expense).toLocaleString('en-IN')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
              Income: ₹{Math.round(data.income).toLocaleString('en-IN')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Transactions: {data.transactions}
            </Typography>
          </Box>
        </Box>
      );
    }
    return null;
  };

  // Task statistics
  const taskStatistics = useMemo(() => {
    if (!todos || todos.length === 0) {
      return { pendingCount: 0 };
    }

    let pendingCount = 0;

    todos.forEach(todo => {
      if (!todo.completed) {
        pendingCount++; // Count all incomplete tasks
      }
    });

    console.log('Task Statistics:', { pendingCount });
    console.log('Todos:', todos);

    return { pendingCount };
  }, [todos]);

  const handleGenerateReport = () => {
    setOpenReportMonthDialog(true);
  };

  // Custom back button handler to prevent leaving home page
  const handleBackButton = useCallback((event) => {
    // Check if we're on the home page and prevent navigation
    if (window.location.pathname === '/') {
      event.preventDefault();
      // Stay on the same page by not navigating
      return;
    }
  }, []);

  // Set up back button listener when component mounts
  useEffect(() => {
    // Listen for popstate events (back button)
    window.addEventListener('popstate', handleBackButton);
    
    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [handleBackButton]);

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
              title: 'Financial Report',
              text: `Financial report for ${format(selectedReportMonth, 'MMMM yyyy')}`,
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

  const handleGenerateExpenditureList = () => {
    setOpenExpenditureMonthDialog(true);
  };

  const handleShareExpenditureList = async (reportData, fileName) => {
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
              title: 'Expenditure Analysis',
              text: `Expenditure analysis for ${format(selectedExpenditureMonth, 'MMMM yyyy')}`,
              files: [file]
            });
            
            setSuccess('Expenditure list shared successfully! 📱');
            return;
          }
        } catch (shareError) {
          console.log('Web Share API failed, falling back to download:', shareError);
        }
      }

      // Fallback to download if Web Share API is not available or fails
      reportData.save(fileName);
      setSuccess('Expenditure list downloaded successfully! 📱');
      
    } catch (err) {
      console.error('Share error:', err);
      setError(`Failed to share expenditure list: ${err.message}`);
    }
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

  const FinancialSummaryCard = () => (
    <Card sx={{ height: '100%', overflow: 'hidden', boxShadow: 3 }}>
      <Box sx={{ 
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        color: 'white',
        p: 2,
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <InsightsIcon sx={{ fontSize: 24, mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>
              FINANCIAL SUMMARY
            </Typography>
          </Box>
          <Box
            onClick={() => setOpenMonthDialog(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              opacity: 0.8,
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              cursor: 'pointer',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              px: 1.5,
              py: 0.5,
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255,255,255,0.2)',
              '&:hover': {
                opacity: 1,
                backgroundColor: 'rgba(255,255,255,0.2)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(255,255,255,0.1)',
                borderColor: 'rgba(255,255,255,0.4)'
              },
              '&:active': {
                transform: 'translateY(0)',
                boxShadow: 'none'
              }
            }}
          >
            <CalendarIcon sx={{ fontSize: 16, opacity: 0.8 }} />
            <Typography sx={{ fontWeight: 'bold' }}>
              {format(selectedMonth, 'MMM yyyy').toUpperCase()}
            </Typography>
            <Box
              component="span"
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.6)',
                ml: 0.5,
                animation: 'pulse 2s infinite'
              }}
            />
          </Box>
        </Box>
      </Box>
      
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          {/* Total Income */}
          <Grid item xs={6}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 4, 
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              minHeight: 90,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.15)'
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Total Income
                </Typography>
                <TrendingUpIcon color="success" sx={{ fontSize: 16 }} />
              </Box>
              <Typography 
                variant="h5" 
                color="success.main" 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '0.9rem', sm: '1.2rem' },
                  overflow: 'visible',
                  textOverflow: 'clip',
                  whiteSpace: 'normal',
                  fontFamily: 'monospace',
                  lineHeight: 1.1,
                  minHeight: { xs: '20px', sm: '26px' },
                  wordBreak: 'break-word',
                  textAlign: 'right',
                  width: '100%'
                }}
              >
                ₹{statistics.income.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>
                {filteredTransactions.length} transactions
              </Typography>
            </Box>
          </Grid>

          {/* Total Expenditure */}
          <Grid item xs={6}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 4, 
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              minHeight: 90,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Total Expense
                </Typography>
                <TrendingDownIcon color="error" sx={{ fontSize: 16 }} />
              </Box>
              <Typography 
                variant="h5" 
                color="error.main" 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '0.9rem', sm: '1.2rem' },
                  overflow: 'visible',
                  textOverflow: 'clip',
                  whiteSpace: 'normal',
                  fontFamily: 'monospace',
                  lineHeight: 1.1,
                  minHeight: { xs: '20px', sm: '26px' },
                  wordBreak: 'break-word',
                  textAlign: 'right',
                  width: '100%'
                }}
              >
                ₹{statistics.expenses.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>
                {dailyTransactions.filter(day => day.expense > 0).length} active days
              </Typography>
            </Box>
          </Grid>

          {/* Average Expenditure */}
          <Grid item xs={6}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 4, 
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              minHeight: 90,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Avg Daily Expense
                </Typography>
                <TrendingDownIcon color="warning" sx={{ fontSize: 16 }} />
              </Box>
              <Typography 
                variant="h5" 
                color="warning.main" 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '0.9rem', sm: '1.2rem' },
                  overflow: 'visible',
                  textOverflow: 'clip',
                  whiteSpace: 'normal',
                  fontFamily: 'monospace',
                  lineHeight: 1.1,
                  minHeight: { xs: '20px', sm: '26px' },
                  wordBreak: 'break-word',
                  textAlign: 'right',
                  width: '100%'
                }}
              >
                ₹{Math.round(statistics.avgDailyExpense).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>
                Per day
              </Typography>
            </Box>
          </Grid>

          {/* Remaining Balance */}
          <Grid item xs={6}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 4, 
              backgroundColor: statistics.savings >= 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${statistics.savings >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              minHeight: 90,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: statistics.savings >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                transform: 'translateY(-2px)',
                boxShadow: statistics.savings >= 0 ? '0 4px 12px rgba(34, 197, 94, 0.15)' : '0 4px 12px rgba(239, 68, 68, 0.15)'
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color={statistics.savings >= 0 ? 'success.main' : 'error.main'} sx={{ fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Remaining Balance
                </Typography>
                <EqualizerIcon color={statistics.savings >= 0 ? 'success' : 'error'} sx={{ fontSize: 16 }} />
              </Box>
              <Typography 
                variant="h5" 
                color={statistics.savings >= 0 ? 'success.main' : 'error.main'} 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: { xs: '0.9rem', sm: '1.2rem' },
                  overflow: 'visible',
                  textOverflow: 'clip',
                  whiteSpace: 'normal',
                  fontFamily: 'monospace',
                  lineHeight: 1.1,
                  minHeight: { xs: '20px', sm: '26px' },
                  wordBreak: 'break-word',
                  textAlign: 'right',
                  width: '100%'
                }}
              >
                ₹{statistics.savings.toLocaleString('en-IN')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>
                {statistics.savings >= 0 ? 'Surplus' : 'Deficit'} • {statistics.savingsRate.toFixed(1)}% rate
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
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
            const categoryKey = t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
            acc[categoryKey] = (acc[categoryKey] || 0) + Number(t.amount);
            return acc;
          }, {});
        
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Expense Category Analysis</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Detailed breakdown of expenses by category and subcategory
            </Typography>
            {Object.entries(categoryExpenses)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, p: 1, borderRadius: 1, backgroundColor: 'action.hover' }}>
                  <Typography variant="body2">{category}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>₹{amount.toLocaleString('en-IN')}</Typography>
                </Box>
              ))}
          </Box>
        );

      case 'top-categories':
        const topCategories = Object.entries(
          filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
              const categoryKey = t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
              acc[categoryKey] = (acc[categoryKey] || 0) + Number(t.amount);
              return acc;
            }, {})
        )
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Top Expense Categories</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Categories with highest expenditure for targeted cost optimization
            </Typography>
            {topCategories.map(([category, amount], index) => (
              <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, p: 1, borderRadius: 1, backgroundColor: 'action.hover' }}>
                <Typography variant="body2">{index + 1}. {category}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>₹{amount.toLocaleString('en-IN')}</Typography>
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
              const fileName = `financial_monthly_report_${format(selectedReportMonth, 'yyyy-MM')}.pdf`;
              await handleShareReport(doc, fileName);
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
          Generate & Share Report
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Add ExpenditureMonthDialog component
  const ExpenditureMonthDialog = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Month for Expenditure List</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            views={["year", "month"]}
            label="Select Month"
            minDate={new Date('2000-01-01')}
            maxDate={new Date('2100-12-31')}
            value={selectedExpenditureMonth}
            onChange={setSelectedExpenditureMonth}
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
              const startDate = startOfMonth(selectedExpenditureMonth);
              const endDate = endOfMonth(selectedExpenditureMonth);
              const transactions = await fetchTransactionsByDateRange(auth.currentUser.uid, startDate, endDate);
              const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
              const periodLabel = format(selectedExpenditureMonth, 'MMMM yyyy');
              const doc = generateCategoryAnalysisPDF(txs, periodLabel);
              const fileName = `expense_category_analysis_${format(selectedExpenditureMonth, 'yyyy-MM')}.pdf`;
              await handleShareExpenditureList(doc, fileName);
              onClose();
            } catch (err) {
              console.error('Error generating expenditure list:', err);
              setError(`Failed to generate expenditure list: ${err.message}`);
            } finally {
              setLoading(false);
            }
          }} 
          color="primary" 
          variant="contained"
        >
          Generate & Share Expenditure List
        </Button>
      </DialogActions>
    </Dialog>
  );

  const handleShare = async () => {
    if (!shareRef.current) return;
    const canvas = await html2canvas(shareRef.current, { backgroundColor: null, useCORS: true });
    canvas.toBlob(async (blob) => {
      if (blob && navigator.clipboard) {
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({ 'image/png': blob })
          ]);
          setSuccess('Image copied to clipboard!');
        } catch (err) {
          setError('Failed to copy image.');
        }
      } else {
        setError('Clipboard not supported.');
      }
    });
  };

  const handleDayClick = (dayData) => {
    if (dayData && dayData.date) {
      setSelectedDay(dayData);
      setDayModalOpen(true);
    }
  };

  const handleCloseDayModal = () => {
    setDayModalOpen(false);
    setSelectedDay(null);
  };

  const handleDayShare = async () => {
    if (!selectedDay) return;
    
    try {
      // Show loading state
      setSuccess('Generating PDF...');
      
      // Create new PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      
      // Helper function to format numbers
      const formatInt = (num) => {
        return Math.round(Number(num)).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
      };
      
      // Helper function to add section title
      const addSectionTitle = (title, y) => {
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42); // Deep navy
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, y);
        
        // Add underline
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(1);
        doc.line(margin, y + 2, margin + 80, y + 2);
        doc.setDrawColor(59, 130, 246); // Blue accent
        doc.setLineWidth(2);
        doc.line(margin, y + 4, margin + 80, y + 4);
        
        return y + 15;
      };
      
      let currentY = 30;
      
      // Professional header
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // Deep navy
      doc.setFont('helvetica', 'bold');
      const dateStr = selectedDay.date ? format(new Date(selectedDay.date), 'dd MMM yyyy') : 'Unknown Date';
      doc.text(`Daily Transaction Summary`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;
      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(dateStr, pageWidth / 2, currentY, { align: 'center' });
      currentY += 20;
      
      // Summary section with professional table
      currentY = addSectionTitle('SUMMARY', currentY);
      
      const income = Math.round(Number(selectedDay.dayIncome));
      const expense = Math.round(Number(selectedDay.dayExpense));
      const balance = income - expense;
      
      const summaryData = [
        ['Total Income', formatInt(income)],
        ['Total Expenses', formatInt(expense)],
        ['Net Balance', formatInt(balance)],
        ['Total Transactions', selectedDay.transactions.length.toString()],
      ];
      
      autoTable(doc, {
        startY: currentY,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], // Deep navy
          textColor: [255, 255, 255],
          fontSize: 11,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { 
          fontSize: 10,
          cellPadding: 6,
          textColor: [15, 23, 42]
        },
        columnStyles: { 
          0: { halign: 'left', fontStyle: 'bold' },
          1: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Light gray
        },
        margin: { left: margin, right: margin },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.5
      });
      
      currentY = doc.lastAutoTable.finalY + 15;
      
      // Transactions section with professional table
      currentY = addSectionTitle('TRANSACTION DETAILS', currentY);
      
      // Prepare transaction data
      const transactionData = selectedDay.transactions.map(transaction => {
        const category = transaction.subCategory ? `${transaction.category} - ${transaction.subCategory}` : transaction.category;
        const amount = formatInt(transaction.amount);
        const time = format(new Date(transaction.date), 'HH:mm');
        const type = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
        const description = transaction.description || '';
        
        return [
          time,
          category,
          type,
          amount,
          description
        ];
      });
      
      autoTable(doc, {
        startY: currentY,
        head: [['Time', 'Category', 'Type', 'Amount', 'Description']],
        body: transactionData,
        theme: 'grid',
        headStyles: { 
          fillColor: [59, 130, 246], // Professional blue
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { 
          fontSize: 9,
          cellPadding: 5,
          textColor: [15, 23, 42],
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 20 }, // Time
          1: { halign: 'left', cellWidth: 50 },   // Category
          2: { halign: 'center', cellWidth: 25 }, // Type
          3: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }, // Amount
          4: { halign: 'left', cellWidth: 45 }    // Description
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: margin, right: margin },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.5,
        didParseCell: function(data) {
          // Color code amounts based on transaction type
          if (data.column.index === 3) { // Amount column
            const transaction = selectedDay.transactions[data.row.index];
            if (transaction.type === 'income') {
              data.cell.styles.textColor = [46, 204, 113]; // Green
            } else {
              data.cell.styles.textColor = [239, 68, 68]; // Red
            }
          }
          // Color code transaction type
          if (data.column.index === 2) { // Type column
            const transaction = selectedDay.transactions[data.row.index];
            if (transaction.type === 'income') {
              data.cell.styles.textColor = [46, 204, 113]; // Green
            } else {
              data.cell.styles.textColor = [239, 68, 68]; // Red
            }
          }
        }
      });
      
      // Professional footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        // Footer text
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, margin, pageHeight - 5);
        doc.text('Common Man', pageWidth / 2, pageHeight - 5, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 5, { align: 'right' });
      }
      
      // Check if Web Share API is available (mobile devices)
      if (navigator.share && navigator.canShare) {
        try {
          // Convert PDF to blob for sharing
          const pdfBlob = doc.output('blob');
          const fileName = `day-summary-${selectedDay.date ? format(new Date(selectedDay.date), 'yyyy-MM-dd') : 'unknown'}.pdf`;
          
          // Create a File object for sharing
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          
          // Check if we can share this file
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Daily Transaction Summary',
              text: `Daily transaction summary for ${dateStr}`,
              files: [file]
            });
            
            setSuccess('Day summary shared successfully! 📱');
            return;
          }
        } catch (shareError) {
          console.log('Web Share API failed, falling back to download:', shareError);
        }
      }

      // Fallback to download if Web Share API is not available or fails
      const fileName = `day-summary-${selectedDay.date ? format(new Date(selectedDay.date), 'yyyy-MM-dd') : 'unknown'}.pdf`;
      doc.save(fileName);
      
      setSuccess('Day summary PDF downloaded successfully! 📱');
      
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(`Failed to generate PDF: ${err.message}`);
    }
  };

  // Handle graph sharing as image
  const handleGraphShare = async () => {
    try {
      // Find the graph container element
      const graphContainer = document.querySelector('.MuiDialog-root .MuiDialogContent-root');
      if (!graphContainer) {
        setError('Graph not found. Please try again.');
        return;
      }

      // Create a temporary container to capture the graph with its background
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.top = '0';
      tempContainer.style.left = '0';
      tempContainer.style.zIndex = '-9999';
      tempContainer.style.width = '800px';
      tempContainer.style.height = '500px';
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.padding = '20px';
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.fontFamily = 'Arial, sans-serif';
      
      // Clone the graph container
      const graphClone = graphContainer.cloneNode(true);
      tempContainer.appendChild(graphClone);
      document.body.appendChild(tempContainer);

      // Wait for the clone to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the graph as an image
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: 'white',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true
      });

      // Remove the temporary container
      document.body.removeChild(tempContainer);

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to create image. Please try again.');
          return;
        }

        // Create a filename
        const dateStr = format(selectedMonth, 'yyyy-MM');
        const fileName = `expenditure-analysis-${dateStr}.png`;

        // Check if Web Share API is available (mobile devices)
        if (navigator.share && navigator.canShare) {
          try {
            // Create a File object for sharing
            const file = new File([blob], fileName, { type: 'image/png' });
            
            // Check if we can share this file
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'Expenditure Analysis',
                text: `Expenditure analysis for ${format(selectedMonth, 'MMMM yyyy')}`,
                files: [file]
              });
              
              setSuccess('Graph shared successfully! 📱');
              return;
            }
          } catch (shareError) {
            console.log('Web Share API failed, falling back to download:', shareError);
          }
        }

        // Fallback to download if Web Share API is not available or fails
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setSuccess('Graph downloaded successfully! 📱');
        
      }, 'image/png', 0.9);
      
    } catch (err) {
      console.error('Graph sharing error:', err);
      setError(`Failed to share graph: ${err.message}`);
    }
  };

  return (
    <Box sx={{ p: isMobile ? 2 : 3, pb: isMobile ? 10 : 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FinancialSummaryCard />
        </Grid>
      </Grid>


      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          {/* Mobile: Compact action cards */}
          {isMobile ? (
            <>
      <Grid item xs={12}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => setGraphModalOpen(true)}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            py: 1.25,
            px: 1,
            minHeight: 48,
            fontSize: '0.85rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
            },
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
          }}
        >
          📈 View Analytics
        </Button>
      </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={loading ? <CircularProgress size={20} /> : <PdfIcon sx={{ fontSize: 20 }} />}
                  onClick={handleGenerateReport}
                  disabled={loading}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.25,
                    px: 1,
                    minHeight: 48,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderColor: 'primary.light',
                    color: 'primary.main',
                    backgroundColor: 'rgba(33, 150, 243, 0.05)',
                    '&:hover': {
                      backgroundColor: 'rgba(33, 150, 243, 0.1)',
                      borderColor: 'primary.main',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)',
                  }}
                >
                  Monthly Report
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PdfIcon sx={{ fontSize: 20 }} />}
                  onClick={handleGenerateExpenditureList}
                  disabled={loading}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.25,
                    px: 1,
                    minHeight: 48,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderColor: 'secondary.light',
                    color: 'secondary.main',
                    backgroundColor: 'rgba(156, 39, 176, 0.05)',
                    '&:hover': {
                      backgroundColor: 'rgba(156, 39, 176, 0.1)',
                      borderColor: 'secondary.main',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(156, 39, 176, 0.15)',
                  }}
                >
                  Expenditure List
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SmartToyIcon sx={{ fontSize: 20 }} />}
                  onClick={() => setSubbaraoOpen(true)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.25,
                    px: 1,
                    minHeight: 48,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #9c27b0 0%, #e91e63 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #7b1fa2 0%, #c2185b 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 15px rgba(156, 39, 176, 0.4)',
                    },
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)',
                  }}
                >
                  AI Assistant
                </Button>
              </Grid>
            </>
          ) : (
            /* Desktop: Original layout */
            <>
              <Grid item xs={12} md={4}>
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
                  Monthly Report
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PdfIcon />}
                  onClick={handleGenerateExpenditureList}
                  disabled={loading}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.5
                  }}
                >
                  Expenditure List
                </Button>
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SmartToyIcon />}
                  onClick={() => setSubbaraoOpen(true)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.5,
                    background: 'linear-gradient(45deg, #9c27b0 30%, #e91e63 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #7b1fa2 30%, #c2185b 90%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 25px rgba(156, 39, 176, 0.5)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  AI Assistant
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Financial Overview
        </Typography>
        {isMobile ? (
          // Mobile: Ultra-Advanced Premium Card/List layout
          <Box>
            {groupedTransactions.map(({ date, transactions, dayIncome, dayExpense }) => (
              <Box key={date} sx={{ 
                mb: 2, 
                borderRadius: 2.5, 
                overflow: 'hidden', 
                backgroundColor: 'background.paper', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid',
                borderColor: 'divider',
                backdropFilter: 'blur(10px)'
              }}>
                {/* Day Header with Clean Horizontal Industry Standard Design */}
                <Box 
                  sx={{ 
                    cursor: 'pointer',
                    p: 2,
                    backgroundColor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { 
                      backgroundColor: 'action.hover',
                    },
                    transition: 'background-color 0.2s ease',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      backgroundColor: 'primary.main'
                    }
                  }}
                  onClick={() => handleDayClick({ date, transactions, dayIncome, dayExpense })}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ 
                        fontWeight: 600, 
                        color: 'text.primary', 
                        fontSize: 18
                      }}>
                        {format(new Date(date), 'dd MMM yyyy')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
                      <Typography variant="body2" sx={{ 
                        color: 'success.main', 
                        fontWeight: 600, 
                        fontSize: 13
                      }}>
                        +₹{dayIncome.toLocaleString('en-IN')}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: 'error.main', 
                        fontWeight: 600, 
                        fontSize: 13
                      }}>
                        -₹{dayExpense.toLocaleString('en-IN')}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                
                {/* Transactions List - Premium Design */}
                <Box sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                  {transactions.map((txn, index) => (
                    <Box
                      key={txn.id}
                      sx={{
                        mb: index < transactions.length - 1 ? 0.75 : 0,
                        borderRadius: 2,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          transform: 'translateY(-1px)'
                        },
                        display: 'grid',
                        gridTemplateColumns: '6px 1fr',
                        gridTemplateRows: 'auto auto auto',
                        gap: 0
                      }}
                      onClick={() => { setSelectedTransaction(txn); setDetailsModalOpen(true); }}
                    >
                      {/* Type Indicator Stripe - Left edge with space */}
                      <Box sx={{ 
                        gridColumn: '1 / 2',
                        gridRow: '1 / 4',
                        backgroundColor: txn.type === 'income' ? 'success.main' : 'error.main',
                        borderTopLeftRadius: 2,
                        borderBottomLeftRadius: 2,
                        borderRight: '2px solid rgba(255,255,255,0.8)'
                      }} />
                      
                      {/* Main Content Area - Ultra Compact Unified Design */}
                      <Box sx={{ 
                        gridColumn: '2 / 3',
                        gridRow: '1 / 4',
                        p: 0.75,
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gridTemplateRows: 'auto auto',
                        gap: 0.25
                      }}>
                        {/* First Row: Title-Subtitle | Amount */}
                        <Box sx={{ 
                          gridColumn: '1 / 2',
                          gridRow: '1 / 2',
                          borderRadius: 1,
                          p: 0.15,
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <Box sx={{ 
                            overflow: 'auto',
                            whiteSpace: 'nowrap',
                            '&::-webkit-scrollbar': {
                              height: 2.5
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'rgba(0,0,0,0.05)',
                              borderRadius: 1
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: 1,
                              '&:hover': {
                                background: 'rgba(0,0,0,0.3)'
                              }
                            }
                          }}>
                            <Typography variant="subtitle1" sx={{ 
                              fontWeight: 600, 
                              color: 'text.primary', 
                              fontSize: 12.5,
                              minWidth: 'max-content'
                            }}>
                              {txn.subCategory ? `${txn.category} - ${txn.subCategory}` : txn.category}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ 
                          gridColumn: '2 / 3',
                          gridRow: '1 / 2',
                          borderRadius: 1,
                          p: 0.75,
                          minWidth: 75,
                          maxWidth: 110,
                          flexShrink: 1,
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <Box sx={{ 
                            overflow: 'auto',
                            whiteSpace: 'nowrap',
                            '&::-webkit-scrollbar': {
                              height: 3.5
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'rgba(0,0,0,0.05)',
                              borderRadius: 1.5
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: 1.5,
                              '&:hover': {
                                background: 'rgba(0,0,0,0.3)'
                              }
                            }
                          }}>
                            <Typography
                              variant="body1"
                              sx={{
                                color: 'text.primary',
                                fontWeight: 700,
                                fontSize: 13.5,
                                textAlign: 'right',
                                minWidth: 'max-content'
                              }}
                            >
                              ₹{Math.round(Number(txn.amount)).toLocaleString('en-IN')}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Second Row: Description | Edit | Delete */}
                        {txn.description && (
                          <Box sx={{ 
                            gridColumn: '1 / 2',
                            gridRow: '2 / 3',
                            borderRadius: 1,
                            p: 0.35,
                            maxHeight: 35,
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <Box sx={{ 
                              maxHeight: 25,
                              overflow: 'auto',
                              '&::-webkit-scrollbar': {
                                width: 2.5,
                                height: 2.5
                              },
                              '&::-webkit-scrollbar-track': {
                                background: 'rgba(0,0,0,0.05)',
                                borderRadius: 1
                              },
                              '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: 1,
                                '&:hover': {
                                  background: 'rgba(0,0,0,0.3)'
                                }
                              }
                            }}>
                              <Typography variant="body2" color="text.secondary" sx={{ 
                                fontSize: 10.5,
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                wordBreak: 'normal',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.15,
                                pr: 0.35
                              }}>
                                {txn.description}
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        <Box sx={{ 
                          gridColumn: '2 / 3',
                          gridRow: '2 / 3',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 0.35,
                          pr: 0.35
                        }}>
                          <IconButton
                            size="small"
                            onClick={e => { 
                              e.stopPropagation(); 
                              setEditTransaction(txn); 
                              setIsAddModalOpen(true); 
                            }}
                            sx={{ 
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: 'primary.light',
                              color: 'primary.contrastText',
                              '&:hover': { 
                                backgroundColor: 'primary.main',
                                transform: 'translateY(-1px)'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <EditIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={e => { 
                              e.stopPropagation(); 
                              setTransactionToDelete(txn); 
                              setDeleteDialogOpen(true); 
                            }}
                            sx={{ 
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              backgroundColor: 'error.light',
                              color: 'error.contrastText',
                              '&:hover': { 
                                backgroundColor: 'error.main',
                                transform: 'translateY(-1px)'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                  
                  {/* Empty state for day with no transactions */}
                  {transactions.length === 0 && (
                    <Box sx={{ 
                      textAlign: 'center', 
                      py: 3, 
                      color: 'text.secondary',
                      backgroundColor: 'background.paper',
                      borderRadius: 2,
                      border: '1px dashed',
                      borderColor: 'divider',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                        opacity: 0.5
                      }
                    }}>
                      <Typography variant="h6" sx={{ mb: 1, color: 'text.primary', fontWeight: 600 }}>
                        No transactions
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.7 }}>
                        Add your first transaction for this day
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
            
            {/* No transactions overall */}
            {groupedTransactions.length === 0 && (
              <Box sx={{ 
                textAlign: 'center', 
                py: 6, 
                color: 'text.secondary',
                backgroundColor: 'background.paper',
                borderRadius: 3,
                border: '2px dashed',
                borderColor: 'divider',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  opacity: 0.6
                }
              }}>
                <Typography variant="h5" sx={{ mb: 1, color: 'text.primary', fontWeight: 700 }}>
                  No transactions found
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.8 }}>
                  Add your first transaction to get started
                </Typography>
                <Box sx={{ 
                  mt: 3,
                  display: 'inline-block',
                  padding: 2,
                  borderRadius: 50,
                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  border: '1px solid rgba(33, 150, 243, 0.3)'
                }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '1px' }}>
                    + ADD TRANSACTION
                  </Typography>
                </Box>
              </Box>
            )}
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
                            <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>Income: ₹{dayIncome.toLocaleString('en-IN')}</Box> |
                            <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>Expense: ₹{dayExpense.toLocaleString('en-IN')}</Box>
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
                    <TableCell>
                      {txn.subCategory ? `${txn.category} - ${txn.subCategory}` : txn.category}
                    </TableCell>
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
          Professional Financial Analysis
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
            <MenuItem value="category-breakdown">Expense Category Analysis</MenuItem>
            <MenuItem value="top-categories">Top Expense Categories</MenuItem>
            <MenuItem value="savings-analysis">Savings & Investment Analysis</MenuItem>
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

  {/* Todo Button - Always Visible */}
      <Box sx={{ position: 'fixed', bottom: 16, left: 16, zIndex: 1000 }}>
        <Fab
          color="primary"
          sx={{ 
            bgcolor: 'linear-gradient(45deg, #2196f3 30%, #21cbf3 90%)',
            '&:hover': {
              bgcolor: 'linear-gradient(45deg, #1976d2 30%, #00bcd4 90%)',
              transform: 'scale(1.1)',
            },
            transition: 'all 0.3s ease',
            boxShadow: '0 6px 25px rgba(33, 150, 243, 0.5)',
            position: 'relative',
            minWidth: 60,
            minHeight: 60
          }}
          onClick={() => navigate('/todo')}
        >
          📋
          {/* Always show badge with actual count */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: taskStatistics.pendingCount > 0 ? 'error.main' : 'grey.500',
              color: 'white',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              animation: taskStatistics.pendingCount > 0 ? 'pulse 2s infinite' : 'none',
              zIndex: 1001,
              border: '2px solid white'
            }}
          >
            {taskStatistics.pendingCount}
          </Box>
        </Fab>
      </Box>

      {/* AI Assistant */}
        <SubbaraoChat
          transactions={transactions}
          selectedMonth={selectedMonth}
          isOpen={subbaraoOpen}
          onClose={() => setSubbaraoOpen(!subbaraoOpen)}
        />

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
              await dispatch(deleteTransactionAsync({ id: transactionToDelete.id }));
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

      {/* Add the ExpenditureMonthDialog to the JSX */}
      <ExpenditureMonthDialog
        open={openExpenditureMonthDialog}
        onClose={() => setOpenExpenditureMonthDialog(false)}
      />

      {/* Add the MonthDialog to the JSX */}
      <Dialog 
        open={openMonthDialog} 
        onClose={() => setOpenMonthDialog(false)} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', pb: 1 }}>
          Select Month & Year
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              views={["year", "month"]}
              label="Choose Month"
              minDate={new Date('2000-01-01')}
              maxDate={new Date('2100-12-31')}
              value={selectedMonth}
              onChange={(newDate) => {
                setSelectedMonth(newDate);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  sx={{ 
                    mt: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: 'grey.50',
                      },
                      '&.Mui-focused': {
                        backgroundColor: 'grey.50',
                      }
                    }
                  }}
                />
              )}
            />
          </LocalizationProvider>
          
          {/* Navigation buttons - simple layout */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                const prevMonth = new Date(selectedMonth);
                prevMonth.setMonth(prevMonth.getMonth() - 1);
                setSelectedMonth(prevMonth);
              }}
              sx={{
                minWidth: 40,
                px: 1,
                py: 0.5,
                fontSize: '1rem'
              }}
            >
              ←
            </Button>
            <Typography variant="body1" sx={{ fontWeight: 'bold', minWidth: 120, textAlign: 'center' }}>
              {format(selectedMonth, 'MMM - yyyy')}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                const nextMonth = new Date(selectedMonth);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                setSelectedMonth(nextMonth);
              }}
              sx={{
                minWidth: 40,
                px: 1,
                py: 0.5,
                fontSize: '1rem'
              }}
            >
              →
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button 
            onClick={() => setOpenMonthDialog(false)} 
            color="inherit"
            variant="outlined"
            sx={{
              borderRadius: 1,
              px: 2,
              py: 0.75,
              fontWeight: 'bold'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => setOpenMonthDialog(false)} 
            variant="contained"
            sx={{
              borderRadius: 1,
              px: 2,
              py: 0.75,
              fontWeight: 'bold',
              backgroundColor: 'primary.main',
              color: 'white'
            }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transaction Details Modal */}
      <Dialog
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        TransitionComponent={Fade}
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: 6 }, onClick: (e) => e.stopPropagation() }}
        BackdropProps={{
          onClick: (e) => {
            // Only close if not clicking inside the dialog or on action buttons
            if (e.target.classList.contains('MuiBackdrop-root')) {
              setDetailsModalOpen(false);
            }
          },
          style: { cursor: 'pointer' },
        }}
      >
        {/* Accent bar */}
        <Box sx={{ height: 6, bgcolor: selectedTransaction?.type === 'income' ? 'success.main' : 'error.main' }} />
        <div
          ref={shareRef}
          style={{ background: 'white' }}
          onClick={e => {
            // If the click is on the dialog but not on Edit, Delete, or Share buttons, close the popup
            const isActionBtn = e.target.closest('.popup-action-btn');
            if (!isActionBtn) {
              setDetailsModalOpen(false);
            }
          }}
        >
          <DialogTitle sx={{ textAlign: 'center', fontWeight: 700, fontSize: 22, mt: 1 }}>
            Transaction Details
            {selectedTransaction && (
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
                {selectedTransaction.category}
                {selectedTransaction.subCategory && ` / ${selectedTransaction.subCategory}`}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent sx={{ p: 3, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {selectedTransaction && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>
                <Chip
                  label={selectedTransaction.type.charAt(0).toUpperCase() + selectedTransaction.type.slice(1)}
                  color={selectedTransaction.type === 'income' ? 'success' : 'error'}
                  sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}
                />
                <Box sx={{
                  background: selectedTransaction.type === 'income'
                    ? 'linear-gradient(90deg, #e0ffe0, #fff)'
                    : 'linear-gradient(90deg, #ffe0e0, #fff)',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  textAlign: 'center',
                  minWidth: 120,
                  boxShadow: 1,
                  animation: 'pulse 1.2s infinite alternate',
                  mb: 1.5,
                }}>
                  <Typography fontWeight={900} color={selectedTransaction.type === 'income' ? 'success.main' : 'error.main'} fontSize={28}>
                    ₹{Number(selectedTransaction.amount).toLocaleString('en-IN')}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {format(new Date(selectedTransaction.date), 'dd MMM yyyy, HH:mm')}
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mb: 1 }}>
                  <Chip label={selectedTransaction.category} variant="outlined" />
                  {selectedTransaction.subCategory && <Chip label={selectedTransaction.subCategory} variant="outlined" color="default" />}
                </Stack>
                {selectedTransaction.description && (
                  <Box sx={{ bgcolor: 'grey.100', borderRadius: 1, p: 2, mt: 1, width: '100%', maxWidth: 400, textAlign: 'center', boxSizing: 'border-box' }}>
                    <Typography fontStyle="italic" color="text.secondary">{selectedTransaction.description}</Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
        </div>
        <DialogActions sx={{ p: 2, pt: 1, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            {/* Edit: leftmost */}
            <Tooltip title="Edit">
              <Fab size="small" color="primary" className="popup-action-btn" sx={{ ml: { xs: 0, sm: 2 } }} onClick={e => { e.stopPropagation(); setDetailsModalOpen(false); setEditTransaction(selectedTransaction); setIsAddModalOpen(true); }} aria-label="Edit transaction">
                <EditIcon />
              </Fab>
            </Tooltip>
            {/* Delete: center */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <Tooltip title="Delete">
                <Fab size="small" color="error" className="popup-action-btn" onClick={e => { e.stopPropagation(); setDetailsModalOpen(false); setTransactionToDelete(selectedTransaction); setDeleteDialogOpen(true); }} aria-label="Delete transaction">
                  <DeleteIcon />
                </Fab>
              </Tooltip>
            </Box>
            {/* Share: rightmost */}
            <Tooltip title="Share">
              <Fab size="small" color="secondary" className="popup-action-btn" sx={{ mr: { xs: 0, sm: 2 } }} onClick={async e => { e.stopPropagation(); await handleShare(); }} aria-label="Share transaction">
                <ShareIcon />
              </Fab>
            </Tooltip>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Graph Modal - Professional Recharts Implementation */}
      <Dialog
        open={graphModalOpen}
        onClose={() => setGraphModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            maxWidth: isMobile ? '95vw' : '900px',
            maxHeight: isMobile ? '90vh' : '80vh'
          }
        }}
        BackdropProps={{
          onClick: (e) => {
            if (e.target.classList.contains('MuiBackdrop-root')) {
              setGraphModalOpen(false);
            }
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1,
          bgcolor: 'primary.main',
          color: 'white'
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: isMobile ? '16px' : '18px' }}>
              Expenditure Analysis
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, fontSize: isMobile ? '11px' : '12px' }}>
              {format(selectedMonth, 'MMMM yyyy')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton 
              onClick={() => setGraphModalOpen(false)} 
              sx={{ color: 'white' }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: isMobile ? 2 : 3, bgcolor: 'background.paper' }}>
          {/* Professional Recharts Graph */}
          <Box sx={{ 
            height: isMobile ? 300 : 400, 
            width: '100%',
            mb: 2
          }}>
            <ResponsiveContainer width="100%" height="100%">
              {graphType === 'bar' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    fontSize={isMobile ? 10 : 12}
                    tickMargin={10}
                    axisLine={{ stroke: '#9ca3af' }}
                    tickLine={{ stroke: '#9ca3af' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={isMobile ? 10 : 12}
                    tickMargin={10}
                    axisLine={{ stroke: '#9ca3af' }}
                    tickLine={{ stroke: '#9ca3af' }}
                    tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <RechartsTooltip content={<ExpenditureTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ fill: '#ef4444', stroke: '#ef4444', strokeWidth: 3, r: 6 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                </LineChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    fontSize={isMobile ? 10 : 12}
                    tickMargin={10}
                    axisLine={{ stroke: '#9ca3af' }}
                    tickLine={{ stroke: '#9ca3af' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={isMobile ? 10 : 12}
                    tickMargin={10}
                    axisLine={{ stroke: '#9ca3af' }}
                    tickLine={{ stroke: '#9ca3af' }}
                    tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <RechartsTooltip content={<ExpenditureTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', stroke: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ fill: '#ef4444', stroke: '#ef4444', strokeWidth: 3, r: 6 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </Box>

          {/* Graph Stats */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mt: 1,
            pt: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexWrap: 'wrap',
            gap: 1
          }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label={`Max: ₹${Math.round(Math.max(...dailyTransactions.map(d => d.expense), 0)).toLocaleString('en-IN')}`}
                variant="outlined"
                size="small"
                color="error"
                sx={{ fontSize: isMobile ? '10px' : '11px' }}
              />
              <Chip 
                label={`Avg: ₹${Math.round(statistics.avgDailyExpense).toLocaleString('en-IN')}`}
                variant="outlined"
                size="small"
                color="warning"
                sx={{ fontSize: isMobile ? '10px' : '11px' }}
              />
              <Chip 
                label={`Days: ${dailyTransactions.filter(d => d.expense > 0).length}`}
                variant="outlined"
                size="small"
                color="info"
                sx={{ fontSize: isMobile ? '10px' : '11px' }}
              />
              <Chip 
                label={`Total: ₹${Math.round(statistics.expenses).toLocaleString('en-IN')}`}
                variant="outlined"
                size="small"
                color="primary"
                sx={{ fontSize: isMobile ? '10px' : '11px' }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: isMobile ? '10px' : '12px' }}>
              Click points to view day details
            </Typography>
          </Box>
        </DialogContent>

        {/* Graph Modal Actions */}
        <DialogActions sx={{ 
          p: isMobile ? 2 : 3, 
          bgcolor: 'background.paper',
          justifyContent: 'space-between',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Button 
            onClick={() => setGraphModalOpen(false)} 
            color="inherit"
            sx={{ 
              textTransform: 'none',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 600
            }}
          >
            Close
          </Button>
          <Button 
            onClick={handleGraphShare} 
            variant="contained" 
            startIcon={<ShareIcon />}
            sx={{ 
              textTransform: 'none',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 600,
              bgcolor: '#1976d2',
              '&:hover': {
                bgcolor: '#1565c0'
              },
              px: isMobile ? 2 : 3,
              py: isMobile ? 1 : 1.25
            }}
          >
            {isMobile ? '📱 Share Image' : 'Share Image'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Day Details Modal */}
      <Dialog
        open={dayModalOpen}
        onClose={handleCloseDayModal}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        TransitionComponent={Fade}
        PaperProps={{ 
          sx: { 
            borderRadius: isMobile ? 0 : 3, 
            overflow: 'hidden',
            maxHeight: '90vh'
          } 
        }}
        BackdropProps={{
          onClick: (e) => {
            if (e.target.classList.contains('MuiBackdrop-root')) {
              handleCloseDayModal();
            }
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1,
          bgcolor: 'primary.main',
          color: 'white'
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: isMobile ? '18px' : '20px' }}>
              {selectedDay && selectedDay.date && (() => {
                try {
                  return format(new Date(selectedDay.date), 'dd MMM yyyy');
                } catch (e) {
                  return 'Invalid Date';
                }
              })()}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, fontSize: isMobile ? '12px' : '14px' }}>
              {selectedDay && selectedDay.transactions.length} transaction{selectedDay && selectedDay.transactions.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <IconButton 
            onClick={handleCloseDayModal} 
            sx={{ color: 'white' }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: 'background.paper', maxHeight: '75vh', overflow: 'auto' }}>
          <div ref={dayShareRef} style={{ 
            background: 'white', 
            padding: isMobile ? '8px' : '16px',
            minHeight: '400px',
            maxWidth: '100%',
            overflow: 'hidden'
          }}>
            {/* Day Summary Header - optimized for any number of transactions */}
            <Box sx={{ 
              textAlign: 'center', 
              mb: selectedDay && selectedDay.transactions.length > 5 ? 1.5 : 2,
              p: isMobile ? 1.2 : 2,
              bgcolor: 'grey.50',
              borderRadius: 2,
              border: '1px solid #e0e0e0'
            }}>
              <Typography variant="h5" sx={{ 
                fontWeight: 'bold', 
                mb: 1,
                fontSize: isMobile ? '16px' : '18px',
                color: '#1976d2'
              }}>
                {selectedDay && selectedDay.date && (() => {
                  try {
                    return format(new Date(selectedDay.date), 'dd MMM yyyy');
                  } catch (e) {
                    return 'Invalid Date';
                  }
                })()}
              </Typography>
              
              {/* Compact summary for many transactions, detailed for few */}
              {selectedDay && selectedDay.transactions.length <= 5 ? (
                <Stack 
                  direction={isMobile ? "column" : "row"} 
                  spacing={isMobile ? 1 : 2} 
                  justifyContent="center" 
                  sx={{ mb: 1 }}
                >
                  <Box sx={{ textAlign: 'center', minWidth: isMobile ? 'auto' : '70px' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '11px' : '12px' }}>
                      Income
                    </Typography>
                    <Typography variant="h6" color="success.main" sx={{ 
                      fontWeight: 'bold',
                      fontSize: isMobile ? '14px' : '16px'
                    }}>
                      ₹{selectedDay && Math.round(Number(selectedDay.dayIncome)).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', minWidth: isMobile ? 'auto' : '70px' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '11px' : '12px' }}>
                      Expense
                    </Typography>
                    <Typography variant="h6" color="error.main" sx={{ 
                      fontWeight: 'bold',
                      fontSize: isMobile ? '14px' : '16px'
                    }}>
                      ₹{selectedDay && Math.round(Number(selectedDay.dayExpense)).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', minWidth: isMobile ? 'auto' : '70px' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '11px' : '12px' }}>
                      Balance
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: isMobile ? '14px' : '16px',
                        color: selectedDay && (selectedDay.dayIncome - selectedDay.dayExpense) >= 0 ? 'success.main' : 'error.main'
                      }}
                    >
                      ₹{selectedDay && Math.round(Number(selectedDay.dayIncome - selectedDay.dayExpense)).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '11px' : '12px', mb: 0.5 }}>
                    {selectedDay && selectedDay.transactions.length} transactions
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 'bold',
                    fontSize: isMobile ? '14px' : '16px',
                    color: selectedDay && (selectedDay.dayIncome - selectedDay.dayExpense) >= 0 ? 'success.main' : 'error.main'
                  }}>
                    Net: ₹{selectedDay && Math.round(Number(selectedDay.dayIncome - selectedDay.dayExpense)).toLocaleString('en-IN')}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Transactions List - optimized for any number of transactions */}
            {selectedDay && selectedDay.transactions.length > 0 ? (
              <Box sx={{ 
                maxHeight: selectedDay.transactions.length > 10 ? '300px' : 'none',
                overflowY: selectedDay.transactions.length > 10 ? 'auto' : 'visible'
              }}>
                {selectedDay.transactions.map((transaction, index) => (
                  <Box
                    key={transaction.id}
                    sx={{
                      p: isMobile ? 1 : 1.5,
                      mb: index < selectedDay.transactions.length - 1 ? 0.5 : 0,
                      borderRadius: 1,
                      backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                      border: '1px solid #e0e0e0',
                      borderLeft: `3px solid ${transaction.type === 'income' ? '#4caf50' : '#f44336'}`,
                      minHeight: isMobile ? '60px' : '70px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    {/* Main transaction info - compact layout */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      width: '100%',
                      mb: 0.3
                    }}>
                      <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                        <Typography variant="body1" sx={{ 
                          fontWeight: 600,
                          fontSize: isMobile ? '13px' : '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2,
                          color: '#333'
                        }}>
                          {transaction.subCategory ? `${transaction.category} - ${transaction.subCategory}` : transaction.category}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          fontSize: isMobile ? '10px' : '11px',
                          mt: 0.1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}>
                          <span>{format(new Date(transaction.date), 'HH:mm')}</span>
                          <span>•</span>
                          <span style={{ 
                            color: transaction.type === 'income' ? '#4caf50' : '#f44336',
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {transaction.type}
                          </span>
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5,
                        flexShrink: 0
                      }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: transaction.type === 'income' ? 'success.main' : 'error.main',
                            fontWeight: 'bold',
                            fontSize: isMobile ? '13px' : '14px'
                          }}
                        >
                          ₹{Math.round(Number(transaction.amount)).toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Description - only show if exists and not too many transactions */}
                    {transaction.description && selectedDay.transactions.length <= 15 && (
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        width: '100%',
                        mt: 0.2
                      }}>
                        <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                              fontSize: isMobile ? '10px' : '11px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.1,
                              fontStyle: 'italic'
                            }}
                          >
                            {transaction.description}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 4,
                color: 'text.secondary'
              }}>
                <Typography variant="body1" sx={{ fontSize: isMobile ? '14px' : '16px' }}>
                  No transactions for this day
                </Typography>
              </Box>
            )}
          </div>
        </DialogContent>

        <DialogActions sx={{ 
          p: isMobile ? 1.5 : 2, 
          bgcolor: 'background.paper',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1 : 0,
          borderTop: '1px solid #e0e0e0'
        }}>
          <Button 
            onClick={handleCloseDayModal} 
            color="inherit"
            sx={{ 
              textTransform: 'none',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 2 : 1,
              minHeight: isMobile ? '44px' : '36px',
              fontSize: isMobile ? '14px' : '13px',
              fontWeight: 600
            }}
          >
            Close
          </Button>
          <Button 
            onClick={handleDayShare} 
            variant="contained" 
            startIcon={<ShareIcon />}
            sx={{ 
              textTransform: 'none',
              width: isMobile ? '100%' : 'auto',
              order: isMobile ? 1 : 2,
              minHeight: isMobile ? '44px' : '36px',
              fontSize: isMobile ? '14px' : '13px',
              fontWeight: 600,
              bgcolor: '#1976d2',
              '&:hover': {
                bgcolor: '#1565c0'
              }
            }}
          >
            {isMobile ? '📱 Share PDF' : 'Download PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Home;
