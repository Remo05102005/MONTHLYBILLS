import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { addTransactionToDB, updateTransactionInDB, deleteTransactionFromDB, fetchTransactionsByDateRange, fetchAllTransactions } from '../firebase/transactions';
import { auth } from '../firebase/config';

const initialState = {
  transactions: [],
  loading: false,
  error: null
};

// Monotonic counter shared by every thunk that replaces the whole `transactions`
// list. Each such thunk stamps its own request, and only applies its result if
// no newer request has been issued since — otherwise a slow/out-of-order response
// (e.g. from rapidly navigating between months) could overwrite fresher data.
let latestReplaceRequestId = 0;

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (_, { dispatch }) => {
    const uid = auth.currentUser.uid;
    const requestId = ++latestReplaceRequestId;
    try {
      // Fetch all transactions using the new structure
      const transactions = await fetchAllTransactions(uid);
      const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
      if (requestId === latestReplaceRequestId) {
        dispatch(setTransactions(txs));
      }
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
    const requestId = ++latestReplaceRequestId;
    try {
      // Get current month range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch transactions for current month
      const transactions = await fetchTransactionsByDateRange(uid, startDate, endDate);
      const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
      if (requestId === latestReplaceRequestId) {
        dispatch(setTransactions(txs));
      }
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
    const requestId = ++latestReplaceRequestId;
    try {
      const transactions = await fetchTransactionsByDateRange(uid, startDate, endDate);
      const txs = transactions ? Object.entries(transactions).map(([id, t]) => ({ id, ...t })) : [];
      if (requestId === latestReplaceRequestId) {
        dispatch(setTransactions(txs));
      }
      return txs;
    } catch (error) {
      console.error('Error fetching transactions by date range:', error);
      throw error;
    }
  }
);

export const addTransactionAsync = createAsyncThunk(
  'transactions/addTransactionAsync',
  async (transaction) => {
    const uid = auth.currentUser.uid;
    // Write to Firebase and return the real push-id. Callers are responsible for
    // re-fetching whichever month range they're currently displaying afterward
    // (guessing "is this the currently viewed month" here caused stale/incorrect
    // optimistic state, since it compared against today's real date rather than
    // the month the user actually has selected).
    const id = await addTransactionToDB(uid, transaction);
    return { ...transaction, id };
  }
);

export const updateTransactionAsync = createAsyncThunk(
  'transactions/updateTransactionAsync',
  async ({ id, transaction, previousMonthYearPath }) => {
    const uid = auth.currentUser.uid;
    await updateTransactionInDB(uid, id, transaction, previousMonthYearPath);
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
        // Caller re-fetches the currently viewed month's range after this resolves.
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