// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/11.7.3/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.3/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDOiRdmo-lmp4ee2mdecy2pgNLn58Y3Zqg",
  authDomain: "monthly-bills-cf513.firebaseapp.com",
  databaseURL: "https://monthly-bills-cf513-default-rtdb.firebaseio.com",
  projectId: "monthly-bills-cf513",
  storageBucket: "monthly-bills-cf513.firebasestorage.app",
  messagingSenderId: "354272728135",
  appId: "1:354272728135:web:254abfbf0a13fbfabc0d62",
  measurementId: "G-PR73BKNLVN"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const todoData = payload.data || {};
  const priority = todoData.priority || 'medium';

  // Enhanced notification content for background messages
  const priorityEmoji = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };

  const notificationTitle = `${priorityEmoji[priority] || '📝'} COMMON MAN`;

  // Build rich notification body for background
  let notificationBody = `⏰ ${payload.notification?.body || 'You have a reminder'}`;

  // Add additional context if available
  if (todoData.category) {
    notificationBody += `\n🏷️ ${todoData.category}`;
  }

  // Priority-specific notification settings for background
  const getBackgroundNotificationSettings = (priority) => {
    switch (priority) {
      case 'high':
        return {
          icon: '/logo192.png',
          badge: '/favicon.ico',
          tag: `bg-todo-high-${todoData.todoId}`,
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
          tag: `bg-todo-medium-${todoData.todoId}`,
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
          tag: `bg-todo-${todoData.todoId}`,
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
    ...getBackgroundNotificationSettings(priority),
    data: {
      todoId: todoData.todoId,
      priority: priority,
      url: '/todo',
      timestamp: Date.now(),
      source: 'background'
    },
    // Enhanced visual options
    lang: 'en-US',
    dir: 'ltr',
    // Add vibration pattern for mobile devices
    vibrate: priority === 'high' ? [200, 100, 200, 100, 200] : priority === 'medium' ? [100, 50, 100] : undefined
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);

  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};

  // Handle dismiss action
  if (action === 'dismiss') {
    return;
  }

  // Handle different notification actions
  switch (action) {
    case 'complete':
      // For background notifications, we can't directly modify the app state
      // Instead, we'll open the app and let it handle the completion
      console.log('Marking todo as complete from notification:', notificationData.todoId);
      // Store the action in IndexedDB or localStorage for the main app to pick up
      storeNotificationAction('complete', notificationData.todoId);
      break;

    case 'snooze':
      console.log('Snoozing notification for todo:', notificationData.todoId);
      // Schedule a new reminder 1 hour from now
      storeNotificationAction('snooze', notificationData.todoId, { delay: 60 * 60 * 1000 }); // 1 hour
      break;

    case 'view':
    default:
      // Default action: open the app
      break;
  }

  // Open or focus the app
  const urlToOpen = notificationData.url || '/todo';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          // Send message to the client about the notification action
          if (action && notificationData.todoId) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: action,
              todoId: notificationData.todoId,
              data: notificationData
            });
          }
          return client.focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen).then((client) => {
          // Send message to the new client after it opens
          if (action && notificationData.todoId) {
            setTimeout(() => {
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: action,
                todoId: notificationData.todoId,
                data: notificationData
              });
            }, 1000); // Small delay to ensure the client is ready
          }
        });
      }
    })
  );
});

// Store notification actions for the main app to handle
function storeNotificationAction(action, todoId, extraData = {}) {
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
}
