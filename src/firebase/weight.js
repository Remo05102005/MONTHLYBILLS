import { addData, updateData, deleteData, subscribeToData, queryData } from './database';
import { removeUndefined } from '../utils/cleanObject';
import { ref, query, orderByChild, startAt, endAt, get, limitToLast } from 'firebase/database';
import { realtimeDb } from './config';

export const addWeightToDB = (uid, weight) =>
  addData(`users/${uid}/weights`, removeUndefined(weight));

export const updateWeightInDB = (uid, id, weight) =>
  updateData(`users/${uid}/weights/${id}`, removeUndefined(weight));

export const deleteWeightFromDB = (uid, id) =>
  deleteData(`users/${uid}/weights/${id}`);

export const subscribeToWeights = (uid, callback) =>
  subscribeToData(`users/${uid}/weights`, callback);

export const fetchWeightsByDateRange = async (uid, startDate, endDate) => {
  try {
    const weightsRef = ref(realtimeDb, `users/${uid}/weights`);
    const weightsQuery = query(
      weightsRef,
      orderByChild('date'),
      startAt(startDate.toISOString()),
      endAt(endDate.toISOString())
    );

    const snapshot = await get(weightsQuery);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching weights by date range:', error);
    throw error;
  }
};

export const fetchLast30DaysWeights = async (uid) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const weightsRef = ref(realtimeDb, `users/${uid}/weights`);
    const weightsQuery = query(
      weightsRef,
      orderByChild('date'),
      startAt(thirtyDaysAgo.toISOString())
    );

    const snapshot = await get(weightsQuery);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching last 30 days weights:', error);
    throw error;
  }
};

export const fetchHeight = async (uid) => {
  try {
    const heightRef = ref(realtimeDb, `users/${uid}/settings/height`);
    const snapshot = await get(heightRef);
    return snapshot.exists() ? snapshot.val() : 170; // Default to 170cm if not set
  } catch (error) {
    console.error('Error fetching height:', error);
    return 170; // Return default on error
  }
};

export const saveHeight = async (uid, height) => {
  try {
    await updateData(`users/${uid}/settings`, { height });
    return true;
  } catch (error) {
    console.error('Error saving height:', error);
    throw error;
  }
};

export const fetchTargetWeight = async (uid) => {
  try {
    const targetWeightRef = ref(realtimeDb, `users/${uid}/settings/targetWeight`);
    const snapshot = await get(targetWeightRef);
    return snapshot.exists() ? snapshot.val() : null; // Return null if not set
  } catch (error) {
    console.error('Error fetching target weight:', error);
    return null; // Return null on error
  }
};

export const saveTargetWeight = async (uid, targetWeight) => {
  try {
    await updateData(`users/${uid}/settings`, { targetWeight });
    return true;
  } catch (error) {
    console.error('Error saving target weight:', error);
    throw error;
  }
};

export const fetchGender = async (uid) => {
  try {
    const genderRef = ref(realtimeDb, `users/${uid}/settings/gender`);
    const snapshot = await get(genderRef);
    return snapshot.exists() ? snapshot.val() : 'male'; // Default to male if not set
  } catch (error) {
    console.error('Error fetching gender:', error);
    return 'male'; // Return default on error
  }
};

export const saveGender = async (uid, gender) => {
  try {
    await updateData(`users/${uid}/settings`, { gender });
    return true;
  } catch (error) {
    console.error('Error saving gender:', error);
    throw error;
  }
};
