import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Separate Firebase config for notifications
const notificationFirebaseConfig = {
  apiKey: "AIzaSyATtCTL0GVybzAk4kFtiWFZHghQOD6zEuw",
  authDomain: "telegram-notification-aa284.firebaseapp.com",
  projectId: "telegram-notification-aa284",
  storageBucket: "telegram-notification-aa284.firebasestorage.app",
  messagingSenderId: "771923488817",
  appId: "1:771923488817:web:bc38b9fa271e236c44e510",
  measurementId: "G-HPBQRKY7GG"
};

// Initialize separate Firebase app for notifications
const notificationApp = initializeApp(notificationFirebaseConfig, 'notifications');
const notificationDb = getFirestore(notificationApp);

/**
 * Schedule a reminder in the notification database
 * @param {string} botId - Telegram bot ID
 * @param {string} userId - Telegram user ID
 * @param {string} message - Reminder message
 * @param {number} time - Timestamp in milliseconds
 */
export const scheduleReminder = async (botId, userId, message, time) => {
  try {
    const reminderData = {
      botid: botId,
      userid: userId,
      message: message,
      time: time
    };

    const docRef = await addDoc(collection(notificationDb, 'reminders'), reminderData);
    console.log('Reminder scheduled with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    throw error;
  }
};

/**
 * Get due reminders from the notification database
 * @returns {Array} Array of due reminder documents
 */
export const getDueReminders = async () => {
  try {
    const now = Date.now();
    const q = query(
      collection(notificationDb, 'reminders'),
      where('time', '<=', now),
      orderBy('time', 'asc'),
      limit(50)
    );

    const querySnapshot = await getDocs(q);
    const reminders = [];

    querySnapshot.forEach((doc) => {
      reminders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return reminders;
  } catch (error) {
    console.error('Error getting due reminders:', error);
    throw error;
  }
};

/**
 * Delete a processed reminder from the notification database
 * @param {string} reminderId - Document ID of the reminder to delete
 */
export const deleteReminder = async (reminderId) => {
  try {
    await deleteDoc(doc(notificationDb, 'reminders', reminderId));
    console.log('Reminder deleted:', reminderId);
  } catch (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
};

/**
 * Send a Telegram message (stub - to be replaced with actual implementation)
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message to send
 */
export const sendTelegramMessage = async (botToken, chatId, message) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API Error: ${error.description}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
};

export default {
  scheduleReminder,
  getDueReminders,
  deleteReminder,
  sendTelegramMessage
};