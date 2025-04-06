import { createSlice } from '@reduxjs/toolkit';
import { loadTransactions, saveTransactions } from '../utils/storage';

const initialState = {
  transactions: loadTransactions(),
  loading: false,
  error: null
};

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    addTransaction: (state, action) => {
      state.transactions.push(action.payload);
      saveTransactions(state.transactions);
    },
    updateTransaction: (state, action) => {
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.transactions[index] = action.payload;
        saveTransactions(state.transactions);
      }
    },
    deleteTransaction: (state, action) => {
      state.transactions = state.transactions.filter(t => t.id !== action.payload);
      saveTransactions(state.transactions);
    },
    setTransactions: (state, action) => {
      state.transactions = action.payload;
      saveTransactions(state.transactions);
    },
    resetTransactions: (state) => {
      state.transactions = [];
      saveTransactions(state.transactions);
    }
  }
});

export const { addTransaction, updateTransaction, deleteTransaction, setTransactions, resetTransactions } = transactionSlice.actions;

export const selectTransactions = (state) => state.transactions.transactions;
export const selectLoading = (state) => state.transactions.loading;
export const selectError = (state) => state.transactions.error;

export default transactionSlice.reducer; 