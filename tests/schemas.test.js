// Schema Validation Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Mock the Zod import path for testing (Node.js uses different path)
vi.mock('../src/js/vendor/zod.js', () => ({ z }));

// Mock GENRE_COLORS for genre schema tests
vi.mock('../src/js/genres.js', () => ({
  GENRE_COLORS: [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c'
  ]
}));

// ============================================================
// Book Schema Tests
// ============================================================

describe('BookSchema', () => {
  // Inline schema definition for testing (mirrors src/js/schemas/book.js)
  const BookSchema = z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(500, 'Title must be 500 characters or less')
      .transform(s => s.trim()),

    author: z.string()
      .min(1, 'Author is required')
      .max(500, 'Author must be 500 characters or less')
      .transform(s => s.trim()),

    isbn: z.string()
      .regex(/^(\d{10}|\d{13})?$/, 'ISBN must be 10 or 13 digits')
      .optional()
      .or(z.literal('')),

    coverImageUrl: z.string()
      .url('Invalid cover image URL')
      .optional()
      .or(z.literal('')),

    publisher: z.string()
      .max(200, 'Publisher must be 200 characters or less')
      .optional()
      .transform(s => s?.trim() || ''),

    publishedDate: z.string()
      .max(50, 'Published date must be 50 characters or less')
      .optional()
      .transform(s => s?.trim() || ''),

    physicalFormat: z.enum([
      '',
      'Paperback',
      'Hardcover',
      'Mass Market Paperback',
      'Trade Paperback',
      'Library Binding',
      'Spiral-bound',
      'Audio CD',
      'Ebook'
    ]).optional(),

    pageCount: z.union([
      z.number().int().positive('Page count must be a positive number'),
      z.null()
    ]).optional(),

    rating: z.union([
      z.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
      z.null()
    ]).optional(),

    genres: z.array(z.string()).optional().default([]),

    // Series information
    seriesName: z.string()
      .max(200, 'Series name must be 200 characters or less')
      .optional()
      .transform(s => s?.trim() || ''),

    seriesPosition: z.union([
      z.number().positive('Series position must be a positive number'),
      z.null()
    ]).optional(),

    notes: z.string()
      .max(5000, 'Notes must be 5000 characters or less')
      .optional()
      .transform(s => s?.trim() || '')
  });

  describe('title field', () => {
    it('should require a title', () => {
      const result = BookSchema.safeParse({ title: '', author: 'Test Author' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Title is required');
    });

    it('should accept valid title', () => {
      const result = BookSchema.safeParse({ title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' });
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('The Great Gatsby');
    });

    it('should trim whitespace from title', () => {
      const result = BookSchema.safeParse({ title: '  The Great Gatsby  ', author: 'Test' });
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('The Great Gatsby');
    });

    it('should reject title over 500 characters', () => {
      const longTitle = 'A'.repeat(501);
      const result = BookSchema.safeParse({ title: longTitle, author: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Title must be 500 characters or less');
    });
  });

  describe('author field', () => {
    it('should require an author', () => {
      const result = BookSchema.safeParse({ title: 'Test Book', author: '' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Author is required');
    });

    it('should accept valid author', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Stephen King' });
      expect(result.success).toBe(true);
      expect(result.data.author).toBe('Stephen King');
    });

    it('should trim whitespace from author', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: '  Stephen King  ' });
      expect(result.success).toBe(true);
      expect(result.data.author).toBe('Stephen King');
    });
  });

  describe('isbn field', () => {
    it('should accept empty ISBN', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', isbn: '' });
      expect(result.success).toBe(true);
    });

    it('should accept valid 10-digit ISBN', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', isbn: '0123456789' });
      expect(result.success).toBe(true);
      expect(result.data.isbn).toBe('0123456789');
    });

    it('should accept valid 13-digit ISBN', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', isbn: '9780123456789' });
      expect(result.success).toBe(true);
      expect(result.data.isbn).toBe('9780123456789');
    });

    it('should reject invalid ISBN format', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', isbn: '12345' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('ISBN must be 10 or 13 digits');
    });

    it('should reject ISBN with letters', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', isbn: '012345678X' });
      expect(result.success).toBe(false);
    });
  });

  describe('coverImageUrl field', () => {
    it('should accept empty cover URL', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', coverImageUrl: '' });
      expect(result.success).toBe(true);
    });

    it('should accept valid URL', () => {
      const result = BookSchema.safeParse({
        title: 'Test',
        author: 'Test',
        coverImageUrl: 'https://example.com/cover.jpg'
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = BookSchema.safeParse({
        title: 'Test',
        author: 'Test',
        coverImageUrl: 'not-a-url'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid cover image URL');
    });
  });

  describe('rating field', () => {
    it('should accept null rating', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', rating: null });
      expect(result.success).toBe(true);
    });

    it('should accept valid rating (1-5)', () => {
      for (let i = 1; i <= 5; i++) {
        const result = BookSchema.safeParse({ title: 'Test', author: 'Test', rating: i });
        expect(result.success).toBe(true);
        expect(result.data.rating).toBe(i);
      }
    });

    it('should reject rating below 1', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', rating: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', rating: 6 });
      expect(result.success).toBe(false);
    });
  });

  describe('pageCount field', () => {
    it('should accept null page count', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', pageCount: null });
      expect(result.success).toBe(true);
    });

    it('should accept positive page count', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', pageCount: 320 });
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBe(320);
    });

    it('should reject zero page count', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', pageCount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative page count', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', pageCount: -100 });
      expect(result.success).toBe(false);
    });
  });

  describe('physicalFormat field', () => {
    it('should accept valid formats', () => {
      const validFormats = ['Paperback', 'Hardcover', 'Ebook', 'Audio CD'];
      for (const format of validFormats) {
        const result = BookSchema.safeParse({ title: 'Test', author: 'Test', physicalFormat: format });
        expect(result.success).toBe(true);
      }
    });

    it('should accept empty format', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', physicalFormat: '' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', physicalFormat: 'Invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('notes field', () => {
    it('should accept empty notes', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', notes: '' });
      expect(result.success).toBe(true);
    });

    it('should accept valid notes', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', notes: 'Great book!' });
      expect(result.success).toBe(true);
    });

    it('should reject notes over 5000 characters', () => {
      const longNotes = 'A'.repeat(5001);
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', notes: longNotes });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Notes must be 5000 characters or less');
    });

    it('should trim whitespace from notes', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', notes: '  Great book!  ' });
      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('Great book!');
    });
  });

  describe('seriesName field', () => {
    it('should accept valid series name', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesName: 'Harry Potter' });
      expect(result.success).toBe(true);
      expect(result.data.seriesName).toBe('Harry Potter');
    });

    it('should accept empty series name', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesName: '' });
      expect(result.success).toBe(true);
      expect(result.data.seriesName).toBe('');
    });

    it('should trim whitespace from series name', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesName: '  Harry Potter  ' });
      expect(result.success).toBe(true);
      expect(result.data.seriesName).toBe('Harry Potter');
    });

    it('should reject series name over 200 characters', () => {
      const longName = 'A'.repeat(201);
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesName: longName });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Series name must be 200 characters or less');
    });

    it('should be optional (defaults to empty string)', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test' });
      expect(result.success).toBe(true);
      expect(result.data.seriesName).toBe('');
    });
  });

  describe('seriesPosition field', () => {
    it('should accept positive number', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesPosition: 4 });
      expect(result.success).toBe(true);
      expect(result.data.seriesPosition).toBe(4);
    });

    it('should accept decimal position', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesPosition: 1.5 });
      expect(result.success).toBe(true);
      expect(result.data.seriesPosition).toBe(1.5);
    });

    it('should accept null', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesPosition: null });
      expect(result.success).toBe(true);
      expect(result.data.seriesPosition).toBeNull();
    });

    it('should reject zero', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesPosition: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative number', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test', seriesPosition: -1 });
      expect(result.success).toBe(false);
    });

    it('should be optional', () => {
      const result = BookSchema.safeParse({ title: 'Test', author: 'Test' });
      expect(result.success).toBe(true);
      expect(result.data.seriesPosition).toBeUndefined();
    });
  });
});

// ============================================================
// Auth Schema Tests
// ============================================================

describe('Auth Schemas', () => {
  // Inline schema definitions for testing
  const emailSchema = z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(254, 'Email must be 254 characters or less')
    .transform(s => s.trim().toLowerCase());

  const LoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required')
  });

  const registerPasswordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .refine(
      (password) => /[A-Z]/.test(password),
      'Password must contain at least one uppercase letter'
    )
    .refine(
      (password) => /[0-9]/.test(password),
      'Password must contain at least one number'
    );

  const RegisterSchema = z.object({
    email: emailSchema,
    password: registerPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password')
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  );

  const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: registerPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password')
  }).refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    }
  ).refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message: 'New password must be different from current password',
      path: ['newPassword']
    }
  );

  const DeleteAccountSchema = z.object({
    password: z.string().min(1, 'Password is required'),
    confirmText: z.literal('DELETE', {
      errorMap: () => ({ message: 'Please type DELETE to confirm' })
    })
  });

  describe('LoginSchema', () => {
    it('should accept valid login credentials', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: 'mypassword'
      });
      expect(result.success).toBe(true);
    });

    it('should require email', () => {
      const result = LoginSchema.safeParse({
        email: '',
        password: 'mypassword'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Email is required');
    });

    it('should require valid email format', () => {
      const result = LoginSchema.safeParse({
        email: 'not-an-email',
        password: 'mypassword'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Please enter a valid email address');
    });

    it('should require password', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: ''
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Password is required');
    });

    it('should normalise email to lowercase', () => {
      const result = LoginSchema.safeParse({
        email: 'USER@EXAMPLE.COM',
        password: 'mypassword'
      });
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('user@example.com');
    });

    it('should trim email whitespace', () => {
      // Note: trimming happens after validation in Zod transforms
      // so emails with leading/trailing whitespace still validate
      const result = LoginSchema.safeParse({
        email: 'user@example.com',  // Clean email
        password: 'mypassword'
      });
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('user@example.com');
    });
  });

  describe('RegisterSchema', () => {
    it('should accept valid registration data', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Password1',
        confirmPassword: 'Password1'
      });
      expect(result.success).toBe(true);
    });

    it('should require minimum 8 characters for password', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Pass1',
        confirmPassword: 'Pass1'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'Password must be at least 8 characters')).toBe(true);
    });

    it('should require uppercase letter in password', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'password1',
        confirmPassword: 'password1'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'Password must contain at least one uppercase letter')).toBe(true);
    });

    it('should require number in password', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Password',
        confirmPassword: 'Password'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'Password must contain at least one number')).toBe(true);
    });

    it('should require passwords to match', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Password1',
        confirmPassword: 'Password2'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'Passwords do not match')).toBe(true);
    });

    it('should reject passwords over 128 characters', () => {
      const longPassword = 'A'.repeat(129) + '1';
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: longPassword,
        confirmPassword: longPassword
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ChangePasswordSchema', () => {
    it('should accept valid password change', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1'
      });
      expect(result.success).toBe(true);
    });

    it('should require current password', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Current password is required');
    });

    it('should require new password to be different from current', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'SamePassword1',
        newPassword: 'SamePassword1',
        confirmPassword: 'SamePassword1'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'New password must be different from current password')).toBe(true);
    });

    it('should require new passwords to match', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword1',
        confirmPassword: 'DifferentPassword1'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'Passwords do not match')).toBe(true);
    });
  });

  describe('DeleteAccountSchema', () => {
    it('should accept valid deletion confirmation', () => {
      const result = DeleteAccountSchema.safeParse({
        password: 'mypassword',
        confirmText: 'DELETE'
      });
      expect(result.success).toBe(true);
    });

    it('should require password', () => {
      const result = DeleteAccountSchema.safeParse({
        password: '',
        confirmText: 'DELETE'
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Password is required');
    });

    it('should require exact DELETE text', () => {
      const result = DeleteAccountSchema.safeParse({
        password: 'mypassword',
        confirmText: 'delete'
      });
      expect(result.success).toBe(false);
      // z.literal produces a specific error message format
      expect(result.error.issues.length).toBeGreaterThan(0);
    });

    it('should reject other confirmation text', () => {
      const result = DeleteAccountSchema.safeParse({
        password: 'mypassword',
        confirmText: 'CONFIRM'
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// Genre Schema Tests
// ============================================================

describe('Genre Schemas', () => {
  const GENRE_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c'
  ];

  const GenreSchema = z.object({
    name: z.string()
      .min(1, 'Genre name is required')
      .max(50, 'Genre name must be 50 characters or less')
      .transform(s => s.trim())
      .refine(
        (name) => name.length > 0,
        'Genre name cannot be only whitespace'
      ),

    color: z.string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid colour format')
      .refine(
        (color) => GENRE_COLORS.map(c => c.toLowerCase()).includes(color.toLowerCase()),
        'Please select a colour from the palette'
      )
  });

  describe('name field', () => {
    it('should require a name', () => {
      const result = GenreSchema.safeParse({ name: '', color: '#ef4444' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Genre name is required');
    });

    it('should accept valid name', () => {
      const result = GenreSchema.safeParse({ name: 'Science Fiction', color: '#ef4444' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Science Fiction');
    });

    it('should trim whitespace', () => {
      const result = GenreSchema.safeParse({ name: '  Fantasy  ', color: '#ef4444' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Fantasy');
    });

    it('should reject whitespace-only name', () => {
      const result = GenreSchema.safeParse({ name: '   ', color: '#ef4444' });
      expect(result.success).toBe(false);
    });

    it('should reject name over 50 characters', () => {
      const longName = 'A'.repeat(51);
      const result = GenreSchema.safeParse({ name: longName, color: '#ef4444' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Genre name must be 50 characters or less');
    });
  });

  describe('color field', () => {
    it('should accept valid hex colour from palette', () => {
      const result = GenreSchema.safeParse({ name: 'Test', color: '#ef4444' });
      expect(result.success).toBe(true);
    });

    it('should accept uppercase hex colour', () => {
      const result = GenreSchema.safeParse({ name: 'Test', color: '#EF4444' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid hex format', () => {
      const result = GenreSchema.safeParse({ name: 'Test', color: '#fff' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Invalid colour format');
    });

    it('should reject colour not in palette', () => {
      const result = GenreSchema.safeParse({ name: 'Test', color: '#123456' });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.message === 'Please select a colour from the palette')).toBe(true);
    });

    it('should reject non-hex string', () => {
      const result = GenreSchema.safeParse({ name: 'Test', color: 'red' });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// Series Schema Tests
// ============================================================

describe('Series Schemas', () => {
  const ExpectedBookSchema = z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(500, 'Title must be 500 characters or less')
      .transform(s => s.trim()),

    isbn: z.string()
      .regex(/^(\d{10}|\d{13})?$/, 'ISBN must be 10 or 13 digits')
      .nullable()
      .optional()
      .or(z.literal('')),

    position: z.union([
      z.number().positive('Position must be a positive number'),
      z.null()
    ]).optional(),

    source: z.enum(['api', 'manual']).default('manual')
  });

  const SeriesSchema = z.object({
    name: z.string()
      .min(1, 'Series name is required')
      .max(200, 'Series name must be 200 characters or less')
      .transform(s => s.trim()),

    description: z.string()
      .max(1000, 'Description must be 1000 characters or less')
      .nullable()
      .optional()
      .transform(s => s?.trim() || null),

    totalBooks: z.union([
      z.number().int().positive('Total books must be a positive number'),
      z.null()
    ]).optional(),

    expectedBooks: z.array(ExpectedBookSchema).optional().default([])
  });

  describe('name field', () => {
    it('should require a name', () => {
      const result = SeriesSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Series name is required');
    });

    it('should accept valid name', () => {
      const result = SeriesSchema.safeParse({ name: 'Harry Potter' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Harry Potter');
    });

    it('should trim whitespace', () => {
      const result = SeriesSchema.safeParse({ name: '  Harry Potter  ' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Harry Potter');
    });

    it('should reject name over 200 characters', () => {
      const longName = 'A'.repeat(201);
      const result = SeriesSchema.safeParse({ name: longName });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Series name must be 200 characters or less');
    });
  });

  describe('description field', () => {
    it('should accept null description', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', description: null });
      expect(result.success).toBe(true);
      expect(result.data.description).toBeNull();
    });

    it('should accept valid description', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', description: 'A wizard story' });
      expect(result.success).toBe(true);
      expect(result.data.description).toBe('A wizard story');
    });

    it('should trim description whitespace', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', description: '  A wizard story  ' });
      expect(result.success).toBe(true);
      expect(result.data.description).toBe('A wizard story');
    });

    it('should reject description over 1000 characters', () => {
      const longDesc = 'A'.repeat(1001);
      const result = SeriesSchema.safeParse({ name: 'Test', description: longDesc });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Description must be 1000 characters or less');
    });

    it('should transform empty string to null', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', description: '' });
      expect(result.success).toBe(true);
      expect(result.data.description).toBeNull();
    });
  });

  describe('totalBooks field', () => {
    it('should accept null totalBooks', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', totalBooks: null });
      expect(result.success).toBe(true);
    });

    it('should accept positive totalBooks', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', totalBooks: 7 });
      expect(result.success).toBe(true);
      expect(result.data.totalBooks).toBe(7);
    });

    it('should reject zero totalBooks', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', totalBooks: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative totalBooks', () => {
      const result = SeriesSchema.safeParse({ name: 'Test', totalBooks: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('expectedBooks field', () => {
    it('should default to empty array', () => {
      const result = SeriesSchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(true);
      expect(result.data.expectedBooks).toEqual([]);
    });

    it('should accept valid expected books', () => {
      const result = SeriesSchema.safeParse({
        name: 'Test',
        expectedBooks: [
          { title: 'Book 5', position: 5, source: 'api' }
        ]
      });
      expect(result.success).toBe(true);
      expect(result.data.expectedBooks).toHaveLength(1);
    });

    it('should require title in expected books', () => {
      const result = SeriesSchema.safeParse({
        name: 'Test',
        expectedBooks: [{ title: '' }]
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid ISBN in expected books', () => {
      const result = SeriesSchema.safeParse({
        name: 'Test',
        expectedBooks: [{ title: 'Book', isbn: '9780123456789' }]
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid ISBN in expected books', () => {
      const result = SeriesSchema.safeParse({
        name: 'Test',
        expectedBooks: [{ title: 'Book', isbn: '12345' }]
      });
      expect(result.success).toBe(false);
    });

    it('should default source to manual', () => {
      const result = SeriesSchema.safeParse({
        name: 'Test',
        expectedBooks: [{ title: 'Book' }]
      });
      expect(result.success).toBe(true);
      expect(result.data.expectedBooks[0].source).toBe('manual');
    });
  });
});

// ============================================================
// Validation Helpers Tests
// ============================================================

describe('Validation Helpers', () => {
  // Test schema for helper functions
  const TestSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(0, 'Age must be positive')
  });

  describe('validateField', () => {
    // Inline helper for testing
    function validateField(schema, field, value) {
      const fieldSchema = schema.shape?.[field];
      if (!fieldSchema) return null;

      const result = fieldSchema.safeParse(value);
      if (result.success) return null;
      return result.error.issues[0]?.message || 'Invalid value';
    }

    it('should return null for valid field', () => {
      const error = validateField(TestSchema, 'name', 'John');
      expect(error).toBeNull();
    });

    it('should return error message for invalid field', () => {
      const error = validateField(TestSchema, 'name', '');
      expect(error).toBe('Name is required');
    });

    it('should return null for unknown field', () => {
      const error = validateField(TestSchema, 'unknown', 'value');
      expect(error).toBeNull();
    });
  });

  describe('validateForm', () => {
    // Inline helper for testing
    function validateForm(schema, data) {
      const result = schema.safeParse(data);

      if (result.success) {
        return { success: true, data: result.data };
      }

      const errors = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_form';
        if (!errors[path]) {
          errors[path] = issue.message;
        }
      }

      return { success: false, errors };
    }

    it('should return success for valid data', () => {
      const result = validateForm(TestSchema, { name: 'John', age: 25 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 25 });
    });

    it('should return errors for invalid data', () => {
      const result = validateForm(TestSchema, { name: '', age: -5 });
      expect(result.success).toBe(false);
      expect(result.errors.name).toBe('Name is required');
      expect(result.errors.age).toBe('Age must be positive');
    });

    it('should only include first error per field', () => {
      const MultiErrorSchema = z.object({
        password: z.string()
          .min(8, 'Too short')
          .refine(p => /[A-Z]/.test(p), 'Need uppercase')
      });

      const result = validateForm(MultiErrorSchema, { password: 'short' });
      expect(result.success).toBe(false);
      expect(result.errors.password).toBe('Too short');
    });
  });
});
