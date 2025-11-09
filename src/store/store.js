import { configureStore } from '@reduxjs/toolkit';
import transactionReducer from './transactionSlice';
import todoReducer from './todoSlice';

export const store = configureStore({
  reducer: {
    transactions: transactionReducer,
    todos: todoReducer
  }
});
