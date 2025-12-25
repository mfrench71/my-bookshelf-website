/**
 * Tests for src/js/components/breadcrumb.js
 * Tests breadcrumb navigation rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock utils functions
vi.mock('../src/js/utils.js', () => ({
  initIcons: vi.fn(),
  escapeHtml: (str) => str ? str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m])) : ''
}));

// Import after mocking
import { renderBreadcrumbs, Breadcrumbs } from '../src/js/components/breadcrumb.js';

describe('Breadcrumb Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('ol');
    document.body.appendChild(container);
  });

  describe('renderBreadcrumbs', () => {
    it('should render nothing when container is null', () => {
      renderBreadcrumbs(null, [{ label: 'Test' }]);
      // Should not throw
    });

    it('should render nothing when items is null', () => {
      renderBreadcrumbs(container, null);
      expect(container.innerHTML).toBe('');
    });

    it('should render nothing when items is empty', () => {
      renderBreadcrumbs(container, []);
      expect(container.innerHTML).toBe('');
    });

    it('should render a single item as current page', () => {
      renderBreadcrumbs(container, [{ label: 'Home', current: true }]);
      expect(container.innerHTML).toContain('Home');
      expect(container.innerHTML).toContain('aria-current="page"');
      expect(container.innerHTML).not.toContain('<a ');
    });

    it('should render clickable link for non-current item', () => {
      renderBreadcrumbs(container, [
        { label: 'Books', href: '/books/' },
        { label: 'Add Book', current: true }
      ]);
      expect(container.innerHTML).toContain('href="/books/"');
      expect(container.innerHTML).toContain('Books');
      expect(container.innerHTML).toContain('Add Book');
    });

    it('should render chevron separator between items', () => {
      renderBreadcrumbs(container, [
        { label: 'Books', href: '/books/' },
        { label: 'Title', current: true }
      ]);
      expect(container.innerHTML).toContain('chevron-right');
    });

    it('should not render separator before first item', () => {
      renderBreadcrumbs(container, [
        { label: 'First', href: '/' },
        { label: 'Second', current: true }
      ]);
      const firstLi = container.querySelector('li');
      expect(firstLi.innerHTML).not.toContain('chevron-right');
    });

    it('should apply truncate class when truncate is true', () => {
      renderBreadcrumbs(container, [
        { label: 'Very Long Book Title Here', current: true, truncate: true }
      ]);
      expect(container.innerHTML).toContain('truncate');
      expect(container.innerHTML).toContain('max-w-[150px]');
    });

    it('should escape HTML in labels', () => {
      renderBreadcrumbs(container, [
        { label: '<script>alert("xss")</script>', current: true }
      ]);
      expect(container.innerHTML).toContain('&lt;script&gt;');
      expect(container.innerHTML).not.toContain('<script>');
    });

    it('should escape HTML in hrefs', () => {
      renderBreadcrumbs(container, [
        { label: 'Link', href: '/test?a=1&b=2"onclick="alert(1)' },
        { label: 'Current', current: true }
      ]);
      expect(container.innerHTML).toContain('&amp;');
    });
  });

  describe('Breadcrumbs presets', () => {
    describe('bookView', () => {
      it('should return correct structure', () => {
        const items = Breadcrumbs.bookView('My Book', 'abc123');
        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({ label: 'Books', href: '/books/' });
        expect(items[1]).toEqual({ label: 'My Book', current: true, truncate: true });
      });

      it('should use fallback title when title is empty', () => {
        const items = Breadcrumbs.bookView('', 'abc123');
        expect(items[1].label).toBe('Book');
      });

      it('should use fallback title when title is null', () => {
        const items = Breadcrumbs.bookView(null, 'abc123');
        expect(items[1].label).toBe('Book');
      });
    });

    describe('bookEdit', () => {
      it('should return correct structure with link to view page', () => {
        const items = Breadcrumbs.bookEdit('My Book', 'abc123');
        expect(items).toHaveLength(3);
        expect(items[0]).toEqual({ label: 'Books', href: '/books/' });
        expect(items[1]).toEqual({ label: 'My Book', href: '/books/view/?id=abc123', truncate: true });
        expect(items[2]).toEqual({ label: 'Edit', current: true });
      });

      it('should use fallback title when title is empty', () => {
        const items = Breadcrumbs.bookEdit('', 'abc123');
        expect(items[1].label).toBe('Book');
      });
    });

    describe('bookAdd', () => {
      it('should return correct structure', () => {
        const items = Breadcrumbs.bookAdd();
        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({ label: 'Books', href: '/books/' });
        expect(items[1]).toEqual({ label: 'Add Book', current: true });
      });
    });

    describe('settings', () => {
      it('should return correct structure', () => {
        const items = Breadcrumbs.settings();
        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({ label: 'Home', href: '/' });
        expect(items[1]).toEqual({ label: 'Settings', current: true });
      });
    });
  });

  describe('Accessibility', () => {
    it('should mark current page with aria-current', () => {
      renderBreadcrumbs(container, [
        { label: 'Books', href: '/books/' },
        { label: 'Current Page', current: true }
      ]);
      const currentSpan = container.querySelector('[aria-current="page"]');
      expect(currentSpan).not.toBeNull();
      expect(currentSpan.textContent).toBe('Current Page');
    });

    it('should mark chevrons as aria-hidden', () => {
      renderBreadcrumbs(container, [
        { label: 'A', href: '/' },
        { label: 'B', current: true }
      ]);
      const chevron = container.querySelector('[data-lucide="chevron-right"]');
      expect(chevron.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
