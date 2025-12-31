// Sync Settings Storage
// Manages user preferences for auto-refresh behaviour

/** Sync settings structure */
export interface SyncSettingsData {
  autoRefreshEnabled: boolean;
  /** Minimum hidden time before refresh (seconds) */
  hiddenThreshold: number;
  /** Minimum time between refreshes in seconds */
  cooldownPeriod: number;
  /** Show API suggestions before user items in pickers (default: false - user items first) */
  suggestionsFirst: boolean;
}

const SYNC_SETTINGS_KEY = 'mybookshelf_sync_settings';

const DEFAULT_SETTINGS: SyncSettingsData = {
  autoRefreshEnabled: true,
  hiddenThreshold: 30, // seconds - min hidden time before refresh
  cooldownPeriod: 300, // seconds - min time between refreshes (5 min)
  suggestionsFirst: false, // user items shown first by default
};

/**
 * Get current sync settings from localStorage
 * @returns Current sync settings merged with defaults
 */
export function getSyncSettings(): SyncSettingsData {
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
 * @param settings - Settings to save (merged with existing)
 */
export function saveSyncSettings(settings: Partial<SyncSettingsData>): void {
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
export function resetSyncSettings(): void {
  try {
    localStorage.removeItem(SYNC_SETTINGS_KEY);
  } catch (e) {
    console.error('Error resetting sync settings:', e);
  }
}

/**
 * Get default sync settings
 * @returns Default settings object
 */
export function getDefaultSyncSettings(): SyncSettingsData {
  return { ...DEFAULT_SETTINGS };
}
