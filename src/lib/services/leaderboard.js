import { playfabService } from './playfab';

const SESSION_KEY = 'bubble_craps_session';
let authSubscribers = [];
let leaderboardSubscribers = [];
let currentUser = null;
let currentLeaderboard = [];
let isUpdatingStats = false;
let pendingStatsUpdate = null;

function saveLocalSession(session) {
  if (typeof window === 'undefined') return;
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function notifyAuthSubscribers(user) {
  currentUser = user;
  authSubscribers.forEach(cb => cb(user));
}

function notifyLeaderboardSubscribers(users) {
  currentLeaderboard = users;
  leaderboardSubscribers.forEach(cb => cb(users));
}

/**
 * Basic Signup/Login using PlayFab
 */
export async function signupUser(username, password, nickname) {
  console.log('Leaderboard Bridge: signupUser', { username });
  
  if (!username || username.length < 3) {
    throw { code: 'auth/error', message: 'Username must be at least 3 characters long' };
  }
  if (!password || password.length < 6) {
    throw { code: 'auth/error', message: 'Password must be at least 6 characters long' };
  }

  try {
    // First register the user
    const registerResult = await playfabService.register(username, password);
    
    // Then update display name if provided
    if (nickname) {
      try {
        await playfabService.updateDisplayName(nickname);
      } catch (nameError) {
        console.warn("Failed to set display name:", nameError);
      }
    }

    const userData = {
      username,
      nickname: nickname || username,
      uid: registerResult.PlayFabId,
      balance: 300,
      highestBalance: 300,
      largestWin: 0,
      largestLoss: 0,
      resetCount: 0,
      mode: 'user'
    };

    saveLocalSession({ username, mode: 'user', uid: userData.uid });
    notifyAuthSubscribers(userData);
    
    // Initialize statistics for new user
    await updateGlobalUser(userData);
    
    return userData;
  } catch (error) {
    console.error("Signup Bridge Error:", error);
    const msg = error.errorMessage || error.message || 'Signup failed';
    throw { code: 'auth/error', message: msg };
  }
}

export async function loginUser(username, password) {
  console.log('Leaderboard Bridge: loginUser', { username });
  
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  try {
    console.log("Leaderboard Bridge: Starting login for", username);
    const loginResult = await playfabService.login(username, password);
    
    if (!loginResult) {
      throw new Error("Login succeeded but no data was returned from PlayFab");
    }

    console.log("Leaderboard Bridge: Login raw result keys:", Object.keys(loginResult));
    const payload = loginResult.InfoResultPayload;
    if (!payload) {
      console.warn("Leaderboard Bridge: InfoResultPayload is missing in login result!");
    }

    const profile = payload?.PlayerProfile;
    const statistics = payload?.PlayerStatistics || [];
    
    console.log("Leaderboard Bridge: Raw statistics found:", statistics.length, statistics);

    const getStat = (name) => {
      // Try exact match first, then case-insensitive match
      let stat = statistics.find(s => s.StatisticName === name || s.Name === name);
      if (!stat) {
        stat = statistics.find(s => (s.StatisticName || s.Name || "").toLowerCase() === name.toLowerCase());
      }
      
      if (stat) {
        console.log(`Leaderboard Bridge: Found stat ${name} = ${stat.Value}`);
        return stat.Value;
      }
      console.log(`Leaderboard Bridge: Stat ${name} not found in PlayFab profile`);
      return null;
    };

    const userData = {
      username,
      nickname: profile?.DisplayName || username,
      uid: loginResult.PlayFabId,
      balance: getStat('Balance') ?? 300,
      highestBalance: getStat('highestBalance') ?? (getStat('Balance') ?? 300),
      largestWin: getStat('largestWin') ?? 0,
      largestLoss: getStat('largestLoss') ?? 0,
      resetCount: getStat('resetCount') ?? 0,
      mode: 'user'
    };

    console.log("Leaderboard Bridge: User data constructed:", userData);
    
    saveLocalSession({ username, mode: 'user', uid: userData.uid });
    notifyAuthSubscribers(userData);
    
    fetchGlobalUsers().catch(err => console.error("Initial leaderboard fetch failed:", err));
    
    return userData;
  } catch (error) {
    console.error("Login Bridge Error:", error);
    const msg = error.errorMessage || error.message || 'Login failed';
    throw { code: 'auth/error', message: msg };
  }
}

export async function logoutUser() {
  saveLocalSession(null);
  notifyAuthSubscribers(null);
}

export function subscribeToAuth(callback) {
  authSubscribers.push(callback);
  
  if (typeof window !== 'undefined') {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr && !currentUser) {
      // Don't auto-signup/login with password because we don't have it.
      // Instead, we just notify that we are not logged in.
      // The UI will show the login screen.
      setTimeout(() => callback(null), 0);
    } else {
      setTimeout(() => callback(currentUser), 0);
    }
  }

  return () => {
    authSubscribers = authSubscribers.filter(cb => cb !== callback);
  };
}

/**
 * Fetch global users for the leaderboard (using multiple statistics)
 */
export async function fetchGlobalUsers() {
  try {
    // Ensure we are authenticated with PlayFab before fetching
    if (!playfabService.isLoggedIn()) {
      console.log("Auth Bridge: Not logged in, performing silent login for leaderboard access");
      await playfabService.loginSilent();
    }

    const statNames = ['Balance', 'highestBalance', 'largestWin', 'largestLoss', 'resetCount'];
    console.log(`Auth Bridge: Fetching leaderboards for: ${statNames.join(', ')}`);

    // Fetch all leaderboards in parallel
    const results = await Promise.allSettled(
      statNames.map(name => playfabService.getLeaderboard(name, 10))
    );

    const userMap = new Map();

    results.forEach((result, index) => {
      const statName = statNames[index];
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        result.value.forEach(entry => {
          const uid = entry.PlayFabId;
          const profile = entry.Profile || entry.PlayerProfile;
          const profileStats = profile?.Statistics || [];

          if (!userMap.has(uid)) {
            userMap.set(uid, {
              uid: uid,
              username: entry.DisplayName || uid,
              nickname: entry.DisplayName || uid,
              balance: 0,
              highestBalance: 0,
              largestWin: 0,
              largestLoss: 0,
              resetCount: 0,
              lastUpdate: profile?.LastLogin || new Date().toISOString()
            });
          }

          const user = userMap.get(uid);
          
          // Update the specific stat for this leaderboard
          if (statName === 'Balance') user.balance = entry.StatValue;
          else if (statName === 'highestBalance') user.highestBalance = entry.StatValue;
          else if (statName === 'largestWin') user.largestWin = entry.StatValue;
          else if (statName === 'largestLoss') user.largestLoss = entry.StatValue;
          else if (statName === 'resetCount') user.resetCount = entry.StatValue;

          // Also supplement with any other stats found in the profile
          profileStats.forEach(s => {
            const name = s.Name || s.StatisticName;
            const val = s.Value;
            if (name === 'Balance') user.balance = val;
            else if (name === 'highestBalance') user.highestBalance = val;
            else if (name === 'largestWin') user.largestWin = val;
            else if (name === 'largestLoss') user.largestLoss = val;
            else if (name === 'resetCount') user.resetCount = val;
          });
        });
      } else if (result.status === 'rejected') {
        console.warn(`Auth Bridge: Failed to fetch leaderboard for ${statName}:`, result.reason);
      }
    });

    const formattedUsers = Array.from(userMap.values());
    console.log(`Auth Bridge: Unified ${formattedUsers.length} unique leaderboard entries`);

    notifyLeaderboardSubscribers(formattedUsers);
    return formattedUsers;
  } catch (error) {
    console.error("Failed to fetch global users:", error);
    return currentLeaderboard;
  }
}

/**
 * Subscribe to leaderboard updates
 */
export function subscribeToLeaderboard(callback) {
  leaderboardSubscribers.push(callback);
  // Send current data immediately
  setTimeout(() => callback(currentLeaderboard), 0);
  
  return () => {
    leaderboardSubscribers = leaderboardSubscribers.filter(cb => cb !== callback);
  };
}

/**
 * Update global user statistics in PlayFab with conflict prevention
 */
export async function updateGlobalUser(userData) {
  if (!userData || userData.mode === 'guest') return;

  const stats = {
    Balance: userData.balance ?? 0,
    highestBalance: userData.highestBalance ?? 0,
    largestLoss: userData.largestLoss ?? 0,
    largestWin: userData.largestWin ?? 0,
    resetCount: userData.resetCount ?? 0
  };

  // If already updating, queue this one and return a promise that will resolve
  // when the current update (and any subsequent queued updates) finish.
  if (isUpdatingStats) {
    console.log("Leaderboard Bridge: Stat update already in progress, queuing latest stats");
    pendingStatsUpdate = stats;
    // We return a promise that will resolve eventually, but for now we just return
    return;
  }

  isUpdatingStats = true;

  const performUpdate = async (statsToUse) => {
    try {
      console.log("Leaderboard Bridge: Pushing stats to PlayFab:", statsToUse);
      await playfabService.updateStatistics(statsToUse);
      // Refresh leaderboard after update
      await fetchGlobalUsers();
      console.log("Leaderboard Bridge: Stat update successful");
    } catch (error) {
      // If it's a conflict (409), we'll let the next queued update handle it
      if (error.code === 409) {
        console.warn("PlayFab Stat Update Conflict (409) - a newer update will follow.");
      } else {
        console.error("Failed to update global user statistics:", error);
      }
    } finally {
      // Check if a new update came in while we were processing
      if (pendingStatsUpdate) {
        console.log("Leaderboard Bridge: Processing queued stats update");
        const nextStats = { ...pendingStatsUpdate };
        pendingStatsUpdate = null;
        // Continue the chain
        await performUpdate(nextStats);
      } else {
        isUpdatingStats = false;
        console.log("Leaderboard Bridge: All stat updates complete");
      }
    }
  };

  return await performUpdate(stats);
}

/**
 * Wait for any pending stat updates to complete
 */
export async function waitForPendingUpdates() {
  if (!isUpdatingStats) return;
  
  console.log("Leaderboard Bridge: Waiting for pending updates to finish...");
  return new Promise(resolve => {
    const check = () => {
      if (!isUpdatingStats) {
        console.log("Leaderboard Bridge: Pending updates finished.");
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
