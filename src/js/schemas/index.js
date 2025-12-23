// Schemas Index - Re-exports all validation schemas

export {
  BookSchema,
  BookFormSchema,
  BookUpdateSchema
} from './book.js';

export {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  DeleteAccountSchema
} from './auth.js';

export {
  GenreSchema,
  CreateGenreSchema,
  UpdateGenreSchema,
  validateGenreUniqueness,
  validateColourUniqueness
} from './genre.js';
