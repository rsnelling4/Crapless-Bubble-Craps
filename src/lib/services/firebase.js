import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6LqmoYS8tHiBqr3n9TjleBWegKhmD5T0",
  authDomain: "bobbys-craps.firebaseapp.com",
  projectId: "bobbys-craps",
  storageBucket: "bobbys-craps.firebasestorage.app",
  messagingSenderId: "606884201685",
  appId: "1:606884201685:web:174d6b394f015cf680ce5c",
  measurementId: "G-R9TPBJ5T4X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Services with robust settings
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, 
  // We use standard persistence without complex tab management to reduce errors
});

export const auth = getAuth(app);

// Set persistent auth state
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Auth persistence error:", error);
  });
}

// Add a helper to check if we are in a production environment
export const isProd = typeof window !== 'undefined' && 
  (window.location.hostname === 'bobbys-craps.web.app' || 
   window.location.hostname === 'bobbys-craps.firebaseapp.com' ||
   window.location.hostname === 'rsnelling4.github.io');

export default app;