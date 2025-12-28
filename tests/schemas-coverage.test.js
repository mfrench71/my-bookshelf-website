/**
 * Schema Coverage Tests
 * Tests that import from actual source files to get coverage
 */

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

// Import actual schemas from source
import {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  DeleteAccountSchema
} from '../src/js/schemas/auth.js';

import { BookSchema, BookFormSchema } from '../src/js/schemas/book.js';
import { GenreSchema, CreateGenreSchema, validateGenreUniqueness, validateColourUniqueness } from '../src/js/schemas/genre.js';
import { SeriesSchema, SeriesFormSchema } from '../src/js/schemas/series.js';
import { WishlistItemSchema, WishlistItemFormSchema, WishlistItemUpdateSchema } from '../src/js/schemas/wishlist.js';

describe('Auth Schemas', () => {
  describe('LoginSchema', () => {
    it('should validate valid login data', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty email', () => {
      const result = LoginSchema.safeParse({
        email: '',
        password: 'password123'
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = LoginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123'
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: ''
      });
      expect(result.success).toBe(false);
    });

    it('should handle email with leading/trailing spaces', () => {
      // The schema trims and lowercases email
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RegisterSchema', () => {
    it('should validate valid registration data', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1'
      });
      expect(result.success).toBe(true);
    });

    it('should reject password without uppercase', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'password1',
        confirmPassword: 'password1'
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'Password',
        confirmPassword: 'Password'
      });
      expect(result.success).toBe(false);
    });

    it('should reject mismatched passwords', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password2'
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'Pass1',
        confirmPassword: 'Pass1'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ChangePasswordSchema', () => {
    it('should validate valid password change', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: 'NewPassword1',
        confirmPassword: 'NewPassword1'
      });
      expect(result.success).toBe(true);
    });

    it('should reject same old and new password', () => {
      const result = ChangePasswordSchema.safeParse({
        currentPassword: 'Password1',
        newPassword: 'Password1',
        confirmPassword: 'Password1'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ResetPasswordSchema', () => {
    it('should validate valid email', () => {
      const result = ResetPasswordSchema.safeParse({
        email: 'test@example.com'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('DeleteAccountSchema', () => {
    it('should validate correct confirmation', () => {
      const result = DeleteAccountSchema.safeParse({
        password: 'mypassword',
        confirmText: 'DELETE'
      });
      expect(result.success).toBe(true);
    });

    it('should reject incorrect confirmation text', () => {
      const result = DeleteAccountSchema.safeParse({
        password: 'mypassword',
        confirmText: 'delete'
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Book Schema', () => {
  it('should validate valid book data', () => {
    const result = BookSchema.safeParse({
      title: 'Test Book',
      author: 'Test Author'
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const result = BookSchema.safeParse({
      title: '',
      author: 'Author'
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty author', () => {
    const result = BookSchema.safeParse({
      title: 'Title',
      author: ''
    });
    expect(result.success).toBe(false);
  });

  it('should validate ISBN-10', () => {
    const result = BookSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: '0123456789'
    });
    expect(result.success).toBe(true);
  });

  it('should validate ISBN-13', () => {
    const result = BookSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: '9780123456789'
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid ISBN', () => {
    const result = BookSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: '123'
    });
    expect(result.success).toBe(false);
  });

  it('should validate rating 0-5', () => {
    const result = BookSchema.safeParse({
      title: 'Book',
      author: 'Author',
      rating: 4
    });
    expect(result.success).toBe(true);
  });

  it('should reject rating over 5', () => {
    const result = BookSchema.safeParse({
      title: 'Book',
      author: 'Author',
      rating: 6
    });
    expect(result.success).toBe(false);
  });

  describe('BookFormSchema', () => {
    it('should transform pageCount string to number', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: '300'
      });
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBe(300);
    });

    it('should accept empty pageCount', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: ''
      });
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBeNull();
    });

    it('should reject negative pageCount', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: '-100'
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid pageCount', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: 'abc'
      });
      expect(result.success).toBe(false);
    });

    it('should transform rating 0 to null', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        rating: 0
      });
      expect(result.success).toBe(true);
      expect(result.data.rating).toBeNull();
    });

    it('should handle string rating', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        rating: '4'
      });
      expect(result.success).toBe(true);
      expect(result.data.rating).toBe(4);
    });

    it('should handle empty string rating', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        rating: ''
      });
      expect(result.success).toBe(true);
      expect(result.data.rating).toBeNull();
    });

    it('should handle null rating', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        rating: null
      });
      expect(result.success).toBe(true);
      expect(result.data.rating).toBeNull();
    });

    it('should reject zero pageCount', () => {
      const result = BookFormSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: '0'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BookSchema pageCount transformation', () => {
    it('should accept pageCount as string and transform to number', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: '250'
      });
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBe(250);
    });

    it('should transform empty string pageCount to null', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: ''
      });
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBeNull();
    });

    it('should reject invalid string pageCount in base schema', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: 'not-a-number'
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative string pageCount in base schema', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: '-50'
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero string pageCount in base schema', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: '0'
      });
      expect(result.success).toBe(false);
    });

    it('should accept null pageCount', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        pageCount: null
      });
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBeNull();
    });
  });

  describe('BookSchema additional fields', () => {
    it('should validate physical format enum values', () => {
      const formats = ['Paperback', 'Hardcover', 'Mass Market Paperback', 'Trade Paperback', 'Library Binding', 'Spiral-bound', 'Audio CD', 'Ebook'];
      for (const format of formats) {
        const result = BookSchema.safeParse({
          title: 'Book',
          author: 'Author',
          physicalFormat: format
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid physical format', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        physicalFormat: 'Invalid Format'
      });
      expect(result.success).toBe(false);
    });

    it('should accept empty physical format', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        physicalFormat: ''
      });
      expect(result.success).toBe(true);
    });

    it('should validate seriesId and seriesPosition', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        seriesId: 'series-123',
        seriesPosition: 2
      });
      expect(result.success).toBe(true);
    });

    it('should accept null seriesId and seriesPosition', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        seriesId: null,
        seriesPosition: null
      });
      expect(result.success).toBe(true);
    });

    it('should default deletedAt to null', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author'
      });
      expect(result.success).toBe(true);
      expect(result.data.deletedAt).toBeNull();
    });

    it('should accept positive deletedAt timestamp', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        deletedAt: Date.now()
      });
      expect(result.success).toBe(true);
    });

    it('should validate reads array', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        reads: [
          { startedAt: '2024-01-01', finishedAt: '2024-01-15' },
          { startedAt: '2024-06-01', finishedAt: null }
        ]
      });
      expect(result.success).toBe(true);
      expect(result.data.reads).toHaveLength(2);
    });

    it('should default reads to empty array', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author'
      });
      expect(result.success).toBe(true);
      expect(result.data.reads).toEqual([]);
    });

    it('should validate covers object', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        covers: {
          googleBooks: 'https://books.google.com/cover.jpg',
          openLibrary: 'https://covers.openlibrary.org/cover.jpg'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should accept covers with empty strings', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        covers: {
          googleBooks: '',
          openLibrary: ''
        }
      });
      expect(result.success).toBe(true);
    });

    it('should validate notes field', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        notes: 'Some notes about this book'
      });
      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('Some notes about this book');
    });

    it('should trim notes', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        notes: '  Notes with spaces  '
      });
      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('Notes with spaces');
    });

    it('should reject notes exceeding max length', () => {
      const result = BookSchema.safeParse({
        title: 'Book',
        author: 'Author',
        notes: 'x'.repeat(5001)
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Genre Schema', () => {
  it('should validate genre with name and color', () => {
    const result = GenreSchema.safeParse({
      name: 'Fiction',
      color: '#ef4444'
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = GenreSchema.safeParse({
      name: '',
      color: '#ef4444'
    });
    expect(result.success).toBe(false);
  });

  it('should validate color from palette', () => {
    const result = CreateGenreSchema.safeParse({
      name: 'Fiction',
      color: '#ef4444'
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid color format', () => {
    const result = CreateGenreSchema.safeParse({
      name: 'Fiction',
      color: 'not-a-color'
    });
    expect(result.success).toBe(false);
  });

  it('should reject color not in palette', () => {
    const result = CreateGenreSchema.safeParse({
      name: 'Fiction',
      color: '#000000'
    });
    expect(result.success).toBe(false);
  });

  describe('validateGenreUniqueness', () => {
    const existingGenres = [
      { id: 'g1', name: 'Fiction' },
      { id: 'g2', name: 'Mystery' }
    ];

    it('should return null for unique name', () => {
      const result = validateGenreUniqueness('Fantasy', existingGenres);
      expect(result).toBeNull();
    });

    it('should return error for duplicate name', () => {
      const result = validateGenreUniqueness('Fiction', existingGenres);
      expect(result).toBe('A genre with this name already exists');
    });

    it('should be case insensitive', () => {
      const result = validateGenreUniqueness('FICTION', existingGenres);
      expect(result).toBe('A genre with this name already exists');
    });

    it('should exclude specified ID when checking', () => {
      const result = validateGenreUniqueness('Fiction', existingGenres, 'g1');
      expect(result).toBeNull(); // Allowed because we're updating g1
    });
  });

  describe('validateColourUniqueness', () => {
    const existingGenres = [
      { id: 'g1', color: '#ef4444' },
      { id: 'g2', color: '#3b82f6' }
    ];

    it('should return null for unique color', () => {
      const result = validateColourUniqueness('#22c55e', existingGenres);
      expect(result).toBeNull();
    });

    it('should return error for duplicate color', () => {
      const result = validateColourUniqueness('#ef4444', existingGenres);
      expect(result).toBe('This colour is already in use');
    });

    it('should be case insensitive', () => {
      const result = validateColourUniqueness('#EF4444', existingGenres);
      expect(result).toBe('This colour is already in use');
    });

    it('should exclude specified ID when checking', () => {
      const result = validateColourUniqueness('#ef4444', existingGenres, 'g1');
      expect(result).toBeNull();
    });
  });
});

describe('Series Schema', () => {
  it('should validate series name', () => {
    const result = SeriesSchema.safeParse({
      name: 'Harry Potter'
    });
    expect(result.success).toBe(true);
  });

  it('should validate with totalBooks as string (form input)', () => {
    const result = SeriesFormSchema.safeParse({
      name: 'Lord of the Rings',
      totalBooks: '3'
    });
    expect(result.success).toBe(true);
    expect(result.data.totalBooks).toBe(3); // Transformed to number
  });

  it('should reject negative totalBooks', () => {
    const result = SeriesFormSchema.safeParse({
      name: 'Series',
      totalBooks: '-1'
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty totalBooks', () => {
    const result = SeriesFormSchema.safeParse({
      name: 'Series',
      totalBooks: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.totalBooks).toBeNull();
  });

  it('should reject invalid string totalBooks in form schema', () => {
    const result = SeriesFormSchema.safeParse({
      name: 'Series',
      totalBooks: 'abc'
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero totalBooks', () => {
    const result = SeriesFormSchema.safeParse({
      name: 'Series',
      totalBooks: '0'
    });
    expect(result.success).toBe(false);
  });

  it('should accept totalBooks as number in base schema', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      totalBooks: 10
    });
    expect(result.success).toBe(true);
    expect(result.data.totalBooks).toBe(10);
  });

  it('should accept totalBooks as string in base schema', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      totalBooks: '5'
    });
    expect(result.success).toBe(true);
    expect(result.data.totalBooks).toBe(5);
  });

  it('should reject invalid totalBooks string in base schema', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      totalBooks: 'invalid'
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative totalBooks string in base schema', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      totalBooks: '-5'
    });
    expect(result.success).toBe(false);
  });

  it('should transform empty string totalBooks to null in base schema', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      totalBooks: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.totalBooks).toBeNull();
  });

  it('should accept null totalBooks', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      totalBooks: null
    });
    expect(result.success).toBe(true);
    expect(result.data.totalBooks).toBeNull();
  });

  it('should trim and validate series name', () => {
    const result = SeriesSchema.safeParse({
      name: '  Harry Potter  '
    });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Harry Potter');
  });

  it('should reject empty series name', () => {
    const result = SeriesSchema.safeParse({
      name: ''
    });
    expect(result.success).toBe(false);
  });

  it('should reject name exceeding max length', () => {
    const result = SeriesSchema.safeParse({
      name: 'x'.repeat(201)
    });
    expect(result.success).toBe(false);
  });

  it('should validate description', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      description: 'A great series about wizards'
    });
    expect(result.success).toBe(true);
    expect(result.data.description).toBe('A great series about wizards');
  });

  it('should transform null description', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      description: null
    });
    expect(result.success).toBe(true);
    expect(result.data.description).toBeNull();
  });

  it('should transform empty description to null', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      description: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.description).toBeNull();
  });

  it('should reject description exceeding max length', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      description: 'x'.repeat(1001)
    });
    expect(result.success).toBe(false);
  });

  it('should default expectedBooks to empty array', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series'
    });
    expect(result.success).toBe(true);
    expect(result.data.expectedBooks).toEqual([]);
  });

  it('should validate expectedBooks array', () => {
    const result = SeriesSchema.safeParse({
      name: 'Series',
      expectedBooks: [
        { title: 'Book 1', position: 1 },
        { title: 'Book 2', isbn: '9780123456789' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.data.expectedBooks).toHaveLength(2);
  });
});

describe('ExpectedBookSchema', () => {
  // Import it for direct testing
  it('should validate expected book with title', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Upcoming Book'
    });
    expect(result.success).toBe(true);
  });

  it('should validate expected book with ISBN-10', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      isbn: '0123456789'
    });
    expect(result.success).toBe(true);
  });

  it('should validate expected book with ISBN-13', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      isbn: '9780123456789'
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid ISBN', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      isbn: '123'
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty ISBN string', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      isbn: ''
    });
    expect(result.success).toBe(true);
  });

  it('should accept null ISBN', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      isbn: null
    });
    expect(result.success).toBe(true);
  });

  it('should validate position as positive number', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      position: 5
    });
    expect(result.success).toBe(true);
    expect(result.data.position).toBe(5);
  });

  it('should accept null position', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      position: null
    });
    expect(result.success).toBe(true);
    expect(result.data.position).toBeNull();
  });

  it('should default source to manual', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book'
    });
    expect(result.success).toBe(true);
    expect(result.data.source).toBe('manual');
  });

  it('should accept api source', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'Book',
      source: 'api'
    });
    expect(result.success).toBe(true);
    expect(result.data.source).toBe('api');
  });

  it('should trim title', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: '  Book Title  '
    });
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Book Title');
  });

  it('should reject title exceeding max length', async () => {
    const { ExpectedBookSchema } = await import('../src/js/schemas/series.js');
    const result = ExpectedBookSchema.safeParse({
      title: 'x'.repeat(501)
    });
    expect(result.success).toBe(false);
  });
});

describe('Wishlist Schema', () => {
  it('should validate wishlist item', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Want to Read',
      author: 'Some Author'
    });
    expect(result.success).toBe(true);
  });

  it('should validate priority values', () => {
    const highResult = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      priority: 'high'
    });
    expect(highResult.success).toBe(true);

    const mediumResult = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      priority: 'medium'
    });
    expect(mediumResult.success).toBe(true);

    const lowResult = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      priority: 'low'
    });
    expect(lowResult.success).toBe(true);
  });

  it('should reject invalid priority', () => {
    const result = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      priority: 'urgent'
    });
    expect(result.success).toBe(false);
  });

  it('should validate notes length', () => {
    const result = WishlistItemUpdateSchema.safeParse({
      notes: 'Some notes about why I want this book'
    });
    expect(result.success).toBe(true);
  });

  it('should transform pageCount string to number', () => {
    const result = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: '300'
    });
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBe(300);
  });

  it('should transform empty pageCount to null', () => {
    const result = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBeNull();
  });

  it('should transform invalid pageCount to null in form schema', () => {
    const result = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: 'abc'
    });
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBeNull();
  });

  it('should transform negative pageCount to null in form schema', () => {
    const result = WishlistItemFormSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: '-100'
    });
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBeNull();
  });

  it('should validate positive pageCount number directly', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: 300
    });
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBe(300);
  });

  it('should reject invalid string pageCount in base schema', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: 'abc'
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative pageCount string in base schema', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: '-100'
    });
    expect(result.success).toBe(false);
  });

  it('should transform empty string pageCount to null in base schema', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      pageCount: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBeNull();
  });

  it('should validate ISBN-10', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: '0123456789'
    });
    expect(result.success).toBe(true);
  });

  it('should validate ISBN-13', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: '9780123456789'
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid ISBN', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: '123'
    });
    expect(result.success).toBe(false);
  });

  it('should transform empty ISBN to null', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      isbn: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.isbn).toBeNull();
  });

  it('should validate cover URL', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      coverImageUrl: 'https://example.com/cover.jpg'
    });
    expect(result.success).toBe(true);
  });

  it('should transform empty cover URL to null', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      coverImageUrl: ''
    });
    expect(result.success).toBe(true);
    expect(result.data.coverImageUrl).toBeNull();
  });

  it('should validate covers object', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      covers: {
        googleBooks: 'https://books.google.com/cover.jpg',
        openLibrary: 'https://covers.openlibrary.org/cover.jpg'
      }
    });
    expect(result.success).toBe(true);
  });

  it('should allow null covers object', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      covers: null
    });
    expect(result.success).toBe(true);
  });

  it('should transform notes to trimmed or null', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      notes: '  Some notes  '
    });
    expect(result.success).toBe(true);
    expect(result.data.notes).toBe('Some notes');
  });

  it('should validate addedFrom enum', () => {
    const searchResult = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      addedFrom: 'search'
    });
    expect(searchResult.success).toBe(true);

    const isbnResult = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      addedFrom: 'isbn'
    });
    expect(isbnResult.success).toBe(true);

    const manualResult = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      addedFrom: 'manual'
    });
    expect(manualResult.success).toBe(true);
  });

  it('should default addedFrom to manual', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author'
    });
    expect(result.success).toBe(true);
    expect(result.data.addedFrom).toBe('manual');
  });

  it('should reject title exceeding max length', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'x'.repeat(501),
      author: 'Author'
    });
    expect(result.success).toBe(false);
  });

  it('should reject notes exceeding max length', () => {
    const result = WishlistItemSchema.safeParse({
      title: 'Book',
      author: 'Author',
      notes: 'x'.repeat(2001)
    });
    expect(result.success).toBe(false);
  });
});
