// Sync Settings Storage
// Manages user preferences for auto-refresh behaviour

const SYNC_SETTINGS_KEY = 'mybookshelf_sync_settings';

const DEFAULT_SETTINGS = {
  autoRefreshEnabled: true,
  hiddenThreshold: 30,    // seconds - min hidden time before refresh
  cooldownPeriod: 300     // seconds - min time between refreshes (5 min)
};

/**
 * Get current sync settings from localStorage
 * @returns {Object} Current sync settings merged with defaults
 */
export function getSyncSettings() {
  try {
    const stored = localStorage.getItem(SYNC_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error reading sync settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save sync settings to localStorage
 * @param {Object} settings - Settings to save (merged with existing)
 */
export function saveSyncSettings(settings) {
  try {
    const current = getSyncSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving sync settings:', e);
  }
}

/**
 * Reset sync settings to defaults
 */
export function resetSyncSettings() {
  try {
    localStorage.removeItem(SYNC_SETTINGS_KEY);
  } catch (e) {
    console.error('Error resetting sync settings:', e);
  }
}

/**
 * Get default sync settings
 * @returns {Object} Default settings object
 */
export function getDefaultSyncSettings() {
  return { ...DEFAULT_SETTINGS };
}
