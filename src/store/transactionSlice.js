import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { addTransactionToDB, updateTransactionInDB, deleteTransactionFromDB, subscribeToTransactions, fetchTransactionsByDateRange } from '../firebase/transactions';
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
    return new Promise((resolve) => {
      subscribeToTransactions(uid, (data) => {
        const txs = data ? Object.entries(data).map(([id, t]) => ({ id, ...t })) : [];
        dispatch(setTransactions(txs));
        resolve();
      });
    });
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
  async (transaction) => {
    const uid = auth.currentUser.uid;
    await addTransactionToDB(uid, transaction);
    return transaction;
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
  async (id) => {
    const uid = auth.currentUser.uid;
    await deleteTransactionFromDB(uid, id);
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
      });
  }
});

export const { setTransactions, resetTransactions } = transactionSlice.actions;
export default transactionSlice.reducer; 