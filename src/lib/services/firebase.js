import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
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

// Initialize Services with robust settings for development/preview environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Fixes net::ERR_ABORTED in many proxy/preview environments
});

export const auth = getAuth(app);

export default app;