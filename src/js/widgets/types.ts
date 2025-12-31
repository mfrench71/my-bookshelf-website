/**
 * Widget Type Definitions
 */

/** Genre lookup map */
export interface GenreLookup {
  [id: string]: {
    id: string;
    name: string;
    color: string;
    bookCount?: number;
  };
}

/** Series data */
export interface Series {
  id: string;
  name: string;
  bookCount?: number;
  totalBooks?: number;
  description?: string;
}

/** Series lookup map */
export type SeriesLookup = Map<string, Series>;

/** Timestamp type - can be Date, Firestore Timestamp, string, or number */
export type TimestampValue = Date | { toDate(): Date } | string | number;

/** Book data for widgets */
export interface Book {
  id: string;
  title: string;
  author?: string;
  coverImageUrl?: string;
  rating?: number;
  status?: string;
  createdAt?: TimestampValue;
  readHistory?: Array<{
    startDate?: TimestampValue;
    finishDate?: TimestampValue;
  }>;
  genres?: string[];
  seriesId?: string;
  seriesPosition?: number;
}

/** Wishlist item data */
export interface WishlistItem {
  id: string;
  title?: string;
  author?: string;
  coverImageUrl?: string;
  priority?: 'high' | 'medium' | 'low';
  createdAt?: TimestampValue;
  notes?: string;
  isbn?: string;
}

/** Widget settings schema item */
export interface SettingsSchemaItem {
  key: string;
  label: string;
  type: 'select' | 'number' | 'boolean' | 'text';
  options?: number[] | Array<{ value: string; label: string }>;
}

/** Widget configuration */
export interface WidgetConfig {
  id: string;
  enabled: boolean;
  order: number;
  size: number;
  settings: Record<string, unknown>;
}

/** Widget settings object */
export interface WidgetSettings {
  version: number;
  widgets: WidgetConfig[];
}

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
