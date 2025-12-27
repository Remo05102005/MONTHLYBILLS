import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOiRdmo-lmp4ee2mdecy2pgNLn58Y3Zqg",
  authDomain: "monthly-bills-cf513.firebaseapp.com",
  databaseURL: "https://monthly-bills-cf513-default-rtdb.firebaseio.com",
  projectId: "monthly-bills-cf513",
  storageBucket: "monthly-bills-cf513.firebasestorage.app",
  messagingSenderId: "354272728135",
  appId: "1:354272728135:web:254abfbf0a13fbfabc0d62",
  measurementId: "G-PR73BKNLVN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);

// Initialize Analytics (only in supported environments)
let analytics = null;
isAnalyticsSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(() => {});
export { analytics };

// Initialize Messaging (only in supported environments - requires service worker support)
let messaging = null;
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
    messaging = getMessaging(app);
    console.log('Firebase Messaging initialized successfully');
  }
} catch (err) {
  console.warn('Firebase Messaging initialization failed:', err);
  messaging = null;
}
export { messaging };

export default app;
