import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase/config';
import { ref, set, get } from 'firebase/database';
import { realtimeDb } from '../firebase/config';
import { auth } from '../firebase/config';

// Capacitor imports (conditionally loaded)
let PushNotifications = null;
let Capacitor = null;

// Check if running in Capacitor
const isCapacitor = () => {
  try {
    // Check for Capacitor global object
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform) {
      return window.Capacitor.isNativePlatform();
    }
    // Fallback: check for capacitor user agent or other indicators
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return navigator.userAgent.includes('Capacitor');
    }
    return false;
  } catch (e) {
    console.warn('Error detecting Capacitor:', e);
    return false;
  }
};

class NotificationService {
  constructor() {
    // Use environment variable for VAPID key (required for FCM)
    this.vapidKey = process.env.REACT_APP_FCM_VAPID_KEY;
    if (!this.vapidKey) {
      console.error('FCM VAPID key not found! Please set REACT_APP_FCM_VAPID_KEY in your .env file');
    }
    this.scheduledReminders = new Map();
    this.eventListeners = new Set(); // Track event listeners for cleanup
    this.isInitialized = false;
    this.initializationPromise = null;
    this.registrationAttempts = 0;
    this.maxRegistrationAttempts = 3;
  }

  // Enhanced permission request with better UX
  async requestPermission() {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
      }

      // Check current permission status
      if (Notification.permission === 'granted') {
        console.log('Notification permission already granted');
        return true;
      }

      if (Notification.permission === 'denied') {
        console.log('Notification permission was previously denied');
        return false;
      }

      // Request permission with user feedback
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Enhanced FCM token retrieval with better error handling
  async getFCMToken() {
    try {
      if (!messaging) {
        throw new Error('Firebase messaging not initialized');
      }

      const token = await getToken(messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      });
      
      if (token) {
        console.log('FCM token retrieved successfully');
        return token;
      } else {
        console.warn('No FCM token returned');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      this.handleTokenError(error);
      return null;
    }
  }

  // Handle token-specific errors
  handleTokenError(error) {
    const errorCode = error.code || error.message;
    
    if (errorCode === 'messaging/permission-blocked') {
      console.error('Notification permission is blocked');
    } else if (errorCode === 'messaging/permission-not-granted') {
      console.error('Notification permission not granted');
    } else if (errorCode === 'messaging/unregistered') {
      console.error('Service worker is not registered');
    } else if (errorCode === 'messaging/invalid-service-worker-scope') {
      console.error('Invalid service worker scope');
    } else {
      console.error('Unknown token error:', error);
    }
  }

  // Save FCM token to user profile
  async saveFCMToken(userId, token) {
    try {
      if (!userId || !token) {
        console.error('Invalid userId or token for saving');
        return false;
      }

      await set(ref(realtimeDb, `users/${userId}/fcmToken`), token);
      console.log('FCM token saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving FCM token:', error);
      return false;
    }
  }

  // Initialize notifications for user with retry logic
  async initializeNotifications(userId) {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeNotificationsInternal(userId);
    return this.initializationPromise;
  }

  async _initializeNotificationsInternal(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required for notification initialization');
      }

      console.log('Initializing notifications for user:', userId);

      if (isCapacitor()) {
        return await this.initializeCapacitorNotifications(userId);
      } else {
        return await this.initializeWebNotifications(userId);
      }
    } catch (error) {
      console.error('Notification initialization failed:', error);
      this.isInitialized = false;
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  // Initialize notifications for web environment with enhanced error handling
  async initializeWebNotifications(userId) {
    try {
      console.log('Initializing web notifications...');

      // Check browser support
      const checks = this.checkBrowserSupport();
      if (!checks.notification) {
        throw new Error('Browser does not support notifications');
      }

      // Request permission with user feedback
      const permissionGranted = await this.requestPermission();
      if (!permissionGranted) {
        console.log('Notification permission denied by user');
        return false;
      }

      // Get FCM token with retry logic
      let token = null;
      for (let attempt = 1; attempt <= this.maxRegistrationAttempts; attempt++) {
        console.log(`Token retrieval attempt ${attempt}/${this.maxRegistrationAttempts}`);
        
        try {
          token = await this.getFCMToken();
          if (token) {
            break;
          }
        } catch (error) {
          console.warn(`Token retrieval attempt ${attempt} failed:`, error);
          if (attempt === this.maxRegistrationAttempts) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!token) {
        console.error('Failed to get FCM token after all attempts');
        return false;
      }

      // Save token to database
      const saveSuccess = await this.saveFCMToken(userId, token);
      if (!saveSuccess) {
        console.warn('Failed to save FCM token to database');
      }

      // Setup foreground message handling
      this.setupForegroundNotifications();
      
      this.isInitialized = true;
      console.log('Web notifications initialized successfully');
      return true;

    } catch (error) {
      console.error('Error initializing web notifications:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Initialize notifications for Capacitor environment with enhanced error handling
  async initializeCapacitorNotifications(userId) {
    try {
      console.log('Initializing Capacitor notifications...');

      // Dynamically import Capacitor plugins
      const { PushNotifications: PushPlugin, Capacitor: CapPlugin } = await import('@capacitor/push-notifications');
      PushNotifications = PushPlugin;
      Capacitor = CapPlugin;

      // Request permission with retry logic
      let permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive === 'prompt') {
        console.log('Permission prompt shown, waiting for user response...');
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.error('Push notification permission denied');
        return false;
      }

      console.log('Push notification permission granted');

      // Register for push notifications
      await PushNotifications.register();
      console.log('Push notifications registered');

      // Listen for registration success
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token:', token.value);
        await this.saveFCMToken(userId, token.value);
      });

      // Listen for registration error
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // Listen for push notification received
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        this.handleCapacitorNotification(notification);
      });

      // Listen for push notification action performed
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed:', notification);
        this.handleCapacitorNotificationAction(notification);
      });

      this.isInitialized = true;
      console.log('Capacitor notifications initialized successfully');
      return true;

    } catch (error) {
      console.error('Error initializing Capacitor notifications:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // Setup foreground message handling with enhanced error handling
  setupForegroundNotifications() {
    try {
      if (!messaging) {
        console.warn('Firebase messaging not available for foreground notifications');
        return;
      }

      onMessage(messaging, (payload) => {
        console.log('Received foreground message:', payload);

        const notificationTitle = payload.notification?.title || 'COMMON MAN';
        const notificationOptions = {
          body: payload.notification?.body || 'You have a reminder',
          icon: '/logo192.png',
          badge: '/favicon.ico',
          tag: payload.data?.todoId || 'reminder',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'View Todo'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ],
          data: {
            todoId: payload.data?.todoId,
            url: '/todo'
          }
        };

        // Show notification
        if (Notification.permission === 'granted') {
          const notification = new Notification(notificationTitle, notificationOptions);
          
          // Auto close after 10 seconds
          setTimeout(() => {
            if (!notification.closed) {
              notification.close();
            }
          }, 10000);
        }
      });

      console.log('Foreground message handling setup completed');
    } catch (error) {
      console.error('Error setting up foreground notifications:', error);
    }
  }

  // Schedule a reminder notification
  scheduleReminder(todo) {
    if (!this.validateTodo(todo)) {
      console.error('Invalid todo object for scheduling reminder');
      return;
    }

    if (!todo.reminderDate) {
      console.warn('No reminder date provided for todo:', todo.id);
      return;
    }

    const reminderTime = new Date(todo.reminderDate).getTime();
    const now = Date.now();
    const delay = reminderTime - now;

    if (delay <= 0) {
      console.warn('Reminder time has already passed for todo:', todo.id);
      return;
    }

    // Clear any existing reminder for this todo
    this.clearReminder(todo.id);

    // Schedule new reminder
    const timeoutId = setTimeout(() => {
      this.showReminderNotification(todo);
    }, delay);

    this.scheduledReminders.set(todo.id, timeoutId);
    console.log(`Reminder scheduled for "${todo.title}" in ${Math.round(delay / 1000 / 60)} minutes`);
  }

  // Clear a scheduled reminder
  clearReminder(todoId) {
    const timeoutId = this.scheduledReminders.get(todoId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledReminders.delete(todoId);
      console.log(`Reminder cleared for todo ${todoId}`);
    }
  }

  // Show reminder notification
  async showReminderNotification(todo) {
    try {
      if (!this.validateTodo(todo)) {
        console.error('Invalid todo object for notification');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }

      console.log('Showing reminder notification for:', todo.title);

      // First, try to send push notification to FCM (works even when app is closed/not running)
      try {
        const userId = auth?.currentUser?.uid;
        if (userId) {
          await this.sendPushNotification(userId, todo, {
            priorityEmoji: todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟡' : '🟢'
          });
        }
      } catch (error) {
        console.warn('Failed to send push notification:', error);
        // Continue with local notification even if push fails
      }

      // Enhanced notification content based on priority
      const priorityEmoji = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
      };

      const notificationTitle = `${priorityEmoji[todo.priority] || '📝'} COMMON MAN`;

      // Build rich notification body
      let notificationBody = `⏰ ${todo.title}`;
      if (todo.description) {
        notificationBody += `\n📝 ${todo.description.substring(0, 50)}${todo.description.length > 50 ? '...' : ''}`;
      }
      if (todo.category) {
        notificationBody += `\n🏷️ ${todo.category}`;
      }
      if (todo.dueDate) {
        const dueDate = new Date(todo.dueDate);
        const now = new Date();
        const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (daysDiff < 0) {
          notificationBody += `\n⚠️ OVERDUE by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''}`;
        } else if (daysDiff === 0) {
          notificationBody += `\n📅 Due TODAY`;
        } else if (daysDiff === 1) {
          notificationBody += `\n📅 Due TOMORROW`;
        } else {
          notificationBody += `\n📅 Due in ${daysDiff} days`;
        }
      }

      // Priority-specific notification settings
      const getNotificationSettings = (priority) => {
        switch (priority) {
          case 'high':
            return {
              icon: '/logo192.png',
              badge: '/favicon.ico',
              tag: `todo-high-${todo.id}`,
              requireInteraction: true,
              silent: false,
              actions: [
                { action: 'complete', title: '✅ Mark Complete' },
                { action: 'view', title: '👁️ View Details' },
                { action: 'snooze', title: '⏰ Snooze 1h' }
              ]
            };
          case 'medium':
            return {
              icon: '/logo192.png',
              badge: '/favicon.ico',
              tag: `todo-medium-${todo.id}`,
              requireInteraction: false,
              silent: false,
              actions: [
                { action: 'complete', title: '✅ Mark Complete' },
                { action: 'view', title: '👁️ View Details' }
              ]
            };
          default:
            return {
              icon: '/logo192.png',
              badge: '/favicon.ico',
              tag: `todo-${todo.id}`,
              requireInteraction: false,
              silent: true,
              actions: [
                { action: 'view', title: '👁️ View Todo' }
              ]
            };
        }
      };

      const notificationOptions = {
        body: notificationBody,
        ...getNotificationSettings(todo.priority),
        data: {
          todoId: todo.id,
          priority: todo.priority,
          url: '/todo',
          timestamp: Date.now()
        },
        // Enhanced visual options
        image: todo.category ? `/category-${todo.category}.png` : undefined,
        lang: 'en-US',
        dir: 'ltr'
      };

      // Create notification with enhanced features
      const notification = new Notification(notificationTitle, notificationOptions);

      // Priority-based auto-close timing
      const autoCloseDelay = todo.priority === 'high' ? 30000 : todo.priority === 'medium' ? 20000 : 10000;
      setTimeout(() => {
        if (!notification.closed) {
          notification.close();
        }
      }, autoCloseDelay);

      // Enhanced click handling
      notification.onclick = (event) => {
        event.preventDefault();
        notification.close();

        // Handle different actions
        const action = event.action || 'view';

        switch (action) {
          case 'complete':
            // Mark as complete (would need to be handled by the main app)
            console.log('Marking todo as complete:', todo.id);
            // Store action for main app to handle
            this.storeNotificationAction('complete', todo.id);
            break;
          case 'snooze':
            // Snooze for 1 hour
            console.log('Snoozing todo for 1 hour:', todo.id);
            this.storeNotificationAction('snooze', todo.id, { delay: 60 * 60 * 1000 });
            break;
          case 'view':
          default:
            // Navigate to todo page
            window.focus();
            window.location.href = '/todo';
            break;
        }
      };

      // Add notification to history for analytics
      this.addToNotificationHistory(todo, notificationOptions);

    } catch (error) {
      console.error('Error showing reminder notification:', error);
    }
  }

  // Store notification action for main app to handle
  storeNotificationAction(action, todoId, extraData = {}) {
    try {
      const actions = JSON.parse(localStorage.getItem('pendingNotificationActions') || '[]');
      actions.push({
        action,
        todoId,
        timestamp: Date.now(),
        ...extraData
      });

      // Keep only recent actions (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentActions = actions.filter(a => a.timestamp > oneDayAgo);

      localStorage.setItem('pendingNotificationActions', JSON.stringify(recentActions));
      console.log('Notification action stored:', { action, todoId });
    } catch (error) {
      console.error('Error storing notification action:', error);
    }
  }

  // Check browser support for notifications
  checkBrowserSupport() {
    return {
      notification: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window
    };
  }

  // Validate todo object
  validateTodo(todo) {
    return todo && todo.id && todo.title;
  }

  // Handle Capacitor notification (foreground)
  handleCapacitorNotification(notification) {
    console.log('Handling Capacitor notification:', notification);
    // The notification is already shown by the system on mobile
    // We can add custom handling here if needed
  }

  // Handle Capacitor notification action
  handleCapacitorNotificationAction(notification) {
    console.log('Handling Capacitor notification action:', notification);
    const data = notification.notification?.data || {};
    
    if (data.todoId) {
      this.storeNotificationAction('view', data.todoId);
    }
    
    // Navigate to todo page
    if (typeof window !== 'undefined') {
      window.location.href = '/todo';
    }
  }

  // Send push notification via FCM (for server-triggered notifications)
  async sendPushNotification(userId, todo, options = {}) {
    try {
      // Get user's FCM token from database
      const tokenRef = ref(realtimeDb, `users/${userId}/fcmToken`);
      const tokenSnapshot = await get(tokenRef);
      const fcmToken = tokenSnapshot.val();

      if (!fcmToken) {
        console.warn('No FCM token found for user:', userId);
        return false;
      }

      // Note: In production, this should be done via a backend server
      // Client-side FCM sending is not recommended for security reasons
      console.log('Push notification would be sent to token:', fcmToken.substring(0, 20) + '...');
      
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // Add notification to history for analytics
  addToNotificationHistory(todo, options) {
    try {
      const history = JSON.parse(localStorage.getItem('notificationHistory') || '[]');
      history.push({
        todoId: todo.id,
        title: todo.title,
        priority: todo.priority,
        timestamp: Date.now(),
        type: 'reminder'
      });

      // Keep only last 100 notifications
      const recentHistory = history.slice(-100);
      localStorage.setItem('notificationHistory', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error adding to notification history:', error);
    }
  }

  // Get pending notification actions
  getPendingActions() {
    try {
      return JSON.parse(localStorage.getItem('pendingNotificationActions') || '[]');
    } catch (error) {
      return [];
    }
  }

  // Clear pending notification actions
  clearPendingActions() {
    try {
      localStorage.removeItem('pendingNotificationActions');
    } catch (error) {
      console.error('Error clearing pending actions:', error);
    }
  }

  // Update reminders for all todos
  updateReminders(todos) {
    try {
      if (!Array.isArray(todos)) {
        console.warn('updateReminders: todos is not an array');
        return;
      }

      // Clear all existing reminders first
      this.scheduledReminders.forEach((timeoutId, todoId) => {
        clearTimeout(timeoutId);
      });
      this.scheduledReminders.clear();

      // Schedule new reminders for todos that have reminders enabled
      todos.forEach(todo => {
        if (
          todo.reminderDate && 
          !todo.completed && 
          todo.notificationsEnabled !== false
        ) {
          this.scheduleReminder(todo);
        }
      });

      console.log(`Updated reminders for ${todos.length} todos`);
    } catch (error) {
      console.error('Error updating reminders:', error);
    }
  }

  // Cleanup resources
  cleanup() {
    // Clear all scheduled reminders
    this.scheduledReminders.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.scheduledReminders.clear();
    
    this.isInitialized = false;
    console.log('Notification service cleaned up');
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;
