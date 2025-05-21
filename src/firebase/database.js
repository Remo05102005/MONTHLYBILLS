import { 
  ref, 
  set, 
  get, 
  update, 
  remove, 
  push, 
  query, 
  orderByChild,
  onValue,
  off
} from 'firebase/database';
import { realtimeDb } from './config';

// Create or update a record
export const saveData = async (path, data) => {
  try {
    const reference = ref(realtimeDb, path);
    await set(reference, data);
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
};

// Get a single record
export const getData = async (path) => {
  try {
    const reference = ref(realtimeDb, path);
    const snapshot = await get(reference);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error getting data:', error);
    throw error;
  }
};

// Update specific fields
export const updateData = async (path, data) => {
  try {
    const reference = ref(realtimeDb, path);
    await update(reference, data);
    return true;
  } catch (error) {
    console.error('Error updating data:', error);
    throw error;
  }
};

// Delete a record
export const deleteData = async (path) => {
  try {
    const reference = ref(realtimeDb, path);
    await remove(reference);
    return true;
  } catch (error) {
    console.error('Error deleting data:', error);
    throw error;
  }
};

// Add a new record with auto-generated key
export const addData = async (path, data) => {
  try {
    const reference = ref(realtimeDb, path);
    const newRef = push(reference);
    await set(newRef, data);
    return newRef.key;
  } catch (error) {
    console.error('Error adding data:', error);
    throw error;
  }
};

// Listen to real-time updates
export const subscribeToData = (path, callback) => {
  const reference = ref(realtimeDb, path);
  onValue(reference, (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : null;
    callback(data);
  });

  // Return unsubscribe function
  return () => off(reference);
};

// Query data with ordering
export const queryData = async (path, orderBy, limitToFirst = null) => {
  try {
    const reference = ref(realtimeDb, path);
    const queryRef = query(reference, orderByChild(orderBy));
    const snapshot = await get(queryRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error querying data:', error);
    throw error;
  }
}; 