const STORAGE_KEY = 'common_man_transactions';

export const loadTransactions = () => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const transactions = JSON.parse(storedData);
      // Convert date strings back to Date objects
      return transactions.map(t => ({
        ...t,
        date: new Date(t.date)
      }));
    }
    return [];
  } catch (error) {
    console.error('Error loading transactions:', error);
    return [];
  }
};

export const saveTransactions = (transactions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error saving transactions:', error);
  }
};

export const clearTransactions = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing transactions:', error);
  }
}; 