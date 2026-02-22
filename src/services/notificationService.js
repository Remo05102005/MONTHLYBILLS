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

/**
 * Send a document/file to Telegram chat
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @param {object} jsonData - JSON data to send as file
 * @param {string} filename - Name of the file
 * @param {string} caption - Optional caption for the file
 */
export const sendTelegramDocument = async (botToken, chatId, jsonData, filename = 'backup.json', caption = '') => {
  try {
    // Create a Blob from JSON data (raw, no modification)
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Use FormData for file upload (multipart/form-data)
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', blob, filename);
    if (caption) {
      formData.append('caption', caption);
    }

    // Send directly to Telegram API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData  // Don't set Content-Type header - browser sets it automatically with boundary
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API Error: ${error.description}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending Telegram document:', error);
    throw error;
  }
};

/**
 * Backup entire Firebase database and send to Telegram
 * @param {object} currentUser - Firebase current user object
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID to send backup to
 * @param {string} databaseUrl - Firebase Realtime Database URL
 */
export const backupDatabaseToTelegram = async (currentUser, botToken, chatId, databaseUrl) => {
  try {
    // Get user's Firebase ID token for authentication
    const idToken = await currentUser.getIdToken();

    // Call Firebase REST API to get users data as raw JSON
    // Reading from /users.json instead of /.json to match Firebase rules
    const response = await fetch(
      `${databaseUrl}/users.json?auth=${idToken}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firebase response error:', response.status, errorText);
      throw new Error(`Failed to fetch database (${response.status}): ${errorText}`);
    }

    // Get raw JSON - NO MODIFICATION
    const rawJsonData = await response.json();

    // Check if data exists
    if (!rawJsonData) {
      throw new Error('No data found in database');
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `firebase-backup-${timestamp}.json`;
    const caption = `📦 Database Backup\n📅 ${new Date().toLocaleString()}\n💾 Full raw JSON export`;

    // Send to Telegram
    return await sendTelegramDocument(botToken, chatId, rawJsonData, filename, caption);
  } catch (error) {
    console.error('Error backing up database to Telegram:', error);
    throw error;
  }
};

export default {
  scheduleReminder,
  getDueReminders,
  deleteReminder,
  sendTelegramMessage,
  sendTelegramDocument,
  backupDatabaseToTelegram
};
