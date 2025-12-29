/**
 * Tests for Wishlist Page Logic
 * Tests sorting, rendering, and utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Wishlist Page Logic', () => {
  // Priority colours
  const PRIORITY_COLORS = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700'
  };

  const PRIORITY_LABELS = {
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };

  // Inline implementations from wishlist/index.js
  function getAuthorSurname(author) {
    if (!author) return '';
    const parts = author.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  function sortItems(items, sortKey) {
    const sorted = [...items];

    switch (sortKey) {
      case 'createdAt-desc':
        sorted.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        break;
      case 'createdAt-asc':
        sorted.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return aTime - bTime;
        });
        break;
      case 'priority-high':
        const priorityOrder = { high: 0, medium: 1, low: 2, null: 3 };
        sorted.sort((a, b) => {
          const aOrder = priorityOrder[a.priority] ?? 3;
          const bOrder = priorityOrder[b.priority] ?? 3;
          if (aOrder !== bOrder) return aOrder - bOrder;
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        break;
      case 'title-asc':
        sorted.sort((a, b) => (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase()));
        break;
      case 'author-asc':
        sorted.sort((a, b) => getAuthorSurname(a.author).localeCompare(getAuthorSurname(b.author)));
        break;
    }

    return sorted;
  }

  describe('PRIORITY_COLORS', () => {
    it('should have high priority as red', () => {
      expect(PRIORITY_COLORS.high).toContain('red');
    });

    it('should have medium priority as amber', () => {
      expect(PRIORITY_COLORS.medium).toContain('amber');
    });

    it('should have low priority as blue', () => {
      expect(PRIORITY_COLORS.low).toContain('blue');
    });
  });

  describe('PRIORITY_LABELS', () => {
    it('should have correct labels', () => {
      expect(PRIORITY_LABELS.high).toBe('High');
      expect(PRIORITY_LABELS.medium).toBe('Medium');
      expect(PRIORITY_LABELS.low).toBe('Low');
    });
  });

  describe('getAuthorSurname', () => {
    it('should return last word of author name', () => {
      expect(getAuthorSurname('J.K. Rowling')).toBe('rowling');
    });

    it('should return lowercase', () => {
      expect(getAuthorSurname('Stephen KING')).toBe('king');
    });

    it('should handle single name', () => {
      expect(getAuthorSurname('Plato')).toBe('plato');
    });

    it('should handle empty string', () => {
      expect(getAuthorSurname('')).toBe('');
    });

    it('should handle null', () => {
      expect(getAuthorSurname(null)).toBe('');
    });

    it('should handle undefined', () => {
      expect(getAuthorSurname(undefined)).toBe('');
    });

    it('should handle multiple spaces', () => {
      expect(getAuthorSurname('George  R.  R.  Martin')).toBe('martin');
    });

    it('should trim whitespace', () => {
      expect(getAuthorSurname('  Brandon Sanderson  ')).toBe('sanderson');
    });
  });

  describe('sortItems', () => {
    const mockItems = [
      { id: '1', title: 'Alpha Book', author: 'John Smith', priority: 'low', createdAt: { seconds: 100 } },
      { id: '2', title: 'Zeta Book', author: 'Anna Jones', priority: 'high', createdAt: { seconds: 300 } },
      { id: '3', title: 'Beta Book', author: 'Mike Adams', priority: 'medium', createdAt: { seconds: 200 } },
      { id: '4', title: 'Delta Book', author: 'Sarah Brown', priority: null, createdAt: { seconds: 150 } }
    ];

    describe('createdAt-desc (newest first)', () => {
      it('should sort by creation date descending', () => {
        const sorted = sortItems(mockItems, 'createdAt-desc');
        expect(sorted[0].id).toBe('2'); // 300
        expect(sorted[1].id).toBe('3'); // 200
        expect(sorted[2].id).toBe('4'); // 150
        expect(sorted[3].id).toBe('1'); // 100
      });

      it('should handle missing createdAt', () => {
        const items = [
          { id: '1', createdAt: { seconds: 100 } },
          { id: '2', createdAt: null },
          { id: '3', createdAt: { seconds: 200 } }
        ];
        const sorted = sortItems(items, 'createdAt-desc');
        expect(sorted[0].id).toBe('3'); // 200
        expect(sorted[1].id).toBe('1'); // 100
        expect(sorted[2].id).toBe('2'); // 0 (null)
      });
    });

    describe('createdAt-asc (oldest first)', () => {
      it('should sort by creation date ascending', () => {
        const sorted = sortItems(mockItems, 'createdAt-asc');
        expect(sorted[0].id).toBe('1'); // 100
        expect(sorted[1].id).toBe('4'); // 150
        expect(sorted[2].id).toBe('3'); // 200
        expect(sorted[3].id).toBe('2'); // 300
      });
    });

    describe('priority-high (high first)', () => {
      it('should sort by priority (high > medium > low > null)', () => {
        const sorted = sortItems(mockItems, 'priority-high');
        expect(sorted[0].priority).toBe('high');
        expect(sorted[1].priority).toBe('medium');
        expect(sorted[2].priority).toBe('low');
        expect(sorted[3].priority).toBeNull();
      });

      it('should use createdAt as secondary sort', () => {
        const items = [
          { id: '1', priority: 'high', createdAt: { seconds: 100 } },
          { id: '2', priority: 'high', createdAt: { seconds: 300 } },
          { id: '3', priority: 'high', createdAt: { seconds: 200 } }
        ];
        const sorted = sortItems(items, 'priority-high');
        expect(sorted[0].id).toBe('2'); // 300 (newest)
        expect(sorted[1].id).toBe('3'); // 200
        expect(sorted[2].id).toBe('1'); // 100 (oldest)
      });

      it('should handle undefined priority as null', () => {
        const items = [
          { id: '1', priority: undefined, createdAt: { seconds: 100 } },
          { id: '2', priority: 'low', createdAt: { seconds: 100 } }
        ];
        const sorted = sortItems(items, 'priority-high');
        expect(sorted[0].id).toBe('2'); // low
        expect(sorted[1].id).toBe('1'); // undefined (treated as null)
      });
    });

    describe('title-asc (alphabetical)', () => {
      it('should sort by title alphabetically', () => {
        const sorted = sortItems(mockItems, 'title-asc');
        expect(sorted[0].title).toBe('Alpha Book');
        expect(sorted[1].title).toBe('Beta Book');
        expect(sorted[2].title).toBe('Delta Book');
        expect(sorted[3].title).toBe('Zeta Book');
      });

      it('should be case insensitive', () => {
        const items = [
          { id: '1', title: 'zebra' },
          { id: '2', title: 'Apple' },
          { id: '3', title: 'BANANA' }
        ];
        const sorted = sortItems(items, 'title-asc');
        expect(sorted[0].title).toBe('Apple');
        expect(sorted[1].title).toBe('BANANA');
        expect(sorted[2].title).toBe('zebra');
      });

      it('should handle empty titles', () => {
        const items = [
          { id: '1', title: 'Beta' },
          { id: '2', title: '' },
          { id: '3', title: 'Alpha' }
        ];
        const sorted = sortItems(items, 'title-asc');
        expect(sorted[0].title).toBe('');
        expect(sorted[1].title).toBe('Alpha');
      });
    });

    describe('author-asc (by surname)', () => {
      it('should sort by author surname', () => {
        const sorted = sortItems(mockItems, 'author-asc');
        expect(sorted[0].author).toBe('Mike Adams'); // adams
        expect(sorted[1].author).toBe('Sarah Brown'); // brown
        expect(sorted[2].author).toBe('Anna Jones'); // jones
        expect(sorted[3].author).toBe('John Smith'); // smith
      });

      it('should handle missing authors', () => {
        const items = [
          { id: '1', author: 'John Smith' },
          { id: '2', author: null },
          { id: '3', author: 'Anna Adams' }
        ];
        const sorted = sortItems(items, 'author-asc');
        expect(sorted[0].author).toBeNull(); // empty string sorts first
        expect(sorted[1].author).toBe('Anna Adams');
      });
    });

    it('should not mutate original array', () => {
      const original = [...mockItems];
      sortItems(mockItems, 'title-asc');
      expect(mockItems).toEqual(original);
    });

    it('should handle empty array', () => {
      const sorted = sortItems([], 'title-asc');
      expect(sorted).toEqual([]);
    });

    it('should return copy with unknown sort key', () => {
      const sorted = sortItems(mockItems, 'unknown');
      expect(sorted).toHaveLength(mockItems.length);
    });
  });
});
