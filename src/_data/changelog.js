/**
 * Changelog Data Module
 * Parses CHANGELOG.md to expose entries and version info to templates
 * Usage: {{ changelog.version }}, {{ changelog.entries }}
 */
const fs = require('fs');
const path = require('path');

/**
 * Format ISO date to human-readable British format
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (e.g., "30 December 2025")
 */
function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

module.exports = function () {
  const content = fs.readFileSync(path.join(__dirname, '../../CHANGELOG.md'), 'utf8');

  // Parse dated changelog entries
  const entries = [];
  let currentEntry = null;

  for (const line of content.split('\n')) {
    // Match date headings: ## 2025-12-24
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        date: dateMatch[1],
        displayDate: formatDate(dateMatch[1]),
        items: [],
      };
      continue;
    }

    // Match bullet points: - Some text here
    if (currentEntry && line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (item) {
        currentEntry.items.push(item);
      }
    }
  }

  if (currentEntry) entries.push(currentEntry);

  // Parse version history table (first row after header is latest version)
  // Format: | 0.12.0 | 2025-12-30 | Book View & Toast Polish |
  const versionMatch = content.match(/\| ([\d.]+) \| (\d{4}-\d{2}-\d{2}) \| ([^|]+) \|/);
  const version = versionMatch ? versionMatch[1] : '0.0.0';

  return {
    entries,
    version,
  };
};
