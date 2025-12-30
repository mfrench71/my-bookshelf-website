// Base Repository - Common CRUD operations for Firestore collections
// Provides abstraction layer between page scripts and Firebase

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';

import type { BaseEntity, PaginatedResult } from '../types/index.d.ts';

// Type aliases for Firestore types (avoid importing from firebase/firestore at runtime)
type CollectionReference = ReturnType<typeof collection>;
type DocumentReference = ReturnType<typeof doc>;
type DocumentSnapshot = Awaited<ReturnType<typeof getDoc>>;
type QueryConstraint = ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit>;
type WhereFilterOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'array-contains-any' | 'in' | 'not-in';

/** Options for getWithOptions method */
export interface GetWithOptions {
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
}

/** Options for getPaginated method */
export interface PaginationOptions {
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
  afterDoc?: DocumentSnapshot | null;
  fromServer?: boolean;
}

/**
 * Base repository providing common CRUD operations for user-scoped collections
 * All collections are stored under /users/{userId}/{collectionName}
 */
export class BaseRepository<T extends BaseEntity = BaseEntity> {
  protected collectionName: string;

  /**
   * @param collectionName - Name of the Firestore collection (e.g., 'books', 'genres')
   */
  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  /**
   * Get reference to user's collection
   * @param userId - The user's Firebase UID
   * @returns Firestore collection reference
   */
  getCollectionRef(userId: string): CollectionReference {
    return collection(db, 'users', userId, this.collectionName);
  }

  /**
   * Get reference to a specific document
   * @param userId - The user's Firebase UID
   * @param docId - The document ID
   * @returns Firestore document reference
   */
  getDocRef(userId: string, docId: string): DocumentReference {
    return doc(db, 'users', userId, this.collectionName, docId);
  }

  /**
   * Get all documents in the collection
   * @param userId - The user's Firebase UID
   * @returns Array of documents with id included
   */
  async getAll(userId: string): Promise<T[]> {
    const collectionRef = this.getCollectionRef(userId);
    const snapshot = await getDocs(collectionRef);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as T);
  }

  /**
   * Get a single document by ID
   * @param userId - The user's Firebase UID
   * @param docId - The document ID
   * @returns Document data with id, or null if not found
   */
  async getById(userId: string, docId: string): Promise<T | null> {
    const docRef = this.getDocRef(userId, docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as T;
  }

  /**
   * Create a new document
   * @param userId - The user's Firebase UID
   * @param data - Document data (without id)
   * @returns Created document with id
   */
  async create(userId: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const collectionRef = this.getCollectionRef(userId);
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collectionRef, docData);
    return { id: docRef.id, ...docData } as T;
  }

  /**
   * Update an existing document
   * @param userId - The user's Firebase UID
   * @param docId - The document ID
   * @param data - Fields to update
   */
  async update(userId: string, docId: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = this.getDocRef(userId, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Delete a document
   * @param userId - The user's Firebase UID
   * @param docId - The document ID
   */
  async delete(userId: string, docId: string): Promise<void> {
    const docRef = this.getDocRef(userId, docId);
    await deleteDoc(docRef);
  }

  /**
   * Query documents with a where clause
   * @param userId - The user's Firebase UID
   * @param field - Field to query
   * @param operator - Query operator ('==', '!=', '<', '<=', '>', '>=', 'array-contains', etc.)
   * @param value - Value to compare
   * @returns Array of matching documents
   */
  async queryByField(userId: string, field: string, operator: WhereFilterOp, value: unknown): Promise<T[]> {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where(field, operator, value));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as T);
  }

  /**
   * Get documents with ordering and limit
   * @param userId - The user's Firebase UID
   * @param options - Query options
   * @returns Array of documents
   */
  async getWithOptions(userId: string, options: GetWithOptions = {}): Promise<T[]> {
    const { orderByField, orderDirection = 'asc', limitCount } = options;
    const collectionRef = this.getCollectionRef(userId);

    const constraints: QueryConstraint[] = [];
    if (orderByField) {
      constraints.push(orderBy(orderByField, orderDirection));
    }
    if (limitCount) {
      constraints.push(limit(limitCount));
    }

    const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as T);
  }

  /**
   * Get paginated documents with cursor support
   * @param userId - The user's Firebase UID
   * @param options - Pagination options
   * @returns Paginated result with docs, lastDoc cursor, and hasMore flag
   */
  async getPaginated(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    const {
      orderByField = 'createdAt',
      orderDirection = 'desc',
      limitCount = 20,
      afterDoc = null,
      fromServer = false,
    } = options;

    const collectionRef = this.getCollectionRef(userId);
    const constraints: QueryConstraint[] = [orderBy(orderByField, orderDirection)];

    if (afterDoc) {
      constraints.push(startAfter(afterDoc));
    }
    constraints.push(limit(limitCount));

    const q = query(collectionRef, ...constraints);
    const snapshot = fromServer ? await getDocsFromServer(q) : await getDocs(q);

    const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as T);
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    return {
      docs,
      lastDoc,
      hasMore: snapshot.docs.length === limitCount,
    };
  }
}
