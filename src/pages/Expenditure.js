import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { selectTransactions, addTransaction, updateTransaction, deleteTransaction } from '../store/transactionSlice';
import { format } from 'date-fns';

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

const Expenditure = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const transactions = useSelector(selectTransactions);
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

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions]);

  const expenses = useMemo(() => {
    return sortedTransactions.filter(t => t.type === 'expense');
  }, [sortedTransactions]);

  const income = useMemo(() => {
    return sortedTransactions.filter(t => t.type === 'income');
  }, [sortedTransactions]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [expenses]);

  const totalIncome = useMemo(() => {
    return income.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [income]);

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
      } else {
        dispatch(addTransaction({
          ...formData,
          id: Date.now(),
          date: new Date().toISOString(),
          amount: Number(formData.amount),
        }));
        setSuccess('Transaction added successfully!');
      }
      handleClose();
    } catch (err) {
      setError('Failed to save transaction');
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

  const TransactionTable = ({ transactions }) => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}</TableCell>
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
  );

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      <Typography variant="h4" gutterBottom>
        Expenditure Management
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h4" color="primary">
                ₹{totalIncome.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Expenses
              </Typography>
              <Typography variant="h4" color="error">
                ₹{totalExpenses.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Net Balance
              </Typography>
              <Typography variant="h4" color={totalIncome - totalExpenses >= 0 ? 'success.main' : 'error.main'}>
                ₹{(totalIncome - totalExpenses).toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="All Transactions" />
          <Tab label="Income" />
          <Tab label="Expenses" />
        </Tabs>
      </Box>

      {activeTab === 0 && <TransactionTable transactions={sortedTransactions} />}
      {activeTab === 1 && <TransactionTable transactions={income} />}
      {activeTab === 2 && <TransactionTable transactions={expenses} />}

      <Button
        variant="contained"
        color="primary"
        onClick={() => setOpenDialog(true)}
        sx={{ mt: 3 }}
      >
        Add New Transaction
      </Button>

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

export default Expenditure; 