import { addData, updateData, deleteData, subscribeToData, queryData } from './database';
import { removeUndefined } from '../utils/cleanObject';
import { ref, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import { realtimeDb } from './config';

export const addTransactionToDB = (uid, transaction) =>
  addData(`users/${uid}/transactions`, removeUndefined(transaction));

export const updateTransactionInDB = (uid, id, transaction) =>
  updateData(`users/${uid}/transactions/${id}`, removeUndefined(transaction));

export const deleteTransactionFromDB = (uid, id) =>
  deleteData(`users/${uid}/transactions/${id}`);

export const subscribeToTransactions = (uid, callback) =>
  subscribeToData(`users/${uid}/transactions`, callback);

export const fetchTransactionsByDateRange = async (uid, startDate, endDate) => {
  try {
    const transactionsRef = ref(realtimeDb, `users/${uid}/transactions`);
    const transactionsQuery = query(
      transactionsRef,
      orderByChild('date'),
      startAt(startDate.toISOString()),
      endAt(endDate.toISOString())
    );
    
    const snapshot = await get(transactionsQuery);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching transactions by date range:', error);
    throw error;
  }
}; 