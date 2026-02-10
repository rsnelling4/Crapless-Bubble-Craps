/**
 * PlayFab Service Wrapper
 * Handles basic authentication.
 */

// PlayFab Title ID
const TITLE_ID = "17B826";

// Helper to get PlayFab from global scope
const getPlayFab = () => {
  if (typeof window !== 'undefined' && window.PlayFab) {
    return window.PlayFab;
  }
  return null;
};

const getPlayFabClient = () => {
  const pf = getPlayFab();
  return (pf && pf.ClientApi) ? pf.ClientApi : null;
};

/**
 * Shared helper to extract meaningful error messages from PlayFab
 */
const extractErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  
  // Check for specific field errors in errorDetails
  if (error.errorDetails) {
    const details = Object.entries(error.errorDetails)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');
    if (details) return `${error.errorMessage} (${details})`;
  }
  
  return error.errorMessage || 'An error occurred with PlayFab';
};

// Initialize Title ID
if (typeof window !== 'undefined') {
  const initInterval = setInterval(() => {
    const pf = getPlayFab();
    if (pf) {
      if (pf.settings) {
        pf.settings.titleId = TITLE_ID;
      }
      // Also set it in ClientApi if it exists
      if (pf.ClientApi && pf.ClientApi.settings) {
        pf.ClientApi.settings.titleId = TITLE_ID;
      }
      clearInterval(initInterval);
      console.log("PlayFab SDK ready with Title ID:", TITLE_ID);
    }
  }, 100);
  setTimeout(() => clearInterval(initInterval), 5000);
}

export const playfabService = {
  /**
   * Check if user is logged in
   */
  isLoggedIn: () => {
    const pf = getPlayFab();
    if (!pf) return false;
    
    // Check various possible locations for the session ticket in the JS SDK
    const sessionTicket = 
      (pf._internalSettings && pf._internalSettings.sessionTicket) || 
      (pf.settings && pf.settings._internalSettings && pf.settings._internalSettings.sessionTicket);
      
    return !!sessionTicket;
  },

  /**
   * Silent login with Custom ID (for leaderboard access when not logged in)
   */
  loginSilent: async () => {
    return new Promise((resolve, reject) => {
      const PlayFabClient = getPlayFabClient();
      if (!PlayFabClient) return reject({ errorMessage: "SDK not loaded" });

      // Use a generic ID for guest access or a device ID if available
      let customId = localStorage.getItem('playfab_guest_id');
      if (!customId) {
        customId = 'guest-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('playfab_guest_id', customId);
      }

      const request = {
        TitleId: TITLE_ID,
        CustomId: customId,
        CreateAccount: true
      };

      PlayFabClient.LoginWithCustomID(request, (result, error) => {
        if (error) {
          console.error("PlayFab Silent Login Error:", error);
          reject(error);
        } else {
          console.log("PlayFab Silent Login Success");
          resolve(result);
        }
      });
    });
  },

  /**
   * Register a new user with Username and Password
   */
  register: async (username, password, email) => {
    return new Promise((resolve, reject) => {
      const pf = getPlayFab();
      const PlayFabClient = getPlayFabClient();
      if (!PlayFabClient) return reject({ errorMessage: "SDK not loaded" });

      if (!username || username.length < 3) return reject({ errorMessage: "Username too short" });
      if (!password || password.length < 6) return reject({ errorMessage: "Password too short" });

      // Ensure TitleId is set correctly in settings just before the call
      if (pf && pf.settings) pf.settings.titleId = TITLE_ID;

      const request = {
        Username: String(username),
        Password: String(password),
        Email: String(email || `${username}@example.com`).replace(/\s+/g, ''),
        RequireBothUsernameAndEmail: false
      };

      console.log("PlayFab Register Attempt:", { ...request, Password: '***' });

      PlayFabClient.RegisterPlayFabUser(request, (result, error) => {
        if (error) {
          // Retry with TitleId if InvalidParams
          if (error.error === "InvalidParams" || error.errorCode === 1000) {
            console.log("Register failed with InvalidParams, retrying with TitleId in request...");
            const retryRequest = { ...request, TitleId: TITLE_ID };
            PlayFabClient.RegisterPlayFabUser(retryRequest, (retryResult, retryError) => {
              if (retryError) {
                console.error("PlayFab Register API Error Detail (Retry):", {
                  error: retryError.error,
                  errorCode: retryError.errorCode,
                  errorMessage: retryError.errorMessage,
                  errorDetails: retryError.errorDetails
                });
                retryError.errorMessage = extractErrorMessage(retryError);
                reject(retryError);
              } else {
                resolve(retryResult?.data || retryResult);
              }
            });
            return;
          }

          console.error("PlayFab Register API Error Detail:", {
            error: error.error,
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
            errorDetails: error.errorDetails
          });
          error.errorMessage = extractErrorMessage(error);
          reject(error);
        } else {
          resolve(result?.data || result);
        }
      });
    });
  },

  /**
   * Login with Username and Password
   */
  login: async (username, password) => {
    return new Promise((resolve, reject) => {
      // Try to get the SDK from various possible locations
      const pf = getPlayFab();
      const PlayFabClient = getPlayFabClient();
      
      if (!PlayFabClient) {
        return reject({ errorMessage: "PlayFab SDK not loaded yet. Please wait a moment." });
      }

      if (!username || !password) return reject({ errorMessage: "Username and password required" });

      // Ensure TitleId is set correctly in settings just before the call
      if (pf && pf.settings) pf.settings.titleId = TITLE_ID;

      const request = {
        Username: String(username),
        Password: String(password),
        InfoRequestParameters: {
          GetUserAccountInfo: true,
          GetUserInventory: false,
          GetUserVirtualCurrency: false,
          GetPlayerStatistics: true,
          GetPlayerProfile: true,
          ProfileConstraints: {
            ShowDisplayName: true
          }
        }
      };

      console.log("PlayFab Login Attempt:", { ...request, Password: '***' });

      // Helper to normalize the result (handle both result and result.data)
      const normalizeResult = (res) => {
        if (!res) return null;
        return res.data || res;
      };

      PlayFabClient.LoginWithPlayFab(request, (result, error) => {
        if (error) {
          // If it failed with InvalidParams, maybe it DID need TitleId in the request
          if (error.error === "InvalidParams" || error.errorCode === 1000) {
            console.log("Login failed with InvalidParams, retrying with TitleId in request...");
            const retryRequest = {
              ...request,
              TitleId: TITLE_ID
            };
            PlayFabClient.LoginWithPlayFab(retryRequest, (retryResult, retryError) => {
              if (retryError) {
                console.error("PlayFab Login API Error Detail (Retry):", {
                  error: retryError.error,
                  errorCode: retryError.errorCode,
                  errorMessage: retryError.errorMessage,
                  errorDetails: retryError.errorDetails
                });
                retryError.errorMessage = extractErrorMessage(retryError);
                reject(retryError);
              } else {
                resolve(normalizeResult(retryResult));
              }
            });
            return;
          }

          console.error("PlayFab Login API Error Detail:", {
            error: error.error,
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
            errorDetails: error.errorDetails
          });
          error.errorMessage = extractErrorMessage(error);
          reject(error);
        } else if (result) {
          const normalized = normalizeResult(result);
          console.log("PlayFab Login API Success:", normalized);
          resolve(normalized);
        } else {
          reject({ errorMessage: "No response from PlayFab" });
        }
      });
    });
  },

  /**
   * Update Display Name
   */
  updateDisplayName: async (displayName) => {
    return new Promise((resolve, reject) => {
      const PlayFabClient = getPlayFabClient();
      if (!PlayFabClient) return reject({ errorMessage: "SDK not loaded" });

      PlayFabClient.UpdateUserTitleDisplayName({ DisplayName: displayName }, (result, error) => {
        if (error) {
          console.error("PlayFab DisplayName API Error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  },

  /**
   * Update Player Statistics
   */
  updateStatistics: async (stats) => {
    return new Promise((resolve, reject) => {
      const PlayFabClient = getPlayFabClient();
      if (!PlayFabClient) return reject({ errorMessage: "SDK not loaded" });

      let statistics = [];
      
      if (Array.isArray(stats)) {
        // Handle array format: [{ StatisticName: 'Name', Value: 123 }, ...]
        statistics = stats.map(s => ({
          StatisticName: s.StatisticName,
          Value: Math.floor(s.Value || 0)
        }));
      } else {
        // Handle object format: { Name: 123 }
        statistics = Object.entries(stats).map(([key, value]) => ({
          StatisticName: key,
          Value: Math.floor(value) // PlayFab stats are integers
        }));
      }

      console.log("PlayFab Update Statistics Request:", statistics);

      PlayFabClient.UpdatePlayerStatistics({ Statistics: statistics }, (result, error) => {
        if (error) {
          console.error("PlayFab Statistics API Error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  },

  /**
   * Get Leaderboard for a specific statistic
   */
  getLeaderboard: async (statisticName, maxResults = 10) => {
    return new Promise((resolve, reject) => {
      const PlayFabClient = getPlayFabClient();
      if (!PlayFabClient) return reject({ errorMessage: "SDK not loaded" });

      // ProfileConstraints.ShowStatistics is often restricted in PlayFab Client API
      // by default to prevent data scraping. We'll simplify this to fix "Invalid view constraints".
      const request = {
        StatisticName: statisticName,
        StartPosition: 0,
        MaxResultsCount: maxResults,
        ProfileConstraints: {
          ShowDisplayName: true,
          ShowStatistics: true
        }
      };

      console.log("PlayFab GetLeaderboard Attempt:", request);

      PlayFabClient.GetLeaderboard(request, (result, error) => {
        if (error) {
          // If it fails with view constraints, try even simpler request
          if (error.error === "InvalidParams" && error.errorMessage === "Invalid view constraints") {
            console.warn("PlayFab: 'ShowStatistics' or 'ShowDisplayName' blocked by Title settings. Retrying with minimal constraints...");
            delete request.ProfileConstraints;
            request.ProfileConstraints = { ShowDisplayName: true }; // Try at least DisplayName
            
            PlayFabClient.GetLeaderboard(request, (retryResult, retryError) => {
              if (retryError) {
                console.error("PlayFab: Leaderboard retry failed:", retryError);
                delete request.ProfileConstraints; // Last resort: no constraints
                PlayFabClient.GetLeaderboard(request, (finalResult, finalError) => {
                  if (finalError) reject(finalError);
                  else resolve((finalResult?.data?.Leaderboard) || finalResult?.Leaderboard || []);
                });
              }
              else resolve((retryResult?.data?.Leaderboard) || retryResult?.Leaderboard || []);
            });
            return;
          }
          
          console.error("PlayFab Leaderboard API Error Detail:", {
            error: error.error,
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
            errorDetails: error.errorDetails
          });
          
          reject(error);
        } else {
          console.log("PlayFab Leaderboard API Success:", result);
          const leaderboard = (result?.data?.Leaderboard) || result?.Leaderboard || [];
          resolve(leaderboard);
        }
      });
    });
  }
};
