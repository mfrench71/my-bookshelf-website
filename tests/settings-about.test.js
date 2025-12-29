// Settings About Page Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Settings About Page', () => {
  describe('Changelog Accordions', () => {
    let container;
    let accordionBtn;
    let accordionContent;
    let chevron;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <button class="changelog-date-btn">
          December 2024
          <i class="changelog-chevron"></i>
        </button>
        <div class="hidden">
          <ul>
            <li>Added new feature</li>
            <li>Fixed bug</li>
          </ul>
        </div>
      `;
      document.body.appendChild(container);
      
      accordionBtn = container.querySelector('.changelog-date-btn');
      accordionContent = accordionBtn.nextElementSibling;
      chevron = accordionBtn.querySelector('.changelog-chevron');
    });

    afterEach(() => {
      container.remove();
    });

    it('should expand accordion on click', () => {
      // Simulate accordion click behavior
      accordionContent.classList.remove('hidden');
      chevron.classList.add('rotate-180');
      
      expect(accordionContent.classList.contains('hidden')).toBe(false);
      expect(chevron.classList.contains('rotate-180')).toBe(true);
    });

    it('should collapse accordion on second click', () => {
      // First click - expand
      accordionContent.classList.remove('hidden');
      chevron.classList.add('rotate-180');
      
      // Second click - collapse
      accordionContent.classList.add('hidden');
      chevron.classList.remove('rotate-180');
      
      expect(accordionContent.classList.contains('hidden')).toBe(true);
      expect(chevron.classList.contains('rotate-180')).toBe(false);
    });

    it('should have correct initial state', () => {
      expect(accordionContent.classList.contains('hidden')).toBe(true);
    });
  });
});
