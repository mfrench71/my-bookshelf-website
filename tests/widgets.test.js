/**
 * Widget System Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase before importing modules that use it
vi.mock('../src/js/firebase-config.js', () => ({
  db: {},
  auth: {}
}));

// Mock Firestore
vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn()
}));

// Import after mocks
import { widgetRegistry } from '../src/js/widgets/registry.js';
import { BaseWidget } from '../src/js/widgets/base-widget.js';
import { WelcomeWidget } from '../src/js/widgets/widgets/welcome.js';
import { CurrentlyReadingWidget } from '../src/js/widgets/widgets/currently-reading.js';
import { RecentlyAddedWidget } from '../src/js/widgets/widgets/recently-added.js';
import { TopRatedWidget } from '../src/js/widgets/widgets/top-rated.js';
import { RecentlyFinishedWidget } from '../src/js/widgets/widgets/recently-finished.js';
import { renderWidgets, renderWidgetSkeletons, getWidgetInfo, WIDGET_SIZES } from '../src/js/widgets/widget-renderer.js';
import { getDefaultWidgetConfigs, getEnabledWidgets } from '../src/js/utils/widget-settings.js';

// Mock utils functions
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (str) => str?.replace(/[&<>"']/g, '') || '',
  parseTimestamp: (ts) => ts ? new Date(ts) : null,
  formatDate: (date) => date?.toLocaleDateString('en-GB') || '',
  renderStars: (rating) => `<span class="stars">${rating}</span>`,
  initIcons: vi.fn(),
  getBookStatus: (book) => {
    if (!book.readHistory?.length) return 'unread';
    const current = book.readHistory[0];
    if (current.finishDate) return 'finished';
    if (current.startDate) return 'reading';
    return 'unread';
  }
}));

// Sample test data
const sampleBooks = [
  {
    id: '1',
    title: 'Currently Reading Book',
    author: 'Author A',
    coverImageUrl: 'https://example.com/cover1.jpg',
    readHistory: [{ startDate: '2024-01-01' }],
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: '2',
    title: 'Finished Book',
    author: 'Author B',
    rating: 5,
    readHistory: [{ startDate: '2024-01-01', finishDate: '2024-01-15' }],
    createdAt: '2024-01-02T00:00:00.000Z'
  },
  {
    id: '3',
    title: 'Top Rated Book',
    author: 'Author C',
    rating: 4,
    coverImageUrl: 'https://example.com/cover3.jpg',
    readHistory: [{ startDate: '2023-12-01', finishDate: '2023-12-15' }],
    createdAt: '2024-01-03T00:00:00.000Z'
  },
  {
    id: '4',
    title: 'Unread Book',
    author: 'Author D',
    rating: 3,
    readHistory: [],
    createdAt: '2024-01-04T00:00:00.000Z'
  },
  {
    id: '5',
    title: 'Another Reading Book',
    author: 'Author E',
    readHistory: [{ startDate: '2024-02-01' }],
    createdAt: '2024-02-01T00:00:00.000Z'
  }
];

describe('Widget Registry', () => {
  beforeEach(() => {
    // Clear registry
    widgetRegistry.widgets.clear();
  });

  it('should register a widget', () => {
    widgetRegistry.register(CurrentlyReadingWidget);
    expect(widgetRegistry.has('currentlyReading')).toBe(true);
  });

  it('should throw error for widget without id', () => {
    class InvalidWidget {}
    expect(() => widgetRegistry.register(InvalidWidget)).toThrow('Widget must have a static id property');
  });

  it('should get a registered widget by id', () => {
    widgetRegistry.register(CurrentlyReadingWidget);
    const widget = widgetRegistry.get('currentlyReading');
    expect(widget).toBe(CurrentlyReadingWidget);
  });

  it('should return undefined for unregistered widget', () => {
    const widget = widgetRegistry.get('nonexistent');
    expect(widget).toBeUndefined();
  });

  it('should get all registered widgets', () => {
    widgetRegistry.register(CurrentlyReadingWidget);
    widgetRegistry.register(RecentlyAddedWidget);
    const all = widgetRegistry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(CurrentlyReadingWidget);
    expect(all).toContain(RecentlyAddedWidget);
  });

  it('should get all widget IDs', () => {
    widgetRegistry.register(CurrentlyReadingWidget);
    widgetRegistry.register(RecentlyAddedWidget);
    const ids = widgetRegistry.getIds();
    expect(ids).toContain('currentlyReading');
    expect(ids).toContain('recentlyAdded');
  });

  it('should generate default configs for registered widgets', () => {
    widgetRegistry.register(CurrentlyReadingWidget);
    widgetRegistry.register(RecentlyAddedWidget);
    const configs = widgetRegistry.getDefaultConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0]).toEqual({
      id: 'currentlyReading',
      enabled: true,
      order: 0,
      size: 6,
      settings: { count: 6 }
    });
  });
});

describe('BaseWidget', () => {
  it('should have default properties', () => {
    expect(BaseWidget.id).toBe('');
    expect(BaseWidget.name).toBe('');
    expect(BaseWidget.defaultSize).toBe(12);
    expect(BaseWidget.defaultSettings).toEqual({});
  });

  it('should have default filterAndSort that returns books unchanged', () => {
    const result = BaseWidget.filterAndSort(sampleBooks);
    expect(result).toEqual(sampleBooks);
  });

  it('should have default getEmptyMessage', () => {
    expect(BaseWidget.getEmptyMessage()).toBe('No items to display');
  });

  it('should have default getSeeAllLink returning null', () => {
    expect(BaseWidget.getSeeAllLink()).toBeNull();
  });

  it('should have default getSeeAllParams returning null', () => {
    expect(BaseWidget.getSeeAllParams()).toBeNull();
  });
});

describe('WelcomeWidget', () => {
  it('should have correct static properties', () => {
    expect(WelcomeWidget.id).toBe('welcome');
    expect(WelcomeWidget.name).toBe('Welcome');
    expect(WelcomeWidget.icon).toBe('home');
    expect(WelcomeWidget.iconColor).toBe('text-primary');
    expect(WelcomeWidget.defaultSize).toBe(12);
  });

  it('should return all books (no filtering)', () => {
    const result = WelcomeWidget.filterAndSort(sampleBooks);
    expect(result).toHaveLength(sampleBooks.length);
  });

  it('should render welcome message with stats', () => {
    const config = { size: 12, settings: {} };
    const html = WelcomeWidget.renderWidget(sampleBooks, config, {});
    expect(html).toContain('Welcome back!');
    expect(html).toContain(`${sampleBooks.length} book`);
  });

  it('should show books added this year', () => {
    const thisYear = new Date().getFullYear();
    const booksWithDates = [
      { id: '1', title: 'Book 1', createdAt: new Date().toISOString() },
      { id: '2', title: 'Book 2', createdAt: new Date(thisYear - 1, 0, 1).toISOString() }
    ];
    const config = { size: 12, settings: {} };
    const html = WelcomeWidget.renderWidget(booksWithDates, config, {});
    expect(html).toContain('1 added this year');
  });
});

describe('CurrentlyReadingWidget', () => {
  it('should have correct static properties', () => {
    expect(CurrentlyReadingWidget.id).toBe('currentlyReading');
    expect(CurrentlyReadingWidget.name).toBe('Currently Reading');
    expect(CurrentlyReadingWidget.icon).toBe('book-open');
    expect(CurrentlyReadingWidget.iconColor).toBe('text-blue-600');
    expect(CurrentlyReadingWidget.defaultSize).toBe(6);
  });

  it('should filter only currently reading books', () => {
    const result = CurrentlyReadingWidget.filterAndSort(sampleBooks);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toContain('1');
    expect(result.map(b => b.id)).toContain('5');
  });

  it('should return empty message', () => {
    expect(CurrentlyReadingWidget.getEmptyMessage()).toBe('No books currently being read');
  });

  it('should return see all link', () => {
    expect(CurrentlyReadingWidget.getSeeAllLink()).toBe('/books/');
  });

  it('should return see all params for reading status', () => {
    expect(CurrentlyReadingWidget.getSeeAllParams()).toEqual({ status: 'reading' });
  });

  it('should render book cards', () => {
    const html = CurrentlyReadingWidget.render(sampleBooks.slice(0, 2), { settings: { count: 6 } }, {});
    expect(html).toContain('Currently Reading Book');
    expect(html).toContain('Author A');
    expect(html).toContain('/books/view/?id=1');
  });

  it('should render widget with header', () => {
    const html = CurrentlyReadingWidget.renderWidget(sampleBooks, { size: 6, settings: { count: 6 } }, {});
    expect(html).toContain('Currently Reading');
    expect(html).toContain('book-open');
    expect(html).toContain('text-blue-600');
  });
});

describe('RecentlyAddedWidget', () => {
  it('should have correct static properties', () => {
    expect(RecentlyAddedWidget.id).toBe('recentlyAdded');
    expect(RecentlyAddedWidget.name).toBe('Recently Added');
    expect(RecentlyAddedWidget.icon).toBe('plus-circle');
    expect(RecentlyAddedWidget.defaultSize).toBe(12);
  });

  it('should sort books by createdAt descending', () => {
    const result = RecentlyAddedWidget.filterAndSort(sampleBooks);
    expect(result[0].id).toBe('5'); // Most recent
    expect(result[result.length - 1].id).toBe('1'); // Oldest
  });

  it('should return see all params for createdAt sort', () => {
    expect(RecentlyAddedWidget.getSeeAllParams()).toEqual({ sort: 'createdAt-desc' });
  });
});

describe('TopRatedWidget', () => {
  it('should have correct static properties', () => {
    expect(TopRatedWidget.id).toBe('topRated');
    expect(TopRatedWidget.name).toBe('Top Rated');
    expect(TopRatedWidget.icon).toBe('star');
    expect(TopRatedWidget.iconColor).toBe('text-yellow-500');
  });

  it('should filter books with rating >= 4', () => {
    const result = TopRatedWidget.filterAndSort(sampleBooks);
    expect(result).toHaveLength(2);
    expect(result.every(b => b.rating >= 4)).toBe(true);
  });

  it('should sort by rating descending', () => {
    const result = TopRatedWidget.filterAndSort(sampleBooks);
    expect(result[0].rating).toBe(5);
    expect(result[1].rating).toBe(4);
  });

  it('should return see all params for rating sort', () => {
    expect(TopRatedWidget.getSeeAllParams()).toEqual({ sort: 'rating-desc', rating: '4' });
  });

  it('should render stars in book cards', () => {
    const html = TopRatedWidget.render(sampleBooks.filter(b => b.rating >= 4), { settings: { count: 6, minRating: 4 } }, {});
    expect(html).toContain('stars');
  });
});

describe('RecentlyFinishedWidget', () => {
  it('should have correct static properties', () => {
    expect(RecentlyFinishedWidget.id).toBe('recentlyFinished');
    expect(RecentlyFinishedWidget.name).toBe('Recently Finished');
    expect(RecentlyFinishedWidget.icon).toBe('check-circle');
    expect(RecentlyFinishedWidget.iconColor).toBe('text-purple-600');
  });

  it('should filter only finished books', () => {
    const result = RecentlyFinishedWidget.filterAndSort(sampleBooks);
    expect(result).toHaveLength(2);
    expect(result.every(b => b.readHistory?.[0]?.finishDate)).toBe(true);
  });

  it('should sort by finish date descending', () => {
    const result = RecentlyFinishedWidget.filterAndSort(sampleBooks);
    // Book 2 finished on 2024-01-15, Book 3 finished on 2023-12-15
    expect(result[0].id).toBe('2');
  });

  it('should return see all params for finished status', () => {
    expect(RecentlyFinishedWidget.getSeeAllParams()).toEqual({ status: 'finished' });
  });
});

describe('Widget Renderer', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // Register widgets for tests
    widgetRegistry.widgets.clear();
    widgetRegistry.register(CurrentlyReadingWidget);
    widgetRegistry.register(RecentlyAddedWidget);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('renderWidgetSkeletons', () => {
    it('should render skeleton loading state', () => {
      renderWidgetSkeletons(container, 2);
      expect(container.innerHTML).toContain('widget-skeleton');
      expect(container.querySelectorAll('.widget-skeleton').length).toBe(2);
    });

    it('should render skeleton with default count', () => {
      renderWidgetSkeletons(container);
      expect(container.querySelectorAll('.widget-skeleton').length).toBe(4);
    });
  });

  describe('renderWidgets', () => {
    it('should render enabled widgets', () => {
      const settings = {
        version: 2,
        widgets: [
          { id: 'currentlyReading', enabled: true, order: 0, size: 6, settings: { count: 6 } },
          { id: 'recentlyAdded', enabled: true, order: 1, size: 12, settings: { count: 6 } }
        ]
      };
      renderWidgets(container, sampleBooks, settings, {});
      expect(container.innerHTML).toContain('widget-grid');
      expect(container.innerHTML).toContain('Currently Reading');
      expect(container.innerHTML).toContain('Recently Added');
    });

    it('should not render disabled widgets', () => {
      const settings = {
        version: 2,
        widgets: [
          { id: 'currentlyReading', enabled: false, order: 0, size: 6, settings: { count: 6 } },
          { id: 'recentlyAdded', enabled: true, order: 1, size: 12, settings: { count: 6 } }
        ]
      };
      renderWidgets(container, sampleBooks, settings, {});
      // Check for the widget header specifically (not book titles)
      expect(container.innerHTML).not.toContain('data-lucide="book-open"');
      expect(container.innerHTML).toContain('data-lucide="plus-circle"');
      expect(container.innerHTML).toContain('Recently Added');
    });

    it('should apply correct size classes', () => {
      const settings = {
        version: 2,
        widgets: [
          { id: 'currentlyReading', enabled: true, order: 0, size: 6, settings: { count: 6 } }
        ]
      };
      renderWidgets(container, sampleBooks, settings, {});
      expect(container.innerHTML).toContain('widget-col-6');
    });

    it('should show message when no widgets enabled', () => {
      const settings = {
        version: 2,
        widgets: [
          { id: 'currentlyReading', enabled: false, order: 0, size: 6, settings: { count: 6 } }
        ]
      };
      renderWidgets(container, sampleBooks, settings, {});
      expect(container.innerHTML).toContain('No widgets enabled');
    });

    it('should skip unknown widgets gracefully', () => {
      const settings = {
        version: 2,
        widgets: [
          { id: 'unknownWidget', enabled: true, order: 0, size: 12, settings: {} },
          { id: 'currentlyReading', enabled: true, order: 1, size: 6, settings: { count: 6 } }
        ]
      };
      renderWidgets(container, sampleBooks, settings, {});
      expect(container.innerHTML).toContain('Currently Reading');
    });
  });

  describe('getWidgetInfo', () => {
    it('should return info for all registered widgets', () => {
      const info = getWidgetInfo();
      expect(info).toHaveLength(2);
      expect(info[0]).toHaveProperty('id');
      expect(info[0]).toHaveProperty('name');
      expect(info[0]).toHaveProperty('icon');
      expect(info[0]).toHaveProperty('defaultSize');
    });
  });

  describe('WIDGET_SIZES', () => {
    it('should have all size options', () => {
      expect(WIDGET_SIZES).toHaveLength(4);
      expect(WIDGET_SIZES.map(s => s.value)).toEqual([3, 6, 9, 12]);
    });

    it('should have labels and descriptions', () => {
      WIDGET_SIZES.forEach(size => {
        expect(size).toHaveProperty('label');
        expect(size).toHaveProperty('description');
      });
    });
  });
});

describe('Widget Settings', () => {
  beforeEach(() => {
    widgetRegistry.widgets.clear();
    widgetRegistry.register(CurrentlyReadingWidget);
    widgetRegistry.register(RecentlyAddedWidget);
    widgetRegistry.register(TopRatedWidget);
    widgetRegistry.register(RecentlyFinishedWidget);
  });

  describe('getDefaultWidgetConfigs', () => {
    it('should return configs for all registered widgets', () => {
      const configs = getDefaultWidgetConfigs();
      expect(configs).toHaveLength(4);
    });

    it('should set default values correctly', () => {
      const configs = getDefaultWidgetConfigs();
      const currentlyReading = configs.find(c => c.id === 'currentlyReading');
      expect(currentlyReading).toEqual({
        id: 'currentlyReading',
        enabled: true,
        order: 0,
        size: 6,
        settings: { count: 6 }
      });
    });
  });

  describe('getEnabledWidgets', () => {
    it('should return only enabled widgets', () => {
      const settings = {
        widgets: [
          { id: 'a', enabled: true, order: 0 },
          { id: 'b', enabled: false, order: 1 },
          { id: 'c', enabled: true, order: 2 }
        ]
      };
      const enabled = getEnabledWidgets(settings);
      expect(enabled).toHaveLength(2);
      expect(enabled.map(w => w.id)).toEqual(['a', 'c']);
    });

    it('should sort by order', () => {
      const settings = {
        widgets: [
          { id: 'a', enabled: true, order: 2 },
          { id: 'b', enabled: true, order: 0 },
          { id: 'c', enabled: true, order: 1 }
        ]
      };
      const enabled = getEnabledWidgets(settings);
      expect(enabled.map(w => w.id)).toEqual(['b', 'c', 'a']);
    });
  });
});

// Valid sort values that the books list page accepts
const VALID_SORT_VALUES = [
  'createdAt-desc', 'createdAt-asc',
  'title-asc', 'title-desc',
  'author-asc', 'author-desc',
  'rating-desc', 'rating-asc'
];

// Valid filter parameter keys
const VALID_FILTER_KEYS = ['status', 'rating', 'sort', 'genre'];

describe('Widget See All Parameters', () => {
  describe('RecentlyAddedWidget', () => {
    it('should return valid sort parameter for books list', () => {
      const params = RecentlyAddedWidget.getSeeAllParams();
      expect(params).toHaveProperty('sort');
      expect(VALID_SORT_VALUES).toContain(params.sort);
    });

    it('should generate correct See All URL', () => {
      const link = RecentlyAddedWidget.getSeeAllLink();
      const params = RecentlyAddedWidget.getSeeAllParams();
      expect(link).toBe('/books/');
      expect(params.sort).toBe('createdAt-desc');
    });
  });

  describe('TopRatedWidget', () => {
    it('should return valid sort parameter for books list', () => {
      const params = TopRatedWidget.getSeeAllParams();
      expect(params).toHaveProperty('sort');
      expect(VALID_SORT_VALUES).toContain(params.sort);
    });

    it('should include rating filter', () => {
      const params = TopRatedWidget.getSeeAllParams();
      expect(params).toHaveProperty('rating');
      expect(params.sort).toBe('rating-desc');
    });
  });

  describe('CurrentlyReadingWidget', () => {
    it('should return valid status filter', () => {
      const params = CurrentlyReadingWidget.getSeeAllParams();
      expect(params).toHaveProperty('status');
      expect(params.status).toBe('reading');
    });
  });

  describe('RecentlyFinishedWidget', () => {
    it('should return valid status filter', () => {
      const params = RecentlyFinishedWidget.getSeeAllParams();
      expect(params).toHaveProperty('status');
      expect(params.status).toBe('finished');
    });
  });

  describe('WelcomeWidget', () => {
    it('should not have See All link', () => {
      expect(WelcomeWidget.getSeeAllLink()).toBe(null);
    });
  });

  describe('All widgets with See All links', () => {
    const widgetsWithSeeAll = [
      CurrentlyReadingWidget,
      RecentlyAddedWidget,
      TopRatedWidget,
      RecentlyFinishedWidget
    ];

    it.each(widgetsWithSeeAll)('%s should have valid parameters', (Widget) => {
      const link = Widget.getSeeAllLink();
      const params = Widget.getSeeAllParams();

      expect(link).toBe('/books/');
      expect(params).toBeTruthy();

      // All parameter keys should be valid
      Object.keys(params).forEach(key => {
        expect(VALID_FILTER_KEYS).toContain(key);
      });

      // If sort is specified, it should be valid
      if (params.sort) {
        expect(VALID_SORT_VALUES).toContain(params.sort);
      }
    });
  });
});

describe('Widget Integration', () => {
  beforeEach(() => {
    widgetRegistry.widgets.clear();
    widgetRegistry.register(CurrentlyReadingWidget);
    widgetRegistry.register(RecentlyAddedWidget);
    widgetRegistry.register(TopRatedWidget);
    widgetRegistry.register(RecentlyFinishedWidget);
  });

  it('should render full widget with see all link when more books than count', () => {
    const manyReadingBooks = Array(10).fill(0).map((_, i) => ({
      id: `reading-${i}`,
      title: `Reading Book ${i}`,
      author: 'Author',
      readHistory: [{ startDate: '2024-01-01' }]
    }));

    const html = CurrentlyReadingWidget.renderWidget(manyReadingBooks, { size: 6, settings: { count: 6 } }, {});
    expect(html).toContain('See all');
    expect(html).toContain('/books/?status=reading');
  });

  it('should not show see all link when books count is within limit', () => {
    const fewBooks = [
      { id: '1', title: 'Book 1', readHistory: [{ startDate: '2024-01-01' }] }
    ];

    const html = CurrentlyReadingWidget.renderWidget(fewBooks, { size: 6, settings: { count: 6 } }, {});
    expect(html).not.toContain('See all');
  });

  it('should show empty message when no books match filter', () => {
    const noReadingBooks = [
      { id: '1', title: 'Unread', readHistory: [] }
    ];

    const html = CurrentlyReadingWidget.renderWidget(noReadingBooks, { size: 6, settings: { count: 6 } }, {});
    expect(html).toContain('No books currently being read');
  });

  it('should handle books without cover images', () => {
    const bookWithoutCover = [{
      id: '1',
      title: 'No Cover Book',
      author: 'Author',
      readHistory: [{ startDate: '2024-01-01' }]
    }];

    const html = CurrentlyReadingWidget.render(bookWithoutCover, { settings: { count: 6 } }, {});
    expect(html).toContain('No Cover Book');
    expect(html).toContain('data-lucide="book"');
  });
});
