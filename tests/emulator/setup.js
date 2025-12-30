// Firebase Emulator Integration Test Setup
// Run emulator first: npx firebase emulators:start

import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Emulator configuration
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

let app = null;
let db = null;
let auth = null;

/**
 * Initialize Firebase Admin for emulator testing
 * @returns {{ app: FirebaseApp, db: Firestore, auth: Auth }}
 */
export function initializeEmulator() {
  // Set emulator environment variables
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;

  // Initialize admin app
  app = initializeApp({
    projectId: 'book-tracker-b786e',
  });

  db = getFirestore(app);
  auth = getAuth(app);

  return { app, db, auth };
}

/**
 * Clean up Firebase Admin app
 */
export async function cleanupEmulator() {
  if (app) {
    await deleteApp(app);
    app = null;
    db = null;
    auth = null;
  }
}

/**
 * Create a test user in the emulator
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserRecord>}
 */
export async function createTestUser(email = 'test@example.com', password = 'testpass123') {
  try {
    // Try to get existing user
    const existingUser = await auth.getUserByEmail(email);
    return existingUser;
  } catch {
    // Create new user if doesn't exist
    return auth.createUser({
      email,
      password,
      displayName: 'Test User',
    });
  }
}

/**
 * Delete a test user from the emulator
 * @param {string} uid
 */
export async function deleteTestUser(uid) {
  try {
    await auth.deleteUser(uid);
  } catch {
    // User might not exist
  }
}

/**
 * Clear all data for a user (books, genres, series)
 * @param {string} userId
 */
export async function clearUserData(userId) {
  const collections = ['books', 'genres', 'series', 'bin', 'wishlist'];

  for (const collectionName of collections) {
    const collectionRef = db.collection('users').doc(userId).collection(collectionName);
    const snapshot = await collectionRef.get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

/**
 * Create a test book
 * @param {string} userId
 * @param {Object} bookData
 * @returns {Promise<string>} Book ID
 */
export async function createTestBook(userId, bookData = {}) {
  const defaultBook = {
    title: 'Test Book',
    author: 'Test Author',
    isbn: '9780123456789',
    status: 'to-read',
    genres: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...bookData,
  };

  const docRef = await db.collection('users').doc(userId).collection('books').add(defaultBook);
  return docRef.id;
}

/**
 * Create a test genre
 * @param {string} userId
 * @param {Object} genreData
 * @returns {Promise<string>} Genre ID
 */
export async function createTestGenre(userId, genreData = {}) {
  const defaultGenre = {
    name: 'Test Genre',
    color: '#3b82f6',
    bookCount: 0,
    ...genreData,
  };

  const docRef = await db.collection('users').doc(userId).collection('genres').add(defaultGenre);
  return docRef.id;
}

/**
 * Create a test series
 * @param {string} userId
 * @param {Object} seriesData
 * @returns {Promise<string>} Series ID
 */
export async function createTestSeries(userId, seriesData = {}) {
  const defaultSeries = {
    name: 'Test Series',
    bookCount: 0,
    expectedBooks: null,
    ...seriesData,
  };

  const docRef = await db.collection('users').doc(userId).collection('series').add(defaultSeries);
  return docRef.id;
}

/**
 * Get a book by ID
 * @param {string} userId
 * @param {string} bookId
 * @returns {Promise<Object|null>}
 */
export async function getBook(userId, bookId) {
  const doc = await db.collection('users').doc(userId).collection('books').doc(bookId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Get all books for a user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getAllBooks(userId) {
  const snapshot = await db.collection('users').doc(userId).collection('books').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all genres for a user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getAllGenres(userId) {
  const snapshot = await db.collection('users').doc(userId).collection('genres').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all series for a user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getAllSeries(userId) {
  const snapshot = await db.collection('users').doc(userId).collection('series').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update a book
 * @param {string} userId
 * @param {string} bookId
 * @param {Object} updates
 */
export async function updateBook(userId, bookId, updates) {
  await db
    .collection('users')
    .doc(userId)
    .collection('books')
    .doc(bookId)
    .update({
      ...updates,
      updatedAt: new Date(),
    });
}

/**
 * Delete a book
 * @param {string} userId
 * @param {string} bookId
 */
export async function deleteBook(userId, bookId) {
  await db.collection('users').doc(userId).collection('books').doc(bookId).delete();
}

/**
 * Move a book to bin
 * @param {string} userId
 * @param {string} bookId
 */
export async function moveBookToBin(userId, bookId) {
  const bookDoc = await db.collection('users').doc(userId).collection('books').doc(bookId).get();

  if (bookDoc.exists) {
    const bookData = bookDoc.data();
    await db
      .collection('users')
      .doc(userId)
      .collection('bin')
      .doc(bookId)
      .set({
        ...bookData,
        deletedAt: new Date(),
      });
    await deleteBook(userId, bookId);
  }
}

/**
 * Restore a book from bin
 * @param {string} userId
 * @param {string} bookId
 */
export async function restoreBookFromBin(userId, bookId) {
  const binDoc = await db.collection('users').doc(userId).collection('bin').doc(bookId).get();

  if (binDoc.exists) {
    const bookData = binDoc.data();
    delete bookData.deletedAt;
    await db.collection('users').doc(userId).collection('books').doc(bookId).set(bookData);
    await db.collection('users').doc(userId).collection('bin').doc(bookId).delete();
  }
}

export { db, auth };
