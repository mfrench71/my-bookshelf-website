/**
 * Widget Settings Storage
 *
 * Handles widget configuration persistence in Firestore with migration
 * from legacy localStorage homeSettings format.
 */

import { db } from '/js/firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { widgetRegistry } from '../widgets/index.js';

const WIDGET_SETTINGS_VERSION = 2;
const LOCAL_CACHE_KEY = 'widgetSettings';
const LEGACY_HOME_SETTINGS_KEY = 'homeSettings';

/**
 * Get default widget configurations from registry
 * @returns {Array<Object>}
 */
export function getDefaultWidgetConfigs() {
  return widgetRegistry.getDefaultConfigs();
}

/**
 * Migrate legacy homeSettings to new widget format
 * @param {Object} homeSettings - Old format: { currentlyReading: { enabled, count }, ... }
 * @returns {Array<Object>} - New format: [{ id, enabled, order, size, settings }, ...]
 */
function migrateFromHomeSettings(homeSettings) {
  const defaultConfigs = getDefaultWidgetConfigs();

  return defaultConfigs.map((config, index) => {
    const legacy = homeSettings[config.id];
    if (legacy) {
      return {
        ...config,
        enabled: legacy.enabled !== false,
        order: index,
        settings: {
          ...config.settings,
          count: legacy.count || config.settings.count,
        },
      };
    }
    return config;
  });
}

/**
 * Load widget settings from Firestore with local cache fallback
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} - { version, widgets: [...] }
 */
export async function loadWidgetSettings(userId) {
  try {
    // Try Firestore first
    const docRef = doc(db, 'users', userId, 'settings', 'widgets');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Merge in any new widgets that don't exist in saved settings
      const defaultConfigs = getDefaultWidgetConfigs();
      const existingIds = new Set(data.widgets.map(w => w.id));
      const newWidgets = defaultConfigs.filter(w => !existingIds.has(w.id));

      if (newWidgets.length > 0) {
        // Add new widgets at the beginning (order 0) and shift existing ones
        const maxOrder = Math.max(...data.widgets.map(w => w.order), -1);
        newWidgets.forEach((widget, i) => {
          widget.order = maxOrder + 1 + i;
        });
        data.widgets = [...data.widgets, ...newWidgets];
      }

      // Cache locally for offline access
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
      return data;
    }

    // Check for legacy homeSettings to migrate
    const legacySettings = localStorage.getItem(LEGACY_HOME_SETTINGS_KEY);
    if (legacySettings) {
      try {
        const parsed = JSON.parse(legacySettings);
        const migratedWidgets = migrateFromHomeSettings(parsed);
        const newSettings = {
          version: WIDGET_SETTINGS_VERSION,
          widgets: migratedWidgets,
        };

        // Save migrated settings to Firestore
        await saveWidgetSettings(userId, newSettings);

        // Remove legacy settings
        localStorage.removeItem(LEGACY_HOME_SETTINGS_KEY);

        return newSettings;
      } catch {
        // Invalid legacy settings, ignore
      }
    }

    // Return defaults for new users
    return {
      version: WIDGET_SETTINGS_VERSION,
      widgets: getDefaultWidgetConfigs(),
    };
  } catch (error) {
    console.error('Error loading widget settings:', error);

    // Fall back to local cache
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache
      }
    }

    // Return defaults as last resort
    return {
      version: WIDGET_SETTINGS_VERSION,
      widgets: getDefaultWidgetConfigs(),
    };
  }
}

/**
 * Save widget settings to Firestore and local cache
 * @param {string} userId - Current user ID
 * @param {Object} settings - { version, widgets: [...] }
 */
export async function saveWidgetSettings(userId, settings) {
  try {
    // Ensure version is set
    const toSave = {
      ...settings,
      version: WIDGET_SETTINGS_VERSION,
      updatedAt: new Date(),
    };

    // Save to Firestore
    const docRef = doc(db, 'users', userId, 'settings', 'widgets');
    await setDoc(docRef, toSave);

    // Update local cache
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error('Error saving widget settings:', error);
    throw error;
  }
}

/**
 * Update a single widget's configuration
 * @param {string} userId - Current user ID
 * @param {string} widgetId - Widget ID to update
 * @param {Object} updates - Partial widget config { enabled?, size?, settings? }
 */
export async function updateWidgetConfig(userId, widgetId, updates) {
  const settings = await loadWidgetSettings(userId);
  const widgetIndex = settings.widgets.findIndex(w => w.id === widgetId);

  if (widgetIndex === -1) {
    throw new Error(`Widget not found: ${widgetId}`);
  }

  settings.widgets[widgetIndex] = {
    ...settings.widgets[widgetIndex],
    ...updates,
    settings: {
      ...settings.widgets[widgetIndex].settings,
      ...updates.settings,
    },
  };

  await saveWidgetSettings(userId, settings);
  return settings;
}

/**
 * Reorder widgets
 * @param {string} userId - Current user ID
 * @param {Array<string>} orderedIds - Widget IDs in desired order
 */
export async function reorderWidgets(userId, orderedIds) {
  const settings = await loadWidgetSettings(userId);

  // Create a map for quick lookup
  const widgetMap = new Map(settings.widgets.map(w => [w.id, w]));

  // Rebuild widgets array in new order
  settings.widgets = orderedIds.map((id, index) => {
    const widget = widgetMap.get(id);
    if (!widget) {
      throw new Error(`Widget not found: ${id}`);
    }
    return { ...widget, order: index };
  });

  await saveWidgetSettings(userId, settings);
  return settings;
}

/**
 * Reset widget settings to defaults
 * @param {string} userId - Current user ID
 */
export async function resetWidgetSettings(userId) {
  const settings = {
    version: WIDGET_SETTINGS_VERSION,
    widgets: getDefaultWidgetConfigs(),
  };

  await saveWidgetSettings(userId, settings);
  return settings;
}

/**
 * Get enabled widgets in order
 * @param {Object} settings - Widget settings object
 * @returns {Array<Object>} - Enabled widgets sorted by order
 */
export function getEnabledWidgets(settings) {
  return settings.widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);
}
