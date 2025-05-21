import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';

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
export const analytics = getAnalytics(app);
export default app; 