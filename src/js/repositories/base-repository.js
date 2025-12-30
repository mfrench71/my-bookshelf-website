// Base Repository - Common CRUD operations for Firestore collections
// Provides abstraction layer between page scripts and Firebase

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';

/**
 * Base repository providing common CRUD operations for user-scoped collections
 * All collections are stored under /users/{userId}/{collectionName}
 */
export class BaseRepository {
  /**
   * @param {string} collectionName - Name of the Firestore collection (e.g., 'books', 'genres')
   */
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  /**
   * Get reference to user's collection
   * @param {string} userId - The user's Firebase UID
   * @returns {CollectionReference} Firestore collection reference
   */
  getCollectionRef(userId) {
    return collection(db, 'users', userId, this.collectionName);
  }

  /**
   * Get reference to a specific document
   * @param {string} userId - The user's Firebase UID
   * @param {string} docId - The document ID
   * @returns {DocumentReference} Firestore document reference
   */
  getDocRef(userId, docId) {
    return doc(db, 'users', userId, this.collectionName, docId);
  }

  /**
   * Get all documents in the collection
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of documents with id included
   */
  async getAll(userId) {
    const collectionRef = this.getCollectionRef(userId);
    const snapshot = await getDocs(collectionRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get a single document by ID
   * @param {string} userId - The user's Firebase UID
   * @param {string} docId - The document ID
   * @returns {Promise<Object|null>} Document data with id, or null if not found
   */
  async getById(userId, docId) {
    const docRef = this.getDocRef(userId, docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() };
  }

  /**
   * Create a new document
   * @param {string} userId - The user's Firebase UID
   * @param {Object} data - Document data (without id)
   * @returns {Promise<Object>} Created document with id
   */
  async create(userId, data) {
    const collectionRef = this.getCollectionRef(userId);
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collectionRef, docData);
    return { id: docRef.id, ...docData };
  }

  /**
   * Update an existing document
   * @param {string} userId - The user's Firebase UID
   * @param {string} docId - The document ID
   * @param {Object} data - Fields to update
   * @returns {Promise<void>}
   */
  async update(userId, docId, data) {
    const docRef = this.getDocRef(userId, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Delete a document
   * @param {string} userId - The user's Firebase UID
   * @param {string} docId - The document ID
   * @returns {Promise<void>}
   */
  async delete(userId, docId) {
    const docRef = this.getDocRef(userId, docId);
    await deleteDoc(docRef);
  }

  /**
   * Query documents with a where clause
   * @param {string} userId - The user's Firebase UID
   * @param {string} field - Field to query
   * @param {string} operator - Query operator ('==', '!=', '<', '<=', '>', '>=', 'array-contains', etc.)
   * @param {*} value - Value to compare
   * @returns {Promise<Array<Object>>} Array of matching documents
   */
  async queryByField(userId, field, operator, value) {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where(field, operator, value));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get documents with ordering and limit
   * @param {string} userId - The user's Firebase UID
   * @param {Object} options - Query options
   * @param {string} [options.orderByField] - Field to order by
   * @param {string} [options.orderDirection='asc'] - 'asc' or 'desc'
   * @param {number} [options.limitCount] - Maximum documents to return
   * @returns {Promise<Array<Object>>} Array of documents
   */
  async getWithOptions(userId, options = {}) {
    const { orderByField, orderDirection = 'asc', limitCount } = options;
    const collectionRef = this.getCollectionRef(userId);

    const constraints = [];
    if (orderByField) {
      constraints.push(orderBy(orderByField, orderDirection));
    }
    if (limitCount) {
      constraints.push(limit(limitCount));
    }

    const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
