import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { addTransactionToDB, updateTransactionInDB, deleteTransactionFromDB, subscribeToTransactions, fetchTransactionsByDateRange, fetchAllTransactions } from '../firebase/transactions';
import { auth } from '../firebase/config';

const initialState = {
  transactions: [],
  loading: false,
  error: null
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (_, { dispatch }) => {
    const uid = auth.currentUser.uid;
    try {
      // Fetch all transactions using the new structure
      const transactions = await fetchAllTransactions(uid);
      const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
      dispatch(setTransactions(txs));
      return txs;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
);

export const fetchTransactionsForCurrentMonth = createAsyncThunk(
  'transactions/fetchTransactionsForCurrentMonth',
  async (_, { dispatch }) => {
    const uid = auth.currentUser.uid;
    try {
      // Get current month range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Fetch transactions for current month
      const transactions = await fetchTransactionsByDateRange(uid, startDate, endDate);
      const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
      dispatch(setTransactions(txs));
      return txs;
    } catch (error) {
      console.error('Error fetching transactions for current month:', error);
      throw error;
    }
  }
);

export const fetchTransactionsByMonth = createAsyncThunk(
  'transactions/fetchTransactionsByMonth',
  async ({ startDate, endDate }, { dispatch }) => {
    const uid = auth.currentUser.uid;
    try {
      const transactions = await fetchTransactionsByDateRange(uid, startDate, endDate);
      const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
      dispatch(setTransactions(txs));
      return txs;
    } catch (error) {
      console.error('Error fetching transactions by date range:', error);
      throw error;
    }
  }
);

export const addTransactionAsync = createAsyncThunk(
  'transactions/addTransactionAsync',
  async (transaction, { dispatch, getState }) => {
    const uid = auth.currentUser.uid;
    try {
      // Add transaction to Firebase
      await addTransactionToDB(uid, transaction);
      
      // Get current state to determine which transactions to fetch
      const currentState = getState();
      const currentTransactions = currentState.transactions.transactions;
      
      // Determine if we need to fetch transactions for the current month
      // Check if the new transaction's date falls within the currently displayed month
      const newTransactionDate = new Date(transaction.date);
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const transactionMonth = newTransactionDate.getMonth();
      const transactionYear = newTransactionDate.getFullYear();
      
      // If the transaction is for the current month, refresh the current month's transactions
      if (transactionMonth === currentMonth && transactionYear === currentYear) {
        // Fetch transactions for current month to include the new transaction
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const transactions = await fetchTransactionsByDateRange(uid, startDate, endDate);
        const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
        dispatch(setTransactions(txs));
        return { transaction, updatedTransactions: txs };
      } else {
        // For transactions in other months, just add to the existing state
        const updatedTransactions = [...currentTransactions, { 
          ...transaction, 
          id: transaction.id || Date.now().toString() // Ensure we have an ID
        }];
        dispatch(setTransactions(updatedTransactions));
        return { transaction, updatedTransactions };
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }
);

export const updateTransactionAsync = createAsyncThunk(
  'transactions/updateTransactionAsync',
  async ({ id, transaction }) => {
    const uid = auth.currentUser.uid;
    await updateTransactionInDB(uid, id, transaction);
    return { id, transaction };
  }
);

export const deleteTransactionAsync = createAsyncThunk(
  'transactions/deleteTransactionAsync',
  async ({ id, monthYearPath }) => {
    const uid = auth.currentUser.uid;
    await deleteTransactionFromDB(uid, id, monthYearPath);
    return id;
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    },
    resetTransactions: (state) => {
      state.transactions = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTransactions.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchTransactionsByMonth.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTransactionsByMonth.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(fetchTransactionsByMonth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(deleteTransactionAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteTransactionAsync.fulfilled, (state, action) => {
        state.loading = false;
        // Remove the deleted transaction from the state
        state.transactions = state.transactions.filter(txn => txn.id !== action.payload);
      })
      .addCase(deleteTransactionAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(updateTransactionAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateTransactionAsync.fulfilled, (state, action) => {
        state.loading = false;
        // Update the transaction in the state
        const index = state.transactions.findIndex(txn => txn.id === action.payload.id);
        if (index !== -1) {
          state.transactions[index] = { ...state.transactions[index], ...action.payload.transaction };
        }
      })
      .addCase(updateTransactionAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(addTransactionAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(addTransactionAsync.fulfilled, (state) => {
        state.loading = false;
        // State is updated within the thunk itself based on the transaction date
      })
      .addCase(addTransactionAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add transaction';
        console.error('addTransactionAsync rejected:', action.error);
      });
  }
});

export const { setTransactions, resetTransactions } = transactionSlice.actions;
export default transactionSlice.reducer; 