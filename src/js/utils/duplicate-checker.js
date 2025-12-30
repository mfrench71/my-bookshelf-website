// Duplicate Checker - Check for duplicate books by ISBN or title/author

import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';
import { normalizeText } from './format.js';

// Max books to check for title/author duplicates (prevents excessive reads on large libraries)
export const DUPLICATE_CHECK_LIMIT = 200;

/**
 * Check if a string looks like an ISBN (10 or 13 digits, with optional dashes/spaces)
 * Also handles common formats like "ISBN: 978-0-123456-78-9" or "ISBN-13: 9780123456789"
 * @param {string} input - The input to check
 * @returns {boolean} True if input matches ISBN pattern
 */
export function isISBN(input) {
  if (!input) return false;
  // Remove ISBN prefix, dashes, spaces, and colons
  const cleaned = input.replace(/^isbn[-:\s]*(10|13)?[-:\s]*/i, '').replace(/[-\s]/g, '');
  return /^\d{10}$/.test(cleaned) || /^\d{13}$/.test(cleaned);
}

/**
 * Clean an ISBN string by removing prefix, dashes, spaces
 * @param {string} input - The ISBN input
 * @returns {string} Clean ISBN digits only
 */
export function cleanISBN(input) {
  if (!input) return '';
  return input.replace(/^isbn[-:\s]*(10|13)?[-:\s]*/i, '').replace(/[-\s]/g, '');
}

/**
 * Check if a book with the same ISBN or title/author already exists
 * @param {string} userId - The user's ID
 * @param {string} isbn - ISBN to check (optional)
 * @param {string} title - Title to check
 * @param {string} author - Author to check
 * @returns {Promise<{isDuplicate: boolean, matchType: string, existingBook: Object|null}>}
 */
export async function checkForDuplicate(userId, isbn, title, author) {
  const booksRef = collection(db, 'users', userId, 'books');

  // Check by ISBN first (most reliable - uses indexed query)
  if (isbn) {
    const isbnQuery = query(booksRef, where('isbn', '==', isbn), limit(1));
    const isbnSnapshot = await getDocs(isbnQuery);
    if (!isbnSnapshot.empty) {
      const existingBook = { id: isbnSnapshot.docs[0].id, ...isbnSnapshot.docs[0].data() };
      return { isDuplicate: true, matchType: 'isbn', existingBook };
    }
  }

  // Check by normalized title + author (limited to prevent excessive reads)
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);

  // Fetch limited books and check client-side (Firestore doesn't support case-insensitive queries)
  const limitedQuery = query(booksRef, limit(DUPLICATE_CHECK_LIMIT));
  const booksSnapshot = await getDocs(limitedQuery);
  for (const doc of booksSnapshot.docs) {
    const bookData = doc.data();
    const bookNormalizedTitle = normalizeText(bookData.title || '');
    const bookNormalizedAuthor = normalizeText(bookData.author || '');

    if (bookNormalizedTitle === normalizedTitle && bookNormalizedAuthor === normalizedAuthor) {
      return { isDuplicate: true, matchType: 'title-author', existingBook: { id: doc.id, ...bookData } };
    }
  }

  return { isDuplicate: false, matchType: null, existingBook: null };
}
