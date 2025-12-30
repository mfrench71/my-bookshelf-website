/**
 * Type Definitions for BookShelf App
 * These types mirror the Zod schemas in src/js/schemas/
 */

// ============================================================================
// Firebase Types
// ============================================================================

import { Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp | Date | number;

// ============================================================================
// Book Types
// ============================================================================

export type PhysicalFormat =
  | ''
  | 'Paperback'
  | 'Hardcover'
  | 'Mass Market Paperback'
  | 'Trade Paperback'
  | 'Library Binding'
  | 'Spiral-bound'
  | 'Audio CD'
  | 'Ebook';

export interface BookRead {
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BookCovers {
  googleBooks?: string;
  openLibrary?: string;
}

export interface BookImage {
  id: string;
  url: string;
  storagePath: string;
  isPrimary: boolean;
  caption?: string;
  uploadedAt: number;
  sizeBytes?: number;
  width?: number;
  height?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  coverImageUrl?: string;
  publisher?: string;
  publishedDate?: string;
  physicalFormat?: PhysicalFormat;
  pageCount?: number | null;
  rating?: number | null;
  genres: string[];
  seriesId?: string | null;
  seriesPosition?: number | null;
  notes?: string;
  reads: BookRead[];
  covers?: BookCovers;
  images: BookImage[];
  deletedAt?: number | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export type BookFormData = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>;
export type BookUpdateData = Partial<BookFormData>;

// ============================================================================
// Genre Types
// ============================================================================

export interface Genre {
  id: string;
  name: string;
  color: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export type GenreFormData = Pick<Genre, 'name'> & { color?: string };
export type GenreUpdateData = Partial<GenreFormData>;

export type GenreLookup = Record<string, Genre>;

// ============================================================================
// Series Types
// ============================================================================

export interface ExpectedBook {
  title: string;
  isbn?: string | null;
  position?: number | null;
  source: 'api' | 'manual';
}

export interface Series {
  id: string;
  name: string;
  description?: string | null;
  totalBooks?: number | null;
  expectedBooks: ExpectedBook[];
  deletedAt?: number | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export type SeriesFormData = Omit<Series, 'id' | 'createdAt' | 'updatedAt'>;
export type SeriesUpdateData = Partial<SeriesFormData>;

export type SeriesLookup = Record<string, Series>;

// ============================================================================
// Wishlist Types
// ============================================================================

export type WishlistPriority = 'high' | 'medium' | 'low' | null;
export type WishlistAddedFrom = 'search' | 'isbn' | 'manual';

export interface WishlistItem {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  coverImageUrl?: string | null;
  covers?: BookCovers | null;
  publisher?: string | null;
  publishedDate?: string | null;
  pageCount?: number | null;
  priority?: WishlistPriority;
  notes?: string | null;
  addedFrom: WishlistAddedFrom;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export type WishlistFormData = Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>;
export type WishlistUpdateData = Partial<WishlistFormData>;

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserProfile {
  displayName?: string;
  photoURL?: string;
}

// ============================================================================
// Widget Types
// ============================================================================

export type WidgetSize = 3 | 6 | 9 | 12;

export interface WidgetConfig {
  id: string;
  enabled: boolean;
  size: WidgetSize;
  itemCount?: number;
}

export interface WidgetSettings {
  widgets: WidgetConfig[];
}

// ============================================================================
// Sync Settings Types
// ============================================================================

export interface SyncSettings {
  autoRefreshEnabled: boolean;
  autoRefreshThreshold: number;
  autoRefreshCooldown: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export type SortDirection = 'asc' | 'desc';

export type BookSortField =
  | 'title'
  | 'author'
  | 'rating'
  | 'createdAt'
  | 'updatedAt'
  | 'series'
  | 'pageCount'
  | 'publishedDate';

export interface BookFilters {
  search?: string;
  genres?: string[];
  series?: string[];
  rating?: number | null;
  status?: ('to-read' | 'reading' | 'completed' | 'dnf')[];
}

export interface BookSortOptions {
  field: BookSortField;
  direction: SortDirection;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: Array<{
    type: string;
    identifier: string;
  }>;
  pageCount?: number;
  imageLinks?: {
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
}

export interface GoogleBooksItem {
  id: string;
  volumeInfo: GoogleBooksVolumeInfo;
}

export interface GoogleBooksResponse {
  totalItems: number;
  items?: GoogleBooksItem[];
}

export interface OpenLibraryBook {
  title?: string;
  authors?: Array<{ name: string }>;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  covers?: number[];
  isbn_10?: string[];
  isbn_13?: string[];
}

export interface ISBNLookupResult {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number | null;
  coverUrl?: string;
  covers?: BookCovers;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginatedResult<T> {
  docs: T[];
  lastDoc: unknown;
  hasMore: boolean;
}

export interface PaginationOptions {
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
  afterDoc?: unknown;
  fromServer?: boolean;
}

// ============================================================================
// Repository Types
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface SoftDeletable {
  deletedAt?: number | null;
}

// ============================================================================
// Library Health Types
// ============================================================================

export type HealthField = 'coverImageUrl' | 'genres' | 'pageCount' | 'publishedDate' | 'publisher';

export interface HealthAnalysis {
  totalBooks: number;
  completeness: number;
  missingFields: Record<HealthField, number>;
  booksToFix: string[];
}

// ============================================================================
// Toast Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  path: string[];
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// ============================================================================
// Component Types
// ============================================================================

export interface PickerOption {
  id: string;
  name: string;
  color?: string;
}

export interface GenrePickerOptions {
  container: HTMLElement;
  userId: string;
  initialSelected?: string[];
  onChange?: (selected: string[]) => void;
}

export interface SeriesPickerOptions {
  container: HTMLElement;
  userId: string;
  initialSeriesId?: string | null;
  initialPosition?: number | null;
  onChange?: (seriesId: string | null, position: number | null) => void;
}

export interface RatingInputOptions {
  container: HTMLElement;
  initialRating?: number | null;
  onChange?: (rating: number | null) => void;
}

export interface CoverPickerOptions {
  container: HTMLElement;
  initialUrl?: string;
  onSelect?: (url: string) => void;
}

export interface ModalOptions {
  title: string;
  content: string | HTMLElement;
  onClose?: () => void;
}

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

// ============================================================================
// Breadcrumb Types
// ============================================================================

export type BreadcrumbPreset =
  | 'home'
  | 'books'
  | 'books-add'
  | 'books-view'
  | 'books-edit'
  | 'wishlist'
  | 'wishlist-add'
  | 'wishlist-view'
  | 'wishlist-edit'
  | 'settings'
  | 'settings-library'
  | 'settings-preferences'
  | 'settings-maintenance'
  | 'settings-about'
  | 'settings-bin';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
