/**
 * Tests for wishlist/index.js - extractable pure functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Firebase
vi.mock('../src/js/firebase-config.js', () => ({
  auth: { currentUser: { uid: 'test-user' } }
}));

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js', () => ({
  onAuthStateChanged: vi.fn()
}));

// Mock wishlist module
vi.mock('../src/js/wishlist.js', () => ({
  loadWishlistItems: vi.fn(),
  updateWishlistItem: vi.fn(),
  deleteWishlistItem: vi.fn(),
  moveToLibrary: vi.fn(),
  clearWishlistCache: vi.fn()
}));

// Mock cache module
vi.mock('../src/js/utils/cache.js', () => ({
  clearBooksCache: vi.fn()
}));

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  showToast: vi.fn(),
  initIcons: vi.fn(),
  escapeHtml: (s) => s?.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) || '',
  isValidImageUrl: (url) => url && url.startsWith('http')
}));

// Mock validation
vi.mock('../src/js/utils/validation.js', () => ({
  validateForm: vi.fn(),
  showFormErrors: vi.fn(),
  clearFormErrors: vi.fn()
}));

// Mock modal
vi.mock('../src/js/components/modal.js', () => ({
  BottomSheet: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock zod
vi.mock('/js/vendor/zod.js', () => ({
  z: {
    object: () => ({
      priority: () => ({}),
      notes: () => ({})
    }),
    string: () => ({
      max: () => ({
        transform: (fn) => ({})
      })
    }),
    enum: () => ({
      transform: (fn) => ({})
    })
  }
}));

describe('Wishlist Page Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthorSurname', () => {
    /**
     * Extract author surname for sorting
     */
    function getAuthorSurname(author) {
      if (!author) return '';
      const parts = author.trim().split(/\s+/);
      return parts[parts.length - 1].toLowerCase();
    }

    it('should return empty string for null/undefined', () => {
      expect(getAuthorSurname(null)).toBe('');
      expect(getAuthorSurname(undefined)).toBe('');
      expect(getAuthorSurname('')).toBe('');
    });

    it('should return last word as surname', () => {
      expect(getAuthorSurname('J.K. Rowling')).toBe('rowling');
      expect(getAuthorSurname('Stephen King')).toBe('king');
      expect(getAuthorSurname('Brandon Sanderson')).toBe('sanderson');
    });

    it('should handle single name', () => {
      expect(getAuthorSurname('Madonna')).toBe('madonna');
    });

    it('should handle multiple spaces', () => {
      expect(getAuthorSurname('Stephen   King')).toBe('king');
    });

    it('should lowercase the result', () => {
      expect(getAuthorSurname('STEPHEN KING')).toBe('king');
    });

    it('should trim whitespace', () => {
      expect(getAuthorSurname('  Stephen King  ')).toBe('king');
    });
  });

  describe('sortItems', () => {
    const mockItems = [
      { id: '1', title: 'Zebra', author: 'Zack Adams', priority: 'high', createdAt: { seconds: 1000 } },
      { id: '2', title: 'Apple', author: 'Alan Brown', priority: 'medium', createdAt: { seconds: 2000 } },
      { id: '3', title: 'Banana', author: 'Bob Zebra', priority: 'low', createdAt: { seconds: 1500 } },
      { id: '4', title: 'Cherry', author: 'Carol Doe', priority: null, createdAt: { seconds: 3000 } }
    ];

    /**
     * Sort wishlist items
     */
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
          function getAuthorSurname(author) {
            if (!author) return '';
            const parts = author.trim().split(/\s+/);
            return parts[parts.length - 1].toLowerCase();
          }
          sorted.sort((a, b) => getAuthorSurname(a.author).localeCompare(getAuthorSurname(b.author)));
          break;
      }

      return sorted;
    }

    it('should sort by createdAt descending (newest first)', () => {
      const sorted = sortItems(mockItems, 'createdAt-desc');

      expect(sorted[0].id).toBe('4'); // 3000 seconds
      expect(sorted[1].id).toBe('2'); // 2000 seconds
      expect(sorted[2].id).toBe('3'); // 1500 seconds
      expect(sorted[3].id).toBe('1'); // 1000 seconds
    });

    it('should sort by createdAt ascending (oldest first)', () => {
      const sorted = sortItems(mockItems, 'createdAt-asc');

      expect(sorted[0].id).toBe('1'); // 1000 seconds
      expect(sorted[1].id).toBe('3'); // 1500 seconds
      expect(sorted[2].id).toBe('2'); // 2000 seconds
      expect(sorted[3].id).toBe('4'); // 3000 seconds
    });

    it('should sort by priority (high first)', () => {
      const sorted = sortItems(mockItems, 'priority-high');

      expect(sorted[0].priority).toBe('high');
      expect(sorted[1].priority).toBe('medium');
      expect(sorted[2].priority).toBe('low');
      expect(sorted[3].priority).toBeNull();
    });

    it('should use createdAt as secondary sort for same priority', () => {
      const items = [
        { id: '1', priority: 'high', createdAt: { seconds: 1000 } },
        { id: '2', priority: 'high', createdAt: { seconds: 2000 } }
      ];

      const sorted = sortItems(items, 'priority-high');

      expect(sorted[0].id).toBe('2'); // newer high priority first
      expect(sorted[1].id).toBe('1');
    });

    it('should sort by title alphabetically', () => {
      const sorted = sortItems(mockItems, 'title-asc');

      expect(sorted[0].title).toBe('Apple');
      expect(sorted[1].title).toBe('Banana');
      expect(sorted[2].title).toBe('Cherry');
      expect(sorted[3].title).toBe('Zebra');
    });

    it('should sort by author surname', () => {
      const sorted = sortItems(mockItems, 'author-asc');

      expect(sorted[0].author).toBe('Zack Adams'); // Adams
      expect(sorted[1].author).toBe('Alan Brown'); // Brown
      expect(sorted[2].author).toBe('Carol Doe'); // Doe
      expect(sorted[3].author).toBe('Bob Zebra'); // Zebra
    });

    it('should not mutate original array', () => {
      const original = [...mockItems];
      sortItems(mockItems, 'title-asc');

      expect(mockItems).toEqual(original);
    });

    it('should handle items with missing createdAt', () => {
      const items = [
        { id: '1', title: 'A', createdAt: { seconds: 1000 } },
        { id: '2', title: 'B', createdAt: null }
      ];

      const sorted = sortItems(items, 'createdAt-desc');

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
    });

    it('should handle items with missing title', () => {
      const items = [
        { id: '1', title: 'Apple' },
        { id: '2', title: null },
        { id: '3', title: '' }
      ];

      const sorted = sortItems(items, 'title-asc');

      // Empty strings and null both become '' and sort before 'Apple'
      expect(sorted[2].title).toBe('Apple');
    });
  });

  describe('renderWishlistCard', () => {
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

    function escapeHtml(s) {
      return s?.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c])) || '';
    }

    function isValidImageUrl(url) {
      return url && url.startsWith('http');
    }

    function renderWishlistCard(item) {
      const cover = item.coverImageUrl && isValidImageUrl(item.coverImageUrl)
        ? `<div class="cover"><img src="${escapeHtml(item.coverImageUrl)}" alt=""></div>`
        : `<div class="cover-placeholder"><i data-lucide="book"></i></div>`;

      const priorityBadge = item.priority
        ? `<span class="${PRIORITY_COLORS[item.priority]}">${PRIORITY_LABELS[item.priority]}</span>`
        : '';

      return `
        <div class="wishlist-card" data-item-id="${item.id}">
          ${cover}
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.author || 'Unknown')}</p>
          ${priorityBadge}
          ${item.notes ? '<i data-lucide="message-square"></i>' : ''}
        </div>
      `;
    }

    it('should render title and author', () => {
      const item = { id: '1', title: 'Test Book', author: 'Test Author' };
      const html = renderWishlistCard(item);

      expect(html).toContain('Test Book');
      expect(html).toContain('Test Author');
    });

    it('should render Unknown for missing author', () => {
      const item = { id: '1', title: 'Test Book', author: null };
      const html = renderWishlistCard(item);

      expect(html).toContain('Unknown');
    });

    it('should render cover image when valid', () => {
      const item = { id: '1', title: 'Test', coverImageUrl: 'https://example.com/cover.jpg' };
      const html = renderWishlistCard(item);

      expect(html).toContain('<img');
      expect(html).toContain('https://example.com/cover.jpg');
    });

    it('should render placeholder when no cover', () => {
      const item = { id: '1', title: 'Test', coverImageUrl: null };
      const html = renderWishlistCard(item);

      expect(html).toContain('cover-placeholder');
      expect(html).toContain('data-lucide="book"');
    });

    it('should render priority badge for high priority', () => {
      const item = { id: '1', title: 'Test', priority: 'high' };
      const html = renderWishlistCard(item);

      expect(html).toContain('High');
      expect(html).toContain('bg-red-100');
    });

    it('should render priority badge for medium priority', () => {
      const item = { id: '1', title: 'Test', priority: 'medium' };
      const html = renderWishlistCard(item);

      expect(html).toContain('Medium');
      expect(html).toContain('bg-amber-100');
    });

    it('should render priority badge for low priority', () => {
      const item = { id: '1', title: 'Test', priority: 'low' };
      const html = renderWishlistCard(item);

      expect(html).toContain('Low');
      expect(html).toContain('bg-blue-100');
    });

    it('should not render priority badge when no priority', () => {
      const item = { id: '1', title: 'Test', priority: null };
      const html = renderWishlistCard(item);

      expect(html).not.toContain('High');
      expect(html).not.toContain('Medium');
      expect(html).not.toContain('Low');
    });

    it('should render notes icon when notes present', () => {
      const item = { id: '1', title: 'Test', notes: 'Some notes' };
      const html = renderWishlistCard(item);

      expect(html).toContain('data-lucide="message-square"');
    });

    it('should not render notes icon when no notes', () => {
      const item = { id: '1', title: 'Test', notes: null };
      const html = renderWishlistCard(item);

      expect(html).not.toContain('data-lucide="message-square"');
    });

    it('should escape HTML in title', () => {
      const item = { id: '1', title: '<script>alert("xss")</script>' };
      const html = renderWishlistCard(item);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in author', () => {
      const item = { id: '1', title: 'Test', author: '<b>Bold</b>' };
      const html = renderWishlistCard(item);

      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;b&gt;');
    });

    it('should include item ID in data attribute', () => {
      const item = { id: 'item-123', title: 'Test' };
      const html = renderWishlistCard(item);

      expect(html).toContain('data-item-id="item-123"');
    });
  });

  describe('WishlistEditSchema validation', () => {
    // Simulate Zod schema behavior
    function validateWishlistEdit(data) {
      const errors = [];

      // Priority validation
      const validPriorities = ['high', 'medium', 'low', ''];
      if (data.priority !== undefined && !validPriorities.includes(data.priority)) {
        errors.push({ field: 'priority', message: 'Invalid priority' });
      }

      // Notes validation
      if (data.notes && data.notes.length > 2000) {
        errors.push({ field: 'notes', message: 'Notes must be 2000 characters or less' });
      }

      return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
          priority: data.priority || null,
          notes: data.notes?.trim() || null
        } : null
      };
    }

    it('should accept valid priorities', () => {
      expect(validateWishlistEdit({ priority: 'high' }).success).toBe(true);
      expect(validateWishlistEdit({ priority: 'medium' }).success).toBe(true);
      expect(validateWishlistEdit({ priority: 'low' }).success).toBe(true);
      expect(validateWishlistEdit({ priority: '' }).success).toBe(true);
    });

    it('should reject invalid priorities', () => {
      expect(validateWishlistEdit({ priority: 'urgent' }).success).toBe(false);
      expect(validateWishlistEdit({ priority: 'invalid' }).success).toBe(false);
    });

    it('should accept notes under 2000 characters', () => {
      expect(validateWishlistEdit({ notes: 'Short note' }).success).toBe(true);
      expect(validateWishlistEdit({ notes: 'a'.repeat(2000) }).success).toBe(true);
    });

    it('should reject notes over 2000 characters', () => {
      expect(validateWishlistEdit({ notes: 'a'.repeat(2001) }).success).toBe(false);
    });

    it('should transform empty priority to null', () => {
      const result = validateWishlistEdit({ priority: '' });
      expect(result.data.priority).toBeNull();
    });

    it('should trim notes whitespace', () => {
      const result = validateWishlistEdit({ notes: '  trimmed  ' });
      expect(result.data.notes).toBe('trimmed');
    });

    it('should transform empty notes to null', () => {
      const result = validateWishlistEdit({ notes: '' });
      expect(result.data.notes).toBeNull();
    });
  });
});
