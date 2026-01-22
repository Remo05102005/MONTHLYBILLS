import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPiKr1Oj3aMMsduowa-iFmspuWC5Ir1YY",
  authDomain: "aadhyayavyaya.firebaseapp.com",
  databaseURL: "https://aadhyayavyaya-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aadhyayavyaya",
  storageBucket: "aadhyayavyaya.firebasestorage.app",
  messagingSenderId: "878451712583",
  appId: "1:878451712583:web:5ae89577b94a5aa76d0762",
  measurementId: "G-W1N37SKFF1"
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


export default app;
