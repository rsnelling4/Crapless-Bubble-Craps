// Global Leaderboard Service using npoint.io for simple shared state
// This allows a "Global" leaderboard on a static site without a real backend.

const BIN_ID = '9f7d4c2b8a1e6d3f5a7c'; 
const API_URL = `https://api.npoint.io/${BIN_ID}`;

let isFetching = false;
let lastFetchTime = 0;
const FETCH_COOLDOWN = 2000; // 2s cooldown between any global operations

export async function fetchGlobalUsers() {
  if (isFetching) return null;
  
  // Debounce rapid calls
  const now = Date.now();
  if (now - lastFetchTime < FETCH_COOLDOWN) return null;

  isFetching = true;
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      if (response.status === 404 || response.status === 401) return [];
      return []; 
    }
    const data = await response.json();
    lastFetchTime = Date.now();
    return Array.isArray(data.users) ? data.users : [];
  } catch (error) {
    // Completely silent for network/abort errors to keep console clean
    return null;
  } finally {
    isFetching = false;
  }
}

export async function updateGlobalUser(userStats) {
  if (!userStats || userStats.username === 'Guest') return;
  if (isFetching) return null;

  isFetching = true;
  try {
    // 1. Get current
    const response = await fetch(API_URL);
    let users = [];
    if (response.ok) {
      const data = await response.json();
      users = Array.isArray(data.users) ? data.users : [];
    }

    const userIdx = users.findIndex(u => u.username === userStats.username);
    const sanitizedUser = {
      username: userStats.username,
      password: userStats.password, // Store password for later login
      nickname: userStats.nickname || userStats.username,
      balance: userStats.balance || 300,
      highestBalance: userStats.highestBalance || 0,
      largestWin: userStats.largestWin || 0,
      largestLoss: userStats.largestLoss || 0,
      resetCount: userStats.resetCount || 0,
      lastUpdate: new Date().toISOString(),
      isOnline: true
    };

    if (userIdx !== -1) {
      const existing = users[userIdx];
      users[userIdx] = {
        ...existing,
        ...sanitizedUser,
        highestBalance: Math.max(existing.highestBalance || 0, sanitizedUser.highestBalance),
        largestWin: Math.max(existing.largestWin || 0, sanitizedUser.largestWin),
      };
    } else {
      users.push(sanitizedUser);
    }

    // 2. Save
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    });

    lastFetchTime = Date.now();
    return users;
  } catch (error) {
    return null;
  } finally {
    isFetching = false;
  }
}

export async function syncAllLocalUsers(localUsers) {
  if (!localUsers || localUsers.length === 0 || isFetching) return;

  isFetching = true;
  try {
    const response = await fetch(API_URL);
    let globalUsers = [];
    if (response.ok) {
      const data = await response.json();
      globalUsers = Array.isArray(data.users) ? data.users : [];
    }

    let changed = false;
    localUsers.forEach(local => {
      if (local.username === 'Guest') return;
      const idx = globalUsers.findIndex(g => g.username === local.username);
      const sanitizedLocal = {
        username: local.username,
        password: local.password, // Store password for later login
        nickname: local.nickname || local.username,
        balance: local.balance || 300,
        highestBalance: local.highestBalance || 0,
        largestWin: local.largestWin || 0,
        largestLoss: local.largestLoss || 0,
        resetCount: local.resetCount || 0,
        lastUpdate: new Date().toISOString(),
        isOnline: true
      };

      if (idx !== -1) {
        const existing = globalUsers[idx];
        if (sanitizedLocal.highestBalance > (existing.highestBalance || 0)) {
          globalUsers[idx] = { ...existing, ...sanitizedLocal };
          changed = true;
        }
      } else {
        globalUsers.push(sanitizedLocal);
        changed = true;
      }
    });

    if (changed) {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: globalUsers })
      });
    }
    
    lastFetchTime = Date.now();
    return globalUsers;
  } catch (error) {
    return null;
  } finally {
    isFetching = false;
  }
}
