// Repository Index - Export all repository instances
// Use these singletons for data access throughout the application

export { BaseRepository } from './base-repository.js';
export { bookRepository, BookRepository } from './book-repository.js';
export { genreRepository, GenreRepository } from './genre-repository.js';
export { seriesRepository, SeriesRepository } from './series-repository.js';
export { wishlistRepository } from './wishlist-repository.js';
export { binRepository, BIN_RETENTION_DAYS } from './bin-repository.js';
export type { WishlistItem, WishlistItemInput, WishlistItemUpdate } from './wishlist-repository.js';
export type { BinnedBook, RestoreResult } from './bin-repository.js';
