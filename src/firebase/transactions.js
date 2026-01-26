import { removeUndefined } from '../utils/cleanObject';
import { ref, get, getDatabase, push, set, remove } from 'firebase/database';
import { getMonthYearPath, getMonthPathsInRange } from '../utils/transactionPathUtils';

/**
 * Add a transaction to the database using month/year structure
 * @param {string} uid - User ID
 * @param {Object} transaction - Transaction data
 * @returns {Promise<string>} Transaction ID
 */
export const addTransactionToDB = async (uid, transaction) => {
  try {
    const cleaned = removeUndefined(transaction);
    const monthYearPath = getMonthYearPath(cleaned.date);
    const db = getDatabase();
    
    // Generate a new transaction ID using push
    const newRef = ref(db, `users/${uid}/transactions/${monthYearPath}`);
    const newTransactionRef = push(newRef);
    
    // Set the transaction with the generated ID
    await set(newTransactionRef, cleaned);
    
    
    return newTransactionRef.key;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

/**
 * Update a transaction in the database
 * @param {string} uid - User ID
 * @param {string} id - Transaction ID
 * @param {Object} transaction - Updated transaction data
 * @returns {Promise<void>}
 */
export const updateTransactionInDB = async (uid, id, transaction) => {
  try {
    const cleaned = removeUndefined(transaction);
    const monthYearPath = getMonthYearPath(cleaned.date);
    const db = getDatabase();
    
    // Update the transaction in the correct month/year path
    const transactionRef = ref(db, `users/${uid}/transactions/${monthYearPath}/${id}`);
    await set(transactionRef, cleaned);
    
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
};

/**
 * Delete a transaction from the database
 * @param {string} uid - User ID
 * @param {string} id - Transaction ID
 * @param {string} [monthYearPath] - Month year path (optional, for optimization)
 * @returns {Promise<void>}
 */
export const deleteTransactionFromDB = async (uid, id, monthYearPath) => {
  try {
    const db = getDatabase();
    
    if (monthYearPath) {
      // If month year path is provided, delete directly from that path
      const transactionRef = ref(db, `users/${uid}/transactions/${monthYearPath}/${id}`);
      await remove(transactionRef);
      
    } else {
      // Fallback: search through recent months (last 12 months) to find the transaction
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1); // Last 12 months
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const monthPaths = getMonthPathsInRange(startDate, endDate);
      
      for (const path of monthPaths) {
        const transactionRef = ref(db, `users/${uid}/transactions/${path}/${id}`);
        const snapshot = await get(transactionRef);
        
        if (snapshot.exists()) {
          await remove(transactionRef);
          
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};

/**
 * Fetch transactions by date range using the new month/year structure
 * @param {string} uid - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Combined transactions from all relevant months
 */
export const fetchTransactionsByDateRange = async (uid, startDate, endDate) => {
  try {
    const db = getDatabase();
    const monthPaths = getMonthPathsInRange(startDate, endDate);
    const allTransactions = {};
    
    for (const monthPath of monthPaths) {
      const transactionsRef = ref(db, `users/${uid}/transactions/${monthPath}`);
      const snapshot = await get(transactionsRef);
      
      if (snapshot.exists()) {
        const monthTransactions = snapshot.val();
        // Merge transactions from this month into the combined result
        Object.keys(monthTransactions).forEach(id => {
          allTransactions[id] = monthTransactions[id];
        });
      }
    }
    
    return Object.keys(allTransactions).length > 0 ? allTransactions : null;
  } catch (error) {
    console.error('Error fetching transactions by date range:', error);
    throw error;
  }
};

/**
 * Fetch all transactions for a specific month
 * @param {string} uid - User ID
 * @param {string} monthYearPath - Month year path (e.g., "04_2025")
 * @returns {Promise<Object>} Transactions for the specified month
 */
export const fetchTransactionsForMonth = async (uid, monthYearPath) => {
  try {
    const db = getDatabase();
    const transactionsRef = ref(db, `users/${uid}/transactions/${monthYearPath}`);
    const snapshot = await get(transactionsRef);
    
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching transactions for month:', error);
    throw error;
  }
};

/**
 * Fetch all transactions (legacy function for backward compatibility)
 * @param {string} uid - User ID
 * @returns {Promise<Object>} All transactions
 */
export const fetchAllTransactions = async (uid) => {
  try {
    const db = getDatabase();
    // Use a reasonable range - last 5 years to future 1 year
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 5, 0, 1);
    const endDate = new Date(now.getFullYear() + 1, 11, 31);
    
    const monthPaths = getMonthPathsInRange(startDate, endDate);
    const allTransactions = {};
    
    for (const monthPath of monthPaths) {
      const transactionsRef = ref(db, `users/${uid}/transactions/${monthPath}`);
      const snapshot = await get(transactionsRef);
      
      if (snapshot.exists()) {
        const monthTransactions = snapshot.val();
        Object.keys(monthTransactions).forEach(id => {
          allTransactions[id] = monthTransactions[id];
        });
      }
    }
    
    return Object.keys(allTransactions).length > 0 ? allTransactions : null;
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    throw error;
  }
};
