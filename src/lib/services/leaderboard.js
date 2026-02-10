import { db, auth } from './firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromCache,
  getDocFromServer,
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';

/**
 * Helper to fetch a document with fallback for offline/cache issues
 */
async function getDocWithFallback(docRef) {
  try {
    // Try getDoc directly - Firestore handles cache/server internally by default
    // We only use specific server/cache calls if this fails
    return await getDoc(docRef);
  } catch (error) {
    console.warn("leaderboard: getDoc failed, trying cache explicitly", error);
    try {
      return await getDocFromCache(docRef);
    } catch (cacheError) {
      console.error("leaderboard: fatal doc fetch error", cacheError);
      throw cacheError;
    }
  }
}

/**
 * Signs up a new user using Firebase Auth and creates a profile in Firestore
 */
export async function signupUser(username, password, nickname) {
  console.log('leaderboard: signupUser called', { username, nickname });
  const lowerUsername = username.toLowerCase();
  const email = `${lowerUsername}@craps.local`;
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('leaderboard: auth user created', user.uid);

    // Update Firebase Auth profile
    await updateProfile(user, { displayName: nickname });

    // Create Firestore document
    const userData = {
      username, // Keep original casing for display
      nickname,
      balance: 300,
      highestBalance: 300,
      largestWin: 0,
      largestLoss: 0,
      resetCount: 0,
      lastUpdate: serverTimestamp()
    };

    console.log('leaderboard: setting firestore doc', lowerUsername);
    await setDoc(doc(db, USERS_COLLECTION, lowerUsername), userData);
    return { ...userData, uid: user.uid };
  } catch (error) {
    console.error("leaderboard: signup error:", error);
    throw error;
  }
}

/**
 * Logs in an existing user using Firebase Auth
 */
export async function loginUser(username, password) {
  console.log('leaderboard: loginUser called', username);
  const lowerUsername = username.toLowerCase();
  const email = `${lowerUsername}@craps.local`;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('leaderboard: auth login successful', user.uid);

    // Fetch stats from Firestore
    console.log('leaderboard: fetching firestore doc', lowerUsername);
    const userDoc = await getDocWithFallback(doc(db, USERS_COLLECTION, lowerUsername));
    if (userDoc.exists()) {
      console.log('leaderboard: firestore doc found');
      return { ...userDoc.data(), uid: user.uid };
    } else {
      console.log('leaderboard: firestore doc NOT found, using fallback');
      // Fallback if doc doesn't exist yet
      return { username, nickname: user.displayName || username, balance: 300, uid: user.uid };
    }
  } catch (error) {
    console.error("leaderboard: login error:", error);
    throw error;
  }
}

/**
 * Logs out the current user
 */
export async function logoutUser() {
  return await signOut(auth);
}

/**
 * Subscribes to auth state changes
 */
export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in, fetch their Firestore data
      const lowerUsername = user.email.split('@')[0];
      console.log('leaderboard: auth state change - logged in', lowerUsername);
      const userDoc = await getDocWithFallback(doc(db, USERS_COLLECTION, lowerUsername));
      if (userDoc.exists()) {
        callback({ ...userDoc.data(), uid: user.uid });
      } else {
        callback({ username: lowerUsername, nickname: user.displayName || lowerUsername, balance: 300, uid: user.uid });
      }
    } else {
      console.log('leaderboard: auth state change - logged out');
      callback(null);
    }
  });
}

/**
 * Subscribes to leaderboard updates in real-time
 * @param {Function} callback - Function called with updated users array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLeaderboard(callback) {
  const q = query(
    collection(db, USERS_COLLECTION),
    orderBy('balance', 'desc')
  );

  let retryCount = 0;
  const maxRetries = 3;

  const createSnapshot = () => {
    return onSnapshot(q, (snapshot) => {
      retryCount = 0; // Reset retry count on successful sync
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to ISO strings for component compatibility
        lastUpdate: doc.data().lastUpdate?.toDate?.()?.toISOString() || new Date().toISOString()
      }));
      console.log(`Leaderboard synced: ${users.length} users found.`);
      callback(users);
    }, (error) => {
      console.error("Leaderboard subscription error:", error);
      
      // If it's a network/abort error, try to reconnect a few times
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`Attempting to reconnect leaderboard (attempt ${retryCount}/${maxRetries}) in ${delay}ms...`);
        setTimeout(createSnapshot, delay);
      }
    });
  };

  return createSnapshot();
}

/**
 * Updates a single user's stats in Firestore
 * @param {Object} userStats - User statistics to update
 */
export async function updateGlobalUser(userStats) {
  if (!userStats || userStats.username === 'Guest') return;

  const lowerUsername = userStats.username.toLowerCase();
  const userRef = doc(db, USERS_COLLECTION, lowerUsername);
  
  const sanitizedUser = {
    username: userStats.username,
    nickname: userStats.nickname || userStats.username,
    balance: userStats.balance || 300,
    highestBalance: userStats.highestBalance || 0,
    largestWin: userStats.largestWin || 0,
    largestLoss: userStats.largestLoss || 0,
    resetCount: userStats.resetCount || 0,
    lastUpdate: serverTimestamp()
  };

  try {
    // Use setDoc with merge: true to create or update
    await setDoc(userRef, sanitizedUser, { merge: true });
  } catch (error) {
    console.error("Error updating global user:", error);
  }
}

/**
 * Syncs multiple local users to Firestore and creates Auth accounts if needed
 * @param {Array} localUsers - Array of local user objects
 */
export async function syncAllLocalUsers(localUsers) {
  if (!localUsers || localUsers.length === 0) return;

  console.log(`Checking ${localUsers.length} local users for Firebase sync...`);
  
  for (const u of localUsers) {
    if (u.username === 'Guest') continue;

    try {
      const lowerUsername = u.username.toLowerCase();
      // 1. Check if Firestore doc exists
      const userRef = doc(db, USERS_COLLECTION, lowerUsername);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log(`Migrating user ${u.username} to Firebase...`);
        // 2. Create Auth account if password exists (dummy email)
        if (u.password) {
          try {
            const email = `${lowerUsername}@craps.local`;
            await createUserWithEmailAndPassword(auth, email, u.password);
            await updateProfile(auth.currentUser, { displayName: u.nickname || u.username });
            console.log(`Auth account created for ${u.username}`);
          } catch (authError) {
            if (authError.code !== 'auth/email-already-in-use') {
              console.warn(`Auth creation failed for ${u.username}:`, authError.message);
            }
          }
        }
        
        // 3. Create Firestore doc
        await updateGlobalUser(u);
      }
    } catch (error) {
      console.error(`Error syncing user ${u.username}:`, error);
    }
  }
  console.log("Local users sync check complete.");
}

// Keep legacy exports for compatibility during transition if needed
export async function fetchGlobalUsers() {
  const q = query(collection(db, USERS_COLLECTION), orderBy('balance', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    lastUpdate: doc.data().lastUpdate?.toDate?.()?.toISOString() || new Date().toISOString()
  }));
}