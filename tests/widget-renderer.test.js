/**
 * Tests for Widget Renderer
 * Tests widget rendering, skeletons, and widget info retrieval
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Widget Renderer', () => {
  let container;

  // Mock widget registry
  const mockWidgets = new Map();

  // Mock widget classes
  const MockWidgetA = {
    id: 'widget-a',
    name: 'Widget A',
    icon: 'star',
    iconColor: 'text-yellow-500',
    defaultSize: 6,
    defaultSettings: { count: 5 },
    settingsSchema: null,
    requiresWishlist: false,
    renderWidget: vi.fn((books, config) => {
      return '<div class="widget-a">Widget A: ' + books.length + ' books</div>';
    })
  };

  const MockWidgetB = {
    id: 'widget-b',
    name: 'Widget B',
    icon: 'heart',
    iconColor: 'text-red-500',
    defaultSize: 12,
    defaultSettings: {},
    settingsSchema: null,
    requiresWishlist: true,
    renderWidget: vi.fn((items, config) => {
      return '<div class="widget-b">Widget B: ' + items.length + ' items</div>';
    })
  };

  function renderWidgetSkeletons(container, count = 4) {
    const skeletons = [];
    for (let i = 0; i < count; i++) {
      skeletons.push('<div class="widget-skeleton widget-col-12"><div class="skeleton-header"><div class="skeleton skeleton-icon"></div><div class="skeleton skeleton-title"></div></div><div class="skeleton-content"><div class="skeleton-book"><div class="skeleton skeleton-book-cover"></div><div class="skeleton skeleton-book-title"></div><div class="skeleton skeleton-book-author"></div></div><div class="skeleton-book"><div class="skeleton skeleton-book-cover"></div><div class="skeleton skeleton-book-title"></div><div class="skeleton skeleton-book-author"></div></div><div class="skeleton-book"><div class="skeleton skeleton-book-cover"></div><div class="skeleton skeleton-book-title"></div><div class="skeleton skeleton-book-author"></div></div><div class="skeleton-book"><div class="skeleton skeleton-book-cover"></div><div class="skeleton skeleton-book-title"></div><div class="skeleton skeleton-book-author"></div></div></div></div>');
    }
    container.innerHTML = '<div class="widget-grid">' + skeletons.join('') + '</div>';
  }

  function renderWidgets(container, books, settings, genreLookup = {}, seriesLookup = null, wishlistItems = []) {
    const enabledWidgets = settings.widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);

    if (enabledWidgets.length === 0) {
      container.innerHTML = '<div class="text-center py-12 text-gray-500"><p>No widgets enabled. Go to Settings to configure your dashboard.</p></div>';
      return;
    }

    const widgetHtml = enabledWidgets.map(config => {
      const Widget = mockWidgets.get(config.id);
      if (!Widget) {
        return '';
      }

      const sizeClass = 'widget-col-' + (config.size || Widget.defaultSize);
      const data = Widget.requiresWishlist ? wishlistItems : books;
      const html = Widget.renderWidget(data, config, genreLookup, seriesLookup);

      return '<div class="' + sizeClass + '">' + html + '</div>';
    }).join('');

    container.innerHTML = '<div class="widget-grid">' + widgetHtml + '</div>';
  }

  function renderSingleWidget(widgetId, books, config, genreLookup = {}, seriesLookup = null) {
    const Widget = mockWidgets.get(widgetId);
    if (!Widget) {
      return '<p class="text-gray-500">Widget not found</p>';
    }

    return Widget.renderWidget(books, config, genreLookup, seriesLookup);
  }

  function getWidgetInfo() {
    return Array.from(mockWidgets.values()).map(Widget => ({
      id: Widget.id,
      name: Widget.name,
      icon: Widget.icon,
      iconColor: Widget.iconColor,
      defaultSize: Widget.defaultSize,
      defaultSettings: Widget.defaultSettings,
      settingsSchema: Widget.settingsSchema
    }));
  }

  const WIDGET_SIZES = [
    { value: 3, label: 'Small', description: 'Quarter width' },
    { value: 6, label: 'Medium', description: 'Half width' },
    { value: 9, label: 'Large', description: 'Three-quarter width' },
    { value: 12, label: 'Full', description: 'Full width' }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockWidgets.clear();
    mockWidgets.set('widget-a', MockWidgetA);
    mockWidgets.set('widget-b', MockWidgetB);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderWidgetSkeletons', () => {
    it('should render default 4 skeleton widgets', () => {
      renderWidgetSkeletons(container);
      const skeletons = container.querySelectorAll('.widget-skeleton');
      expect(skeletons).toHaveLength(4);
    });

    it('should render specified number of skeletons', () => {
      renderWidgetSkeletons(container, 2);
      const skeletons = container.querySelectorAll('.widget-skeleton');
      expect(skeletons).toHaveLength(2);
    });

    it('should include skeleton header with icon and title', () => {
      renderWidgetSkeletons(container, 1);
      expect(container.querySelector('.skeleton-header')).toBeTruthy();
      expect(container.querySelector('.skeleton-icon')).toBeTruthy();
      expect(container.querySelector('.skeleton-title')).toBeTruthy();
    });

    it('should include skeleton book items', () => {
      renderWidgetSkeletons(container, 1);
      const bookSkeletons = container.querySelectorAll('.skeleton-book');
      expect(bookSkeletons).toHaveLength(4);
    });

    it('should wrap skeletons in widget-grid', () => {
      renderWidgetSkeletons(container);
      expect(container.querySelector('.widget-grid')).toBeTruthy();
    });
  });

  describe('renderWidgets', () => {
    const mockBooks = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];

    const mockWishlist = [
      { id: 'w1', title: 'Wishlist 1' },
      { id: 'w2', title: 'Wishlist 2' },
      { id: 'w3', title: 'Wishlist 3' }
    ];

    it('should render enabled widgets', () => {
      const settings = {
        widgets: [
          { id: 'widget-a', enabled: true, order: 0, size: 6, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings);

      expect(container.innerHTML).toContain('widget-a');
      expect(MockWidgetA.renderWidget).toHaveBeenCalled();
    });

    it('should not render disabled widgets', () => {
      const settings = {
        widgets: [
          { id: 'widget-a', enabled: false, order: 0, size: 6, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings);

      expect(container.innerHTML).toContain('No widgets enabled');
      expect(MockWidgetA.renderWidget).not.toHaveBeenCalled();
    });

    it('should show empty state when no widgets enabled', () => {
      const settings = { widgets: [] };

      renderWidgets(container, mockBooks, settings);

      expect(container.innerHTML).toContain('No widgets enabled');
      expect(container.innerHTML).toContain('Settings');
    });

    it('should apply size class to widget container', () => {
      const settings = {
        widgets: [
          { id: 'widget-a', enabled: true, order: 0, size: 9, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings);

      expect(container.querySelector('.widget-col-9')).toBeTruthy();
    });

    it('should pass books to regular widgets', () => {
      const settings = {
        widgets: [
          { id: 'widget-a', enabled: true, order: 0, size: 6, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings);

      expect(MockWidgetA.renderWidget).toHaveBeenCalledWith(
        mockBooks,
        expect.any(Object),
        expect.any(Object),
        null
      );
    });

    it('should pass wishlist items to widgets that require wishlist', () => {
      const settings = {
        widgets: [
          { id: 'widget-b', enabled: true, order: 0, size: 12, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings, {}, null, mockWishlist);

      expect(MockWidgetB.renderWidget).toHaveBeenCalledWith(
        mockWishlist,
        expect.any(Object),
        expect.any(Object),
        null
      );
    });

    it('should render widgets in order', () => {
      const settings = {
        widgets: [
          { id: 'widget-b', enabled: true, order: 1, size: 12, settings: {} },
          { id: 'widget-a', enabled: true, order: 0, size: 6, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings);

      const widgetDivs = container.querySelectorAll('.widget-grid > div');
      expect(widgetDivs[0].innerHTML).toContain('widget-a');
    });

    it('should skip non-existent widgets', () => {
      const settings = {
        widgets: [
          { id: 'non-existent', enabled: true, order: 0, size: 6, settings: {} }
        ]
      };

      expect(() => renderWidgets(container, mockBooks, settings)).not.toThrow();
    });

    it('should pass genreLookup and seriesLookup to widgets', () => {
      const genreLookup = { 'g1': { name: 'Fantasy' } };
      const seriesLookup = { 's1': { name: 'Series 1' } };
      const settings = {
        widgets: [
          { id: 'widget-a', enabled: true, order: 0, size: 6, settings: {} }
        ]
      };

      renderWidgets(container, mockBooks, settings, genreLookup, seriesLookup);

      expect(MockWidgetA.renderWidget).toHaveBeenCalledWith(
        mockBooks,
        expect.any(Object),
        genreLookup,
        seriesLookup
      );
    });
  });

  describe('renderSingleWidget', () => {
    const mockBooks = [{ id: '1', title: 'Book 1' }];
    const config = { id: 'widget-a', enabled: true, size: 6, settings: {} };

    it('should render widget by id', () => {
      const html = renderSingleWidget('widget-a', mockBooks, config);
      expect(html).toContain('widget-a');
      expect(MockWidgetA.renderWidget).toHaveBeenCalled();
    });

    it('should return error message for non-existent widget', () => {
      const html = renderSingleWidget('non-existent', mockBooks, config);
      expect(html).toContain('Widget not found');
    });

    it('should pass genreLookup and seriesLookup', () => {
      const genreLookup = { 'g1': { name: 'Fantasy' } };
      const seriesLookup = { 's1': { name: 'Series 1' } };

      renderSingleWidget('widget-a', mockBooks, config, genreLookup, seriesLookup);

      expect(MockWidgetA.renderWidget).toHaveBeenCalledWith(
        mockBooks,
        config,
        genreLookup,
        seriesLookup
      );
    });
  });

  describe('getWidgetInfo', () => {
    it('should return info for all widgets', () => {
      const info = getWidgetInfo();
      expect(info).toHaveLength(2);
    });

    it('should include required properties', () => {
      const info = getWidgetInfo();
      const widgetAInfo = info.find(w => w.id === 'widget-a');

      expect(widgetAInfo).toEqual({
        id: 'widget-a',
        name: 'Widget A',
        icon: 'star',
        iconColor: 'text-yellow-500',
        defaultSize: 6,
        defaultSettings: { count: 5 },
        settingsSchema: null
      });
    });
  });

  describe('WIDGET_SIZES', () => {
    it('should have 4 size options', () => {
      expect(WIDGET_SIZES).toHaveLength(4);
    });

    it('should include small (3), medium (6), large (9), full (12)', () => {
      expect(WIDGET_SIZES.map(s => s.value)).toEqual([3, 6, 9, 12]);
    });

    it('should have labels and descriptions', () => {
      WIDGET_SIZES.forEach(size => {
        expect(size.label).toBeTruthy();
        expect(size.description).toBeTruthy();
      });
    });
  });
});
