// Schemas Index - Re-exports all validation schemas

export { BookSchema, BookFormSchema, BookUpdateSchema } from './book.js';
export type { Book, BookFormData, BookUpdateData } from './book.js';

export { LoginSchema, RegisterSchema, ChangePasswordSchema, ResetPasswordSchema, DeleteAccountSchema } from './auth.js';
export type { LoginData, RegisterData, ChangePasswordData, ResetPasswordData, DeleteAccountData } from './auth.js';

export {
  GenreSchema,
  CreateGenreSchema,
  UpdateGenreSchema,
  validateGenreUniqueness,
  validateColourUniqueness,
} from './genre.js';
export type { GenreData } from './genre.js';

export { SeriesSchema, SeriesFormSchema, SeriesUpdateSchema, ExpectedBookSchema } from './series.js';
export type { Series, SeriesFormData, SeriesUpdateData, ExpectedBook } from './series.js';

export { WishlistItemSchema, WishlistItemFormSchema, WishlistItemUpdateSchema } from './wishlist.js';
export type { WishlistItem, WishlistItemFormData, WishlistItemUpdateData } from './wishlist.js';

export {
  ImageSchema,
  ImagesArraySchema,
  CreateImageSchema,
  UpdateImageCaptionSchema,
  validatePrimaryImage,
  setPrimaryImage,
  getPrimaryImage,
} from './image.js';
export type { Image, ImageData } from './image.js';
