// Preferences Settings Page Logic
import { auth } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { showToast, initIcons, clearBooksCache, getSyncSettings, saveSyncSettings } from '../utils.js';
import { loadWidgetSettings, saveWidgetSettings, reorderWidgets } from '../utils/widget-settings.js';
import { getWidgetInfo, WIDGET_SIZES } from '../widgets/widget-renderer.js';
// Import widgets to ensure they're registered
import '../widgets/index.js';

// Initialize icons once on load
initIcons();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

// State
let currentUser = null;
let widgetSettings = null;

// DOM Elements - Sync Settings
const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
const hiddenThresholdSelect = document.getElementById('hidden-threshold');
const cooldownPeriodSelect = document.getElementById('cooldown-period');
const syncOptionsDiv = document.getElementById('sync-options');
const refreshLibraryBtn = document.getElementById('refresh-library-btn');

// DOM Elements - Widget Settings
const widgetsLoading = document.getElementById('widgets-loading');
const widgetSettingsList = document.getElementById('widget-settings-list');

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loadSyncSettingsUI();
    await loadAndRenderWidgetSettings();
  }
});

// ==================== Sync Settings ====================

function loadSyncSettingsUI() {
  const settings = getSyncSettings();

  if (autoRefreshToggle) {
    autoRefreshToggle.checked = settings.autoRefreshEnabled;
  }

  if (hiddenThresholdSelect) {
    hiddenThresholdSelect.value = settings.hiddenThreshold.toString();
  }

  if (cooldownPeriodSelect) {
    cooldownPeriodSelect.value = settings.cooldownPeriod.toString();
  }

  updateSyncOptionsVisibility(settings.autoRefreshEnabled);
}

function updateSyncOptionsVisibility(enabled) {
  if (syncOptionsDiv) {
    syncOptionsDiv.classList.toggle('opacity-50', !enabled);
    syncOptionsDiv.classList.toggle('pointer-events-none', !enabled);
  }
}

autoRefreshToggle?.addEventListener('change', () => {
  const enabled = autoRefreshToggle.checked;
  saveSyncSettings({ autoRefreshEnabled: enabled });
  updateSyncOptionsVisibility(enabled);
  showToast(enabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled', { type: 'info' });
});

hiddenThresholdSelect?.addEventListener('change', () => {
  const value = parseInt(hiddenThresholdSelect.value, 10);
  saveSyncSettings({ hiddenThreshold: value });
  showToast('Setting saved', { type: 'info' });
});

cooldownPeriodSelect?.addEventListener('change', () => {
  const value = parseInt(cooldownPeriodSelect.value, 10);
  saveSyncSettings({ cooldownPeriod: value });
  showToast('Setting saved', { type: 'info' });
});

refreshLibraryBtn?.addEventListener('click', async () => {
  if (!currentUser) return;

  const icon = refreshLibraryBtn.querySelector('svg');
  const span = refreshLibraryBtn.querySelector('span');
  const originalText = span?.textContent;

  if (icon) icon.classList.add('animate-spin');
  refreshLibraryBtn.disabled = true;
  if (span) span.textContent = 'Refreshing...';

  try {
    clearBooksCache(currentUser.uid);
    showToast('Library refreshed', { type: 'success' });
    window.location.reload();
  } catch (error) {
    console.error('Error refreshing library:', error);
    showToast('Failed to refresh', { type: 'error' });
    if (icon) icon.classList.remove('animate-spin');
    refreshLibraryBtn.disabled = false;
    if (span && originalText) span.textContent = originalText;
  }
});

// ==================== Widget Settings ====================

async function loadAndRenderWidgetSettings() {
  if (!currentUser || !widgetSettingsList) return;

  try {
    widgetSettings = await loadWidgetSettings(currentUser.uid);
    renderWidgetSettings();
  } catch (error) {
    console.error('Error loading widget settings:', error);
    showToast('Error loading widget settings', { type: 'error' });
  }
}

function renderWidgetSettings() {
  if (!widgetSettings || !widgetSettingsList) return;

  const widgetInfo = getWidgetInfo();
  const widgetInfoMap = new Map(widgetInfo.map(w => [w.id, w]));

  const sortedWidgets = [...widgetSettings.widgets].sort((a, b) => a.order - b.order);

  widgetSettingsList.innerHTML = sortedWidgets.map((widget, index) => {
    const info = widgetInfoMap.get(widget.id);
    if (!info) return '';

    const isFirst = index === 0;
    const isLast = index === sortedWidgets.length - 1;

    return `
      <div class="bg-white rounded-xl border border-gray-200 p-4" data-widget-id="${widget.id}">
        <div class="flex items-center gap-3">
          <!-- Reorder Buttons -->
          <div class="flex flex-col gap-0.5">
            <button class="move-up-btn p-1 rounded hover:bg-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}"
                    data-id="${widget.id}" ${isFirst ? 'disabled' : ''} aria-label="Move up">
              <i data-lucide="chevron-up" class="w-4 h-4 text-gray-500" aria-hidden="true"></i>
            </button>
            <button class="move-down-btn p-1 rounded hover:bg-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center ${isLast ? 'opacity-30 cursor-not-allowed' : ''}"
                    data-id="${widget.id}" ${isLast ? 'disabled' : ''} aria-label="Move down">
              <i data-lucide="chevron-down" class="w-4 h-4 text-gray-500" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Widget Info -->
          <i data-lucide="${info.icon}" class="w-5 h-5 ${info.iconColor}" aria-hidden="true"></i>
          <span class="font-medium text-gray-900 flex-1">${info.name}</span>

          <!-- Toggle -->
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="widget-toggle sr-only peer" data-id="${widget.id}" ${widget.enabled ? 'checked' : ''} aria-label="Enable ${info.name} widget">
            <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <!-- Settings Row -->
        <div class="flex items-center gap-4 mt-3 pl-10">
          <div class="flex items-center gap-2">
            <label for="widget-count-${widget.id}" class="text-sm text-gray-600">Items:</label>
            <select id="widget-count-${widget.id}" class="widget-count px-2 py-1 border border-gray-300 rounded text-sm" data-id="${widget.id}">
              <option value="3" ${widget.settings?.count === 3 ? 'selected' : ''}>3</option>
              <option value="6" ${(widget.settings?.count || 6) === 6 ? 'selected' : ''}>6</option>
              <option value="9" ${widget.settings?.count === 9 ? 'selected' : ''}>9</option>
              <option value="12" ${widget.settings?.count === 12 ? 'selected' : ''}>12</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label for="widget-size-${widget.id}" class="text-sm text-gray-600">Size:</label>
            <select id="widget-size-${widget.id}" class="widget-size px-2 py-1 border border-gray-300 rounded text-sm" data-id="${widget.id}">
              ${WIDGET_SIZES.map(size => `
                <option value="${size.value}" ${widget.size === size.value ? 'selected' : ''}>${size.label}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');

  widgetsLoading?.classList.add('hidden');
  widgetSettingsList.classList.remove('hidden');

  attachWidgetSettingsListeners();
  initIcons();
}

function attachWidgetSettingsListeners() {
  // Toggle listeners
  widgetSettingsList.querySelectorAll('.widget-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const widgetId = e.target.dataset.id;
      const enabled = e.target.checked;
      await updateWidgetSetting(widgetId, { enabled });
    });
  });

  // Count select listeners
  widgetSettingsList.querySelectorAll('.widget-count').forEach(select => {
    select.addEventListener('change', async (e) => {
      const widgetId = e.target.dataset.id;
      const count = parseInt(e.target.value, 10);
      await updateWidgetSetting(widgetId, { settings: { count } });
    });
  });

  // Size select listeners
  widgetSettingsList.querySelectorAll('.widget-size').forEach(select => {
    select.addEventListener('change', async (e) => {
      const widgetId = e.target.dataset.id;
      const size = parseInt(e.target.value, 10);
      await updateWidgetSetting(widgetId, { size });
    });
  });

  // Move up listeners
  widgetSettingsList.querySelectorAll('.move-up-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const widgetId = btn.dataset.id;
      await moveWidget(widgetId, -1);
    });
  });

  // Move down listeners
  widgetSettingsList.querySelectorAll('.move-down-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const widgetId = btn.dataset.id;
      await moveWidget(widgetId, 1);
    });
  });
}

async function updateWidgetSetting(widgetId, updates) {
  if (!widgetSettings || !currentUser) return;

  const widgetIndex = widgetSettings.widgets.findIndex(w => w.id === widgetId);
  if (widgetIndex === -1) return;

  widgetSettings.widgets[widgetIndex] = {
    ...widgetSettings.widgets[widgetIndex],
    ...updates,
    settings: {
      ...widgetSettings.widgets[widgetIndex].settings,
      ...updates.settings
    }
  };

  try {
    await saveWidgetSettings(currentUser.uid, widgetSettings);
    showToast('Settings saved', { type: 'success' });
  } catch (error) {
    console.error('Error saving widget settings:', error);
    showToast('Error saving settings', { type: 'error' });
  }
}

async function moveWidget(widgetId, direction) {
  if (!widgetSettings || !currentUser) return;

  const sortedWidgets = [...widgetSettings.widgets].sort((a, b) => a.order - b.order);
  const currentIndex = sortedWidgets.findIndex(w => w.id === widgetId);
  const newIndex = currentIndex + direction;

  if (newIndex < 0 || newIndex >= sortedWidgets.length) return;

  const orderedIds = sortedWidgets.map(w => w.id);
  [orderedIds[currentIndex], orderedIds[newIndex]] = [orderedIds[newIndex], orderedIds[currentIndex]];

  try {
    widgetSettings = await reorderWidgets(currentUser.uid, orderedIds);
    renderWidgetSettings();
    showToast('Order updated', { type: 'success' });
  } catch (error) {
    console.error('Error reordering widgets:', error);
    showToast('Error updating order', { type: 'error' });
  }
}
