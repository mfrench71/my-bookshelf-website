const fs = require('fs');
const path = require('path');

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

module.exports = function() {
  const content = fs.readFileSync(
    path.join(__dirname, '../../CHANGELOG.md'),
    'utf8'
  );

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
        items: []
      };
      continue;
    }

    // Match feature items: - **Title**: Description or - **Title**
    if (currentEntry && line.startsWith('- **')) {
      const itemMatch = line.match(/^- \*\*(.+?)\*\*(?::|$)/);
      if (itemMatch) {
        currentEntry.items.push(itemMatch[1]);
      }
    }
  }

  if (currentEntry) entries.push(currentEntry);

  // Return last 5 dates only
  return entries.slice(0, 5);
};
