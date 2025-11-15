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
    // Use environment variable for VAPID key (security)
    this.vapidKey = process.env.REACT_APP_FCM_VAPID_KEY || 'BJzQ8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8'; // Fallback for development
    this.scheduledReminders = new Map();
    this.eventListeners = new Set(); // Track event listeners for cleanup
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // Request notification permission
  async requestPermission() {
    try {
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

  // Get FCM token
  async getFCMToken() {
    try {
      const token = await getToken(messaging, {
        vapidKey: this.vapidKey
      });
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Save FCM token to user profile
  async saveFCMToken(userId, token) {
    try {
      await set(ref(realtimeDb, `users/${userId}/fcmToken`), token);
      console.log('FCM token saved');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  // Initialize notifications for user
  async initializeNotifications(userId) {
    if (isCapacitor()) {
      return await this.initializeCapacitorNotifications(userId);
    } else {
      return await this.initializeWebNotifications(userId);
    }
  }

  // Initialize notifications for web environment
  async initializeWebNotifications(userId) {
    const permissionGranted = await this.requestPermission();
    if (!permissionGranted) return false;

    const token = await this.getFCMToken();
    if (token) {
      await this.saveFCMToken(userId, token);
      this.setupForegroundNotifications();
      return true;
    }
    return false;
  }

  // Initialize notifications for Capacitor environment
  async initializeCapacitorNotifications(userId) {
    try {
      // Dynamically import Capacitor plugins
      const { PushNotifications: PushPlugin, Capacitor: CapPlugin } = await import('@capacitor/push-notifications');
      PushNotifications = PushPlugin;
      Capacitor = CapPlugin;

      // Request permission
      let permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        throw new Error('Push notification permission denied');
      }

      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration success
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        await this.saveFCMToken(userId, token.value);
      });

      // Listen for push notification received
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);

        // Handle the notification (show local notification if needed)
        this.handleCapacitorNotification(notification);
      });

      // Listen for push notification action performed
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed', notification);

        // Handle the action (mark complete, snooze, etc.)
        this.handleCapacitorNotificationAction(notification);
      });

      return true;
    } catch (error) {
      console.error('Error initializing Capacitor notifications:', error);
      return false;
    }
  }

  // Setup foreground message handling
  setupForegroundNotifications() {
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
        new Notification(notificationTitle, notificationOptions);
      }
    });
  }

  // Schedule a reminder notification
  scheduleReminder(todo) {
    if (!todo.reminderDate) return;

    const reminderTime = new Date(todo.reminderDate).getTime();
    const now = Date.now();
    const delay = reminderTime - now;

    if (delay <= 0) return; // Reminder time has passed

    // Clear any existing reminder for this todo
    this.clearReminder(todo.id);

    // Schedule new reminder
    const timeoutId = setTimeout(() => {
      this.showReminderNotification(todo);
    }, delay);

    this.scheduledReminders.set(todo.id, timeoutId);
    console.log(`Reminder scheduled for ${todo.title} in ${Math.round(delay / 1000 / 60)} minutes`);
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
    if (Notification.permission !== 'granted') return;

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
    }

    // Enhanced notification content based on priority
    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const priorityText = {
      high: 'HIGH PRIORITY',
      medium: 'MEDIUM PRIORITY',
      low: 'LOW PRIORITY'
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
          break;
        case 'snooze':
          // Snooze for 1 hour
          this.scheduleReminder({
            ...todo,
            reminderDate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
          });
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
  }

  // Add notification to history (for analytics)
  addToNotificationHistory(todo, options) {
    const history = JSON.parse(localStorage.getItem('notificationHistory') || '[]');
    history.push({
      todoId: todo.id,
      title: todo.title,
      priority: todo.priority,
      timestamp: Date.now(),
      shown: true
    });

    // Keep only last 100 notifications
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    localStorage.setItem('notificationHistory', JSON.stringify(history));
  }

  // Update reminders when todos change
  updateReminders(todos) {
    // Clear all existing reminders
    this.scheduledReminders.forEach((timeoutId, todoId) => {
      clearTimeout(timeoutId);
    });
    this.scheduledReminders.clear();

    // Schedule reminders for pending todos with reminder dates (only high and medium priority)
    todos
      .filter(todo => !todo.completed && todo.reminderDate && (todo.priority === 'high' || todo.priority === 'medium'))
      .forEach(todo => {
        this.scheduleReminder(todo);
      });
  }

  // Handle Capacitor notification received
  handleCapacitorNotification(notification) {
    console.log('Handling Capacitor notification:', notification);

    // For Capacitor, notifications are automatically shown by the system
    // We can add custom handling here if needed
    // The notification data will be processed when user interacts with it
  }

  // Handle Capacitor notification action
  handleCapacitorNotificationAction(notification) {
    console.log('Handling Capacitor notification action:', notification);

    const actionId = notification.actionId;
    const notificationData = notification.notification?.data || {};

    // Store action for main app to handle
    const actionData = {
      action: actionId,
      todoId: notificationData.todoId,
      timestamp: Date.now(),
      source: 'capacitor'
    };

    // Store in localStorage for main app to pick up
    const pendingActions = JSON.parse(localStorage.getItem('pendingNotificationActions') || '[]');
    pendingActions.push(actionData);
    localStorage.setItem('pendingNotificationActions', JSON.stringify(pendingActions));

    // If app is in foreground, we could trigger navigation here
    // For now, the main app will handle this when it checks for pending actions
  }

  // Send push notification via FCM (for server-side triggering)
  async sendPushNotification(userId, todo, options = {}) {
    try {
      // Get user's FCM token
      const tokenRef = ref(realtimeDb, `users/${userId}/fcmToken`);
      const tokenSnapshot = await get(tokenRef);
      const fcmToken = tokenSnapshot.val();

      if (!fcmToken) {
        console.warn('No FCM token found for user:', userId);
        return false;
      }

      // Prepare notification payload
      const payload = {
        to: fcmToken,
        notification: {
          title: `${options.priorityEmoji || '📝'} COMMON MAN`,
          body: this.buildNotificationBody(todo),
          icon: '/logo192.png',
          badge: '/favicon.ico',
          click_action: '/todo'
        },
        data: {
          todoId: todo.id,
          priority: todo.priority,
          category: todo.category,
          url: '/todo'
        },
        android: {
          priority: todo.priority === 'high' ? 'high' : 'default',
          notification: {
            sound: todo.priority === 'high' ? 'default' : undefined,
            channel_id: `todo_${todo.priority}`,
            click_action: '/todo'
          }
        },
        apns: {
          headers: {
            'apns-priority': todo.priority === 'high' ? '10' : '5'
          },
          payload: {
            aps: {
              alert: {
                title: `${options.priorityEmoji || '📝'} COMMON MAN`,
                body: this.buildNotificationBody(todo)
              },
              sound: todo.priority === 'high' ? 'default' : undefined,
              category: `TODO_${todo.priority.toUpperCase()}`
            }
          }
        }
      };

      // Actually send the notification via FCM API
      const serverKey = process.env.REACT_APP_FCM_SERVER_KEY;
      if (!serverKey) {
        console.error('REACT_APP_FCM_SERVER_KEY not set. Cannot send push notifications.');
        return false;
      }

      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${serverKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('FCM API error:', response.status, errorData);
          return false;
        }

        const result = await response.json();
        console.log('Push notification sent successfully:', result);
        return true;
      } catch (error) {
        console.error('Error sending push notification via FCM:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  // Build notification body text
  buildNotificationBody(todo) {
    let body = `⏰ ${todo.title}`;
    if (todo.description) {
      body += `\n📝 ${todo.description.substring(0, 50)}${todo.description.length > 50 ? '...' : ''}`;
    }
    if (todo.category) {
      body += `\n🏷️ ${todo.category}`;
    }
    if (todo.dueDate) {
      const dueDate = new Date(todo.dueDate);
      const now = new Date();
      const daysDiff = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        body += `\n⚠️ OVERDUE by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''}`;
      } else if (daysDiff === 0) {
        body += `\n📅 Due TODAY`;
      } else if (daysDiff === 1) {
        body += `\n📅 Due TOMORROW`;
      } else {
        body += `\n📅 Due in ${daysDiff} days`;
      }
    }
    return body;
  }

  // Get scheduled reminders count
  getScheduledRemindersCount() {
    return this.scheduledReminders.size;
  }

  // Check if running in Capacitor
  isCapacitor() {
    return isCapacitor();
  }

  // Cleanup method for memory management
  cleanup() {
    // Clear all scheduled reminders
    this.scheduledReminders.forEach((timeoutId, todoId) => {
      clearTimeout(timeoutId);
    });
    this.scheduledReminders.clear();

    // Remove event listeners (for Capacitor)
    if (PushNotifications) {
      try {
        // Note: Capacitor doesn't provide a direct way to remove listeners
        // They are automatically cleaned up when the app is destroyed
        console.log('Capacitor listeners will be cleaned up automatically');
      } catch (e) {
        console.warn('Error during cleanup:', e);
      }
    }

    this.isInitialized = false;
    this.initializationPromise = null;
    console.log('NotificationService cleanup completed');
  }

  // Safe localStorage operations with size limits
  safeLocalStorageSet(key, value) {
    try {
      const serializedValue = JSON.stringify(value);

      // Check if data is too large (localStorage limit is ~5MB)
      if (serializedValue.length > 4 * 1024 * 1024) { // 4MB limit
        console.warn(`Data too large for localStorage key: ${key}`);
        return false;
      }

      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error(`Error saving to localStorage (${key}):`, error);
      return false;
    }
  }

  safeLocalStorageGet(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return defaultValue;
    }
  }

  // Validate todo object
  validateTodo(todo) {
    if (!todo || typeof todo !== 'object') {
      console.error('Invalid todo object:', todo);
      return false;
    }

    if (!todo.id || typeof todo.id !== 'string') {
      console.error('Todo must have a valid id:', todo);
      return false;
    }

    if (!todo.title || typeof todo.title !== 'string' || todo.title.trim().length === 0) {
      console.error('Todo must have a valid title:', todo);
      return false;
    }

    return true;
  }

  // Check browser compatibility
  checkBrowserSupport() {
    const checks = {
      notification: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      localStorage: 'localStorage' in window,
      indexedDB: 'indexedDB' in window,
      fetch: 'fetch' in window,
      promise: 'Promise' in window,
      capacitor: typeof window !== 'undefined' && !!window.Capacitor
    };

    const supported = Object.values(checks).every(Boolean);
    if (!supported) {
      console.warn('Browser compatibility issues detected:', checks);
    }

    return checks;
  }

  // Singleton pattern to prevent multiple instances
  static getInstance() {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
