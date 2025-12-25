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

    // Match bullet points: - Some text here
    if (currentEntry && line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (item) {
        currentEntry.items.push(item);
      }
    }
  }

  if (currentEntry) entries.push(currentEntry);

  // Return all dated entries
  return entries;
};
