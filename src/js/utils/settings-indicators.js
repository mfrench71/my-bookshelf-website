// Settings Tab Indicators
// Updates badge indicators on settings navigation tabs

import { auth, db } from '/js/firebase-config.js';
import { collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const CACHE_KEY = 'mybookshelf_settings_indicators';
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Update the settings tab indicators (Maintenance dot, Bin count)
 * @param {string} userId - The user's Firebase UID
 */
export async function updateSettingsIndicators(userId) {
  if (!userId) return;

  // Check cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        applyIndicators(data);
        return;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }

  // Fetch fresh data
  try {
    const [binCount, hasIssues] = await Promise.all([
      getBinCount(userId),
      hasMaintenanceIssues(userId)
    ]);

    const data = { binCount, hasIssues };
    applyIndicators(data);

    // Cache the result
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore cache write errors
    }
  } catch (error) {
    console.error('Error updating settings indicators:', error);
  }
}

/**
 * Get count of books in the bin
 */
async function getBinCount(userId) {
  const booksRef = collection(db, 'users', userId, 'books');
  const binQuery = query(booksRef, where('deletedAt', '!=', null));
  const snapshot = await getDocs(binQuery);
  return snapshot.size;
}

/**
 * Check if there are any library health issues
 * Quick check: just see if any books are missing covers or genres
 */
async function hasMaintenanceIssues(userId) {
  const booksRef = collection(db, 'users', userId, 'books');

  // Check for books without covers (limit 1 for quick check)
  const noCoverQuery = query(
    booksRef,
    where('deletedAt', '==', null),
    where('coverImageUrl', '==', null),
    limit(1)
  );

  try {
    const snapshot = await getDocs(noCoverQuery);
    return snapshot.size > 0;
  } catch (error) {
    // If query fails (compound index not available), return false
    // Users can still see issues on the maintenance page
    return false;
  }
}

/**
 * Apply the indicator values to the DOM
 */
function applyIndicators({ binCount, hasIssues }) {
  // Update bin badge
  const binBadge = document.getElementById('bin-count-badge');
  if (binBadge) {
    if (binCount > 0) {
      binBadge.textContent = binCount > 99 ? '99+' : binCount.toString();
      binBadge.classList.remove('hidden');
    } else {
      binBadge.classList.add('hidden');
    }
  }

  // Update maintenance indicator
  const maintenanceIndicator = document.getElementById('maintenance-indicator');
  if (maintenanceIndicator) {
    if (hasIssues) {
      maintenanceIndicator.classList.remove('hidden');
    } else {
      maintenanceIndicator.classList.add('hidden');
    }
  }
}

/**
 * Clear the indicators cache (call after bin or maintenance operations)
 */
export function clearIndicatorsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // Ignore
  }
}
