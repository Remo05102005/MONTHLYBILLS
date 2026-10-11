import { addData, updateData, deleteData, subscribeToData } from './database';
import { removeUndefined } from '../utils/cleanObject';
import { ref, get, update } from 'firebase/database';
import { realtimeDb } from './config';

export const addWeightToDB = (uid, weight) =>
  addData(`users/${uid}/weights`, removeUndefined(weight));

export const updateWeightInDB = (uid, id, weight) =>
  updateData(`users/${uid}/weights/${id}`, removeUndefined(weight));

export const deleteWeightFromDB = (uid, id) =>
  deleteData(`users/${uid}/weights/${id}`);

export const subscribeToWeights = (uid, callback) =>
  subscribeToData(`users/${uid}/weights`, callback);

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

// Weight-loss journey settings: startWeight (kg), startDate / goalDate ('yyyy-MM-dd')
export const fetchJourneySettings = async (uid) => {
  try {
    const snapshot = await get(ref(realtimeDb, `users/${uid}/settings`));
    const s = snapshot.exists() ? snapshot.val() : {};
    return {
      startWeight: s.startWeight ?? null,
      startDate: s.startDate ?? null,
      goalDate: s.goalDate ?? null,
    };
  } catch (error) {
    console.error('Error fetching journey settings:', error);
    return { startWeight: null, startDate: null, goalDate: null };
  }
};

// Pass null for a field to clear it
export const saveJourneySettings = async (uid, { startWeight, startDate, goalDate, targetWeight }) => {
  try {
    const data = {};
    if (startWeight !== undefined) data.startWeight = startWeight;
    if (startDate !== undefined) data.startDate = startDate;
    if (goalDate !== undefined) data.goalDate = goalDate;
    if (targetWeight !== undefined) data.targetWeight = targetWeight;
    await update(ref(realtimeDb, `users/${uid}/settings`), data);
    return true;
  } catch (error) {
    console.error('Error saving journey settings:', error);
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

// Body measurements (cm): users/{uid}/measurements/{id} = { date, waist, chest, hips, arm, thigh, neck }
export const addMeasurementToDB = (uid, measurement) =>
  addData(`users/${uid}/measurements`, removeUndefined(measurement));

export const updateMeasurementInDB = (uid, id, measurement) =>
  updateData(`users/${uid}/measurements/${id}`, removeUndefined(measurement));

export const deleteMeasurementFromDB = (uid, id) =>
  deleteData(`users/${uid}/measurements/${id}`);

// Calls back with an array sorted by date ascending
export const subscribeToMeasurements = (uid, callback) =>
  subscribeToData(`users/${uid}/measurements`, (data) => {
    const list = data
      ? Object.entries(data).map(([id, m]) => ({ id, ...m }))
      : [];
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    callback(list);
  });

// Daily habit log: users/{uid}/daily/{yyyy-MM-dd} = { water, steps, sleep, workout }
export const saveDailyLog = (uid, date, data) =>
  updateData(`users/${uid}/daily/${date}`, removeUndefined(data));

// Calls back with an object keyed by 'yyyy-MM-dd'
export const subscribeToDaily = (uid, callback) =>
  subscribeToData(`users/${uid}/daily`, (data) => callback(data || {}));
