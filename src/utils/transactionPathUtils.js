import { format, parse } from 'date-fns';

/**
 * Generate month_year path from date
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Month year path in format "MM_YYYY"
 */
export const getMonthYearPath = (date) => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date provided');
    }
    return format(dateObj, 'MM_yyyy');
  } catch (error) {
    console.error('Error generating month year path:', error);
    throw new Error('Invalid date provided for path generation');
  }
};

/**
 * Generate full transaction path
 * @param {string} uid - User ID
 * @param {Date|string} date - Date object or ISO string
 * @param {string} [transactionId] - Transaction ID (optional)
 * @returns {string} Full transaction path
 */
export const getTransactionPath = (uid, date, transactionId) => {
  try {
    const monthYearPath = getMonthYearPath(date);
    const basePath = `users/${uid}/transactions/${monthYearPath}`;
    
    if (transactionId) {
      return `${basePath}/${transactionId}`;
    }
    
    return basePath;
  } catch (error) {
    console.error('Error generating transaction path:', error);
    throw error;
  }
};

/**
 * Parse month_year from path
 * @param {string} monthYearPath - Path in format "MM_YYYY"
 * @returns {Object} Object with month and year properties
 */
export const parseMonthYearFromPath = (monthYearPath) => {
  try {
    if (!monthYearPath || typeof monthYearPath !== 'string') {
      throw new Error('Invalid month year path provided');
    }
    
    // Handle both "MM_YYYY" and "MM/YYYY" formats
    const parts = monthYearPath.replace('/', '_').split('_');
    if (parts.length !== 2) {
      throw new Error('Invalid month year path format');
    }
    
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1900 || year > 2100) {
      throw new Error('Invalid month or year values');
    }
    
    return { month, year };
  } catch (error) {
    console.error('Error parsing month year from path:', error);
    throw error;
  }
};

/**
 * Get all month paths for a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string[]} Array of month year paths
 */
export const getMonthPathsInRange = (startDate, endDate) => {
  try {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      throw new Error('Invalid date objects provided');
    }
    
    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }
    
    const paths = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    
    while (current <= end) {
      paths.push(format(current, 'MM_yyyy'));
      current.setMonth(current.getMonth() + 1);
    }
    
    return paths;
  } catch (error) {
    console.error('Error generating month paths for range:', error);
    throw error;
  }
};

/**
 * Get transaction paths for multiple months
 * @param {string} uid - User ID
 * @param {string[]} monthPaths - Array of month year paths
 * @returns {string[]} Array of full transaction paths
 */
export const getTransactionPathsForMonths = (uid, monthPaths) => {
  try {
    if (!uid || !monthPaths || !Array.isArray(monthPaths)) {
      throw new Error('Invalid parameters provided');
    }
    
    return monthPaths.map(monthPath => `users/${uid}/transactions/${monthPath}`);
  } catch (error) {
    console.error('Error generating transaction paths for months:', error);
    throw error;
  }
};

/**
 * Check if a date falls within a specific month year path
 * @param {Date|string} date - Date to check
 * @param {string} monthYearPath - Month year path to check against
 * @returns {boolean} True if date falls within the month year
 */
export const isDateInMonthYearPath = (date, monthYearPath) => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const { month, year } = parseMonthYearFromPath(monthYearPath);
    
    return dateObj.getFullYear() === year && dateObj.getMonth() === month - 1;
  } catch (error) {
    console.error('Error checking if date is in month year path:', error);
    return false;
  }
};

/**
 * Get the current month year path
 * @returns {string} Current month year path
 */
export const getCurrentMonthYearPath = () => {
  return getMonthYearPath(new Date());
};

/**
 * Get the previous month year path
 * @returns {string} Previous month year path
 */
export const getPreviousMonthYearPath = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return getMonthYearPath(date);
};

/**
 * Get the next month year path
 * @returns {string} Next month year path
 */
export const getNextMonthYearPath = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return getMonthYearPath(date);
};