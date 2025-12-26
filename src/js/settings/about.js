// About Settings Page Logic
import { initIcons } from '../utils.js';

// Initialize icons once on load
initIcons();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

// ==================== Changelog Accordions ====================

function initChangelogAccordions() {
  const changelogBtns = document.querySelectorAll('.changelog-date-btn');

  changelogBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      const chevron = btn.querySelector('.changelog-chevron');

      if (!content) return;

      const isExpanded = !content.classList.contains('hidden');

      if (isExpanded) {
        // Collapse
        content.classList.add('hidden');
        chevron?.classList.remove('rotate-180');
      } else {
        // Expand
        content.classList.remove('hidden');
        chevron?.classList.add('rotate-180');
      }
    });
  });
}

// Initialize changelog accordions
initChangelogAccordions();
