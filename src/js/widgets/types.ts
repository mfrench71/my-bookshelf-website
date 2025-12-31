/**
 * Widget Type Definitions
 * Re-exports common types and defines widget-specific types
 */

// Re-export common types from main type definitions
import type {
  Book as MainBook,
  Genre,
  Series as MainSeries,
  WishlistItem as MainWishlistItem,
  BookCovers,
  FirestoreTimestamp,
  WidgetConfig,
} from '../types/index.js';

// Re-export WidgetConfig for consumers
export type { WidgetConfig };

// ============================================================================
// Widget-specific Type Aliases
// ============================================================================

/** Genre lookup map */
export type GenreLookup = Record<
  string,
  {
    id: string;
    name: string;
    color: string;
    bookCount?: number;
  }
>;

/** Series data for widgets */
export interface Series extends Omit<MainSeries, 'createdAt' | 'updatedAt' | 'expectedBooks'> {
  bookCount?: number;
}

/** Series lookup map */
export type SeriesLookup = Map<string, Series>;

/** Timestamp type - can be Date, Firestore Timestamp, string, or number */
export type TimestampValue = Date | { toDate(): Date } | string | number;

/** Book data for widgets - uses main Book type with optional fields for flexibility */
export interface Book {
  id: string;
  title: string;
  author?: string;
  coverImageUrl?: string;
  rating?: number | null;
  status?: string;
  createdAt?: TimestampValue;
  reads?: Array<{
    startedAt?: string | null;
    finishedAt?: string | null;
  }>;
  genres?: string[];
  seriesId?: string | null;
  seriesPosition?: number | null;
}

/** Wishlist item data for widgets */
export interface WishlistItem {
  id: string;
  title?: string;
  author?: string;
  coverImageUrl?: string | null;
  priority?: 'high' | 'medium' | 'low' | null;
  createdAt?: TimestampValue;
  notes?: string | null;
  isbn?: string | null;
}

// ============================================================================
// Widget Settings Types
// ============================================================================

/** Widget settings schema item */
export interface SettingsSchemaItem {
  key: string;
  label: string;
  type: 'select' | 'number' | 'boolean' | 'text';
  options?: number[] | Array<{ value: string; label: string }>;
}

/** Widget settings object */
export interface WidgetSettings {
  version?: number;
  widgets: WidgetConfig[];
}

// ============================================================================
// Widget Class Types
// ============================================================================

/** Base widget class interface (static members) */
export interface BaseWidgetClass {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  defaultSize: number;
  defaultSettings: Record<string, unknown>;
  settingsSchema: SettingsSchemaItem[];
  requiresWishlist?: boolean;

  filterAndSort(data: Book[] | WishlistItem[], config?: WidgetConfig): Book[] | WishlistItem[];
  render(data: Book[] | WishlistItem[], config: WidgetConfig, genreLookup?: GenreLookup): string;
  getEmptyMessage(): string;
  getSeeAllLink(): string | null;
  getSeeAllParams(): Record<string, string> | null;
  renderWidget(
    data: Book[] | WishlistItem[],
    config: WidgetConfig,
    genreLookup?: GenreLookup,
    seriesLookup?: SeriesLookup | null
  ): string;
}

/** Widget info for settings UI */
export interface WidgetInfo {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  defaultSize: number;
  defaultSettings: Record<string, unknown>;
  settingsSchema: SettingsSchemaItem[];
}

/** Widget size option */
export interface WidgetSizeOption {
  value: number;
  label: string;
  description: string;
}
