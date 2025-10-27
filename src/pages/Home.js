import React, { useMemo, useState, useEffect, useRef } from 'react';
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
} from '@mui/material';
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
import { addTransactionAsync, fetchTransactions, setTransactions, deleteTransactionAsync, updateTransactionAsync } from '../store/transactionSlice';
import { fetchTransactionsByDateRange } from '../firebase/transactions';
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
  const shareRef = useRef();
  const dayShareRef = useRef();

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
            title="Average Expenditure"
            value={Math.round(statistics.avgDailyExpense)}
            icon={<TrendingDownIcon color="warning" />}
            color="warning.main"
            subtitle="Per day"
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
        </Grid>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Financial Overview
        </Typography>
        {isMobile ? (
          // Mobile: Card/List layout
          <Box>
            {groupedTransactions.map(({ date, transactions, dayIncome, dayExpense }) => (
              <Box key={date} sx={{ mb: 2, p: 2, borderRadius: 2, backgroundColor: 'background.paper', boxShadow: 1 }}>
                <Box 
                  sx={{ 
                    cursor: 'pointer',
                    p: 1,
                    borderRadius: 1,
                    '&:hover': { backgroundColor: 'action.hover' },
                    mb: 1
                  }}
                  onClick={() => handleDayClick({ date, transactions, dayIncome, dayExpense })}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{format(new Date(date), 'dd MMM yyyy')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>Income: ₹{dayIncome.toLocaleString('en-IN')}</Box> |
                    <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>Expense: ₹{dayExpense.toLocaleString('en-IN')}</Box>
                  </Typography>
                  <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5, fontSize: '11px' }}>
                    Tap to view all transactions
                  </Typography>
                </Box>
                {transactions.map((txn) => (
                  <Box
                    key={txn.id}
                    sx={{
                      mb: 1.2,
                      py: 0.6,
                      px: 1.2,
                      borderRadius: 2.5,
                      backgroundColor: 'background.paper',
                      boxShadow: 3,
                      minWidth: 0,
                      overflow: 'visible',
                      position: 'relative',
                      borderLeft: `4px solid ${txn.type === 'income' ? theme.palette.success.main : theme.palette.error.main}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.1,
                      cursor: 'pointer',
                    }}
                    onClick={() => { setSelectedTransaction(txn); setDetailsModalOpen(true); }}
                  >
                    {/* First line: Category/Subcategory */}
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {txn.subCategory ? `${txn.category} - ${txn.subCategory}` : txn.category}
                    </Typography>
                    {/* Second line: Amount (left) and Actions (right) */}
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', mt: 0.1 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          color: txn.type === 'income' ? 'success.main' : 'error.main',
                          fontWeight: 800,
                          fontSize: 15,
                          letterSpacing: 0.2,
                          ml: 0.7,
                        }}
                      >
                        {Math.round(Number(txn.amount)).toLocaleString('en-IN')}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Box sx={{ display: 'flex', gap: 0.2 }}>
                        <Button size="small" onClick={e => { e.stopPropagation(); setEditTransaction(txn); setIsAddModalOpen(true); }} sx={{ minWidth: 'auto', p: 0.35, borderRadius: '50%', bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}>
                          <span role="img" aria-label="edit">✏️</span>
                        </Button>
                        <Button size="small" color="error" onClick={e => { e.stopPropagation(); setTransactionToDelete(txn); setDeleteDialogOpen(true); }} sx={{ minWidth: 'auto', p: 0.35, borderRadius: '50%', bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}>
                          <span role="img" aria-label="delete">🗑️</span>
                        </Button>
                      </Box>
                    </Box>
                    {/* Optional: Third line for description, very small */}
                    {txn.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.05, ml: 1.2, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {txn.description}
                      </Typography>
                    )}
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

  {/* Subbarao Chat Button */}
      <Fab
        color="secondary"
        sx={{ 
          position: 'fixed', 
          bottom: isMobile ? 16 : 24, 
          left: isMobile ? 16 : 24, 
          zIndex: 1000,
          bgcolor: 'linear-gradient(45deg, #9c27b0 30%, #e91e63 90%)',
          '&:hover': {
            bgcolor: 'linear-gradient(45deg, #7b1fa2 30%, #c2185b 90%)',
            transform: 'scale(1.1)',
          },
          transition: 'all 0.3s ease',
          boxShadow: '0 6px 25px rgba(156, 39, 176, 0.5)',
        }}
  onClick={() => setSubbaraoOpen(!subbaraoOpen)}
      >
        <SmartToyIcon />
      </Fab>

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

      {/* Add the ExpenditureMonthDialog to the JSX */}
      <ExpenditureMonthDialog
        open={openExpenditureMonthDialog}
        onClose={() => setOpenExpenditureMonthDialog(false)}
      />

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
              <Fab size="small" color="primary" className="popup-action-btn" sx={{ ml: { xs: 0, sm: 2 } }} onClick={e => { e.stopPropagation(); setDetailsModalOpen(false); setEditTransaction(selectedTransaction); setIsAddModalOpen(true); }}>
                <EditIcon />
              </Fab>
            </Tooltip>
            {/* Delete: center */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <Tooltip title="Delete">
                <Fab size="small" color="error" className="popup-action-btn" onClick={e => { e.stopPropagation(); setDetailsModalOpen(false); setTransactionToDelete(selectedTransaction); setDeleteDialogOpen(true); }}>
                  <DeleteIcon />
                </Fab>
              </Tooltip>
            </Box>
            {/* Share: rightmost */}
            <Tooltip title="Share">
              <Fab size="small" color="secondary" className="popup-action-btn" sx={{ mr: { xs: 0, sm: 2 } }} onClick={async e => { e.stopPropagation(); await handleShare(); }}>
                <ShareIcon />
              </Fab>
            </Tooltip>
          </Box>
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