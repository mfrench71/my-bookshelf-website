// Genre Repository - Data access for genres collection
// Extends BaseRepository with genre-specific operations

import { query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { BaseRepository } from './base-repository.js';
import type { Genre } from '../types/index.d.ts';

/** Extended Genre type with bookCount */
interface GenreWithCount extends Genre {
  normalizedName?: string;
  bookCount?: number;
}

/**
 * Repository for genre data access
 * Provides genre-specific query methods beyond basic CRUD
 */
class GenreRepository extends BaseRepository<GenreWithCount> {
  constructor() {
    super('genres');
  }

  /**
   * Get a genre by its normalized name
   * @param userId - The user's Firebase UID
   * @param normalizedName - Normalized genre name to search for
   * @returns Genre if found, null otherwise
   */
  async getByNormalizedName(userId: string, normalizedName: string): Promise<GenreWithCount | null> {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('normalizedName', '==', normalizedName));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as GenreWithCount;
  }

  /**
   * Get all genres sorted by name
   * @param userId - The user's Firebase UID
   * @returns Array of genres sorted by name
   */
  async getAllSorted(userId: string): Promise<GenreWithCount[]> {
    return this.getWithOptions(userId, {
      orderByField: 'name',
      orderDirection: 'asc',
    });
  }

  /**
   * Check if a genre name exists (case-insensitive via normalized name)
   * @param userId - The user's Firebase UID
   * @param normalizedName - Normalized name to check
   * @param excludeId - Genre ID to exclude (for updates)
   * @returns True if name exists
   */
  async nameExists(userId: string, normalizedName: string, excludeId: string | null = null): Promise<boolean> {
    const existing = await this.getByNormalizedName(userId, normalizedName);
    if (!existing) {
      return false;
    }
    if (excludeId && existing.id === excludeId) {
      return false;
    }
    return true;
  }

  /**
   * Get genres by IDs
   * @param userId - The user's Firebase UID
   * @param genreIds - Array of genre IDs
   * @returns Array of genres
   */
  async getByIds(userId: string, genreIds: string[]): Promise<GenreWithCount[]> {
    if (!genreIds || genreIds.length === 0) {
      return [];
    }

    const genres = await this.getAll(userId);
    return genres.filter(g => genreIds.includes(g.id));
  }

  /**
   * Increment book count for a genre
   * @param userId - The user's Firebase UID
   * @param genreId - Genre ID
   * @param increment - Amount to increment (can be negative)
   */
  async incrementBookCount(userId: string, genreId: string, increment = 1): Promise<void> {
    const genre = await this.getById(userId, genreId);
    if (genre) {
      const newCount = Math.max(0, (genre.bookCount || 0) + increment);
      await this.update(userId, genreId, { bookCount: newCount });
    }
  }
}

// Export singleton instance
export const genreRepository = new GenreRepository();

// Also export class for testing
export { GenreRepository };
