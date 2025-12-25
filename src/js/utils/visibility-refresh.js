// Visibility-based Auto-Refresh
// Automatically refreshes data when user returns to the tab after being away

import { getSyncSettings } from './sync-settings.js';

// Track last refresh time across all pages (in-memory, resets on page load)
let lastRefreshTime = 0;

/**
 * Set up automatic refresh when tab becomes visible
 * Respects user's sync settings for threshold and cooldown
 *
 * @param {Function} refreshFn - Async function to call when refresh is needed
 * @returns {Function} Cleanup function to remove the listener
 */
export function setupVisibilityRefresh(refreshFn) {
  let hiddenAt = null;

  const handleVisibilityChange = async () => {
    const settings = getSyncSettings();

    // Skip if auto-refresh is disabled
    if (!settings.autoRefreshEnabled) return;

    if (document.hidden) {
      // Tab is now hidden - record the time
      hiddenAt = Date.now();
    } else if (hiddenAt) {
      // Tab is now visible - check if we should refresh
      const hiddenDuration = Date.now() - hiddenAt;
      const timeSinceLastRefresh = Date.now() - lastRefreshTime;

      const hiddenThresholdMs = settings.hiddenThreshold * 1000;
      const cooldownMs = settings.cooldownPeriod * 1000;

      // Only refresh if:
      // 1. Tab was hidden long enough (threshold)
      // 2. Enough time has passed since last refresh (cooldown)
      if (hiddenDuration >= hiddenThresholdMs && timeSinceLastRefresh >= cooldownMs) {
        lastRefreshTime = Date.now();
        try {
          await refreshFn();
        } catch (error) {
          console.error('Auto-refresh failed:', error);
        }
      }

      hiddenAt = null;
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Get the timestamp of the last auto-refresh
 * @returns {number} Timestamp in milliseconds, or 0 if never refreshed
 */
export function getLastRefreshTime() {
  return lastRefreshTime;
}

/**
 * Manually set the last refresh time (useful after manual refresh)
 * @param {number} time - Timestamp in milliseconds (defaults to now)
 */
export function setLastRefreshTime(time = Date.now()) {
  lastRefreshTime = time;
}
