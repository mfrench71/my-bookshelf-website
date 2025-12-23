/**
 * Widget System - Main entry point
 *
 * Exports widget registry and all widget classes.
 * Widgets are auto-registered when this module is imported.
 */

import { widgetRegistry } from './registry.js';
import { BaseWidget } from './base-widget.js';

// Import all widgets
import { CurrentlyReadingWidget } from './widgets/currently-reading.js';
import { RecentlyAddedWidget } from './widgets/recently-added.js';
import { TopRatedWidget } from './widgets/top-rated.js';
import { RecentlyFinishedWidget } from './widgets/recently-finished.js';

// Register all widgets in default order
widgetRegistry.register(CurrentlyReadingWidget);
widgetRegistry.register(RecentlyAddedWidget);
widgetRegistry.register(TopRatedWidget);
widgetRegistry.register(RecentlyFinishedWidget);

// Export for external use
export { widgetRegistry, BaseWidget };
export { CurrentlyReadingWidget, RecentlyAddedWidget, TopRatedWidget, RecentlyFinishedWidget };
