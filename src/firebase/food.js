import { realtimeDb } from './config';
import { ref, onValue, remove, update, push, get } from 'firebase/database';
import { removeUndefined } from '../utils/cleanObject';

/**
 * Add standard food data to centralized foodData database
 * @param {string} userId - User ID
 * @param {string} foodItem - Food item name
 * @param {Object} standardData - Standard nutritional data for different metrics
 * @returns {Promise<void>}
 */
export const addFoodDataToDB = async (userId, foodItem, standardData) => {
  try {
    const foodDataRef = ref(realtimeDb, `users/${userId}/foodData/${foodItem}`);
    await update(foodDataRef, removeUndefined(standardData));
  } catch (error) {
    console.error('Error adding food data:', error);
    throw error;
  }
};

/**
 * Get standard food data from centralized foodData database
 * @param {string} userId - User ID
 * @param {string} foodItem - Food item name
 * @returns {Promise<Object|null>} - Standard food data or null if not found
 */
export const getFoodDataFromDB = async (userId, foodItem) => {
  try {
    const foodDataRef = ref(realtimeDb, `users/${userId}/foodData/${foodItem}`);
    const snapshot = await get(foodDataRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error getting food data:', error);
    throw error;
  }
};

/**
 * Add a new food intake entry to Firebase (day-wise inside weight)
 * @param {string} userId - User ID
 * @param {string} weightId - Weight record ID
 * @param {string} date - Date in 'yyyy-MM-dd' format
 * @param {Object} foodData - Food intake data with calculated nutrients
 * @returns {Promise<string>} - The new entry ID
 */
export const addFoodIntakeToDB = async (userId, weightId, date, foodData) => {
  try {
    const timestamp = Date.now();
    const foodIntakeData = {
      foodItem: foodData.foodItem.trim(),
      quantity: parseFloat(foodData.quantity),
      unit: foodData.unit,
      time: foodData.time,
      nutrients: foodData.nutrients,
      date: date,
      createdAt: new Date().toISOString()
    };

    const foodRef = ref(realtimeDb, `users/${userId}/weights/${weightId}/food/${date}/${timestamp}`);
    await push(foodRef, removeUndefined(foodIntakeData));
    
    return timestamp.toString();
  } catch (error) {
    console.error('Error adding food intake:', error);
    throw error;
  }
};

/**
 * Update an existing food intake entry
 * @param {string} userId - User ID
 * @param {string} weightId - Weight record ID
 * @param {string} date - Date in 'yyyy-MM-dd' format
 * @param {string} entryId - Entry ID to update
 * @param {Object} foodData - Updated food intake data
 * @returns {Promise<void>}
 */
export const updateFoodIntakeInDB = async (userId, weightId, date, entryId, foodData) => {
  try {
    const foodIntakeData = {
      foodItem: foodData.foodItem.trim(),
      quantity: parseFloat(foodData.quantity),
      unit: foodData.unit,
      time: foodData.time,
      nutrients: foodData.nutrients,
      updatedAt: new Date().toISOString()
    };

    const foodRef = ref(realtimeDb, `users/${userId}/weights/${weightId}/food/${date}/${entryId}`);
    await update(foodRef, removeUndefined(foodIntakeData));
  } catch (error) {
    console.error('Error updating food intake:', error);
    throw error;
  }
};

/**
 * Delete a food intake entry
 * @param {string} userId - User ID
 * @param {string} weightId - Weight record ID
 * @param {string} date - Date in 'yyyy-MM-dd' format
 * @param {string} entryId - Entry ID to delete
 * @returns {Promise<void>}
 */
export const deleteFoodIntakeFromDB = async (userId, weightId, date, entryId) => {
  try {
    const foodRef = ref(realtimeDb, `users/${userId}/weights/${weightId}/food/${date}/${entryId}`);
    await remove(foodRef);
  } catch (error) {
    console.error('Error deleting food intake:', error);
    throw error;
  }
};

/**
 * Subscribe to food intake data for a specific date and weight record
 * @param {string} userId - User ID
 * @param {string} weightId - Weight record ID
 * @param {string} date - Date in 'yyyy-MM-dd' format
 * @param {Function} callback - Callback function to handle data changes
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToFoodIntake = (userId, weightId, date, callback) => {
  try {
    const foodRef = ref(realtimeDb, `users/${userId}/weights/${weightId}/food/${date}`);
    
    const unsubscribe = onValue(foodRef, (snapshot) => {
      const data = snapshot.val();
      const foodIntakeList = [];
      
      if (data) {
        Object.keys(data).forEach(entryId => {
          const entry = {
            id: entryId,
            ...data[entryId]
          };
          foodIntakeList.push(entry);
        });
      }
      
      // Sort by time
      foodIntakeList.sort((a, b) => {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
      });
      
      callback(foodIntakeList);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to food intake:', error);
    throw error;
  }
};

/**
 * Get food intake data for a specific date and weight record
 * @param {string} userId - User ID
 * @param {string} weightId - Weight record ID
 * @param {string} date - Date in 'yyyy-MM-dd' format
 * @returns {Promise<Array>} - Array of food intake entries
 */
export const getFoodIntakeForDate = async (userId, weightId, date) => {
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeToFoodIntake(userId, weightId, date, (data) => {
      unsubscribe();
      resolve(data);
    });
    
    // Set a timeout to prevent hanging
    setTimeout(() => {
      unsubscribe();
      resolve([]);
    }, 5000);
  });
};
