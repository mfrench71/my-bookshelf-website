// Genre Repository - Data access for genres collection
// Extends BaseRepository with genre-specific operations

import { query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { BaseRepository } from './base-repository.js';

/**
 * Repository for genre data access
 * Provides genre-specific query methods beyond basic CRUD
 */
class GenreRepository extends BaseRepository {
  constructor() {
    super('genres');
  }

  /**
   * Get a genre by its normalized name
   * @param {string} userId - The user's Firebase UID
   * @param {string} normalizedName - Normalized genre name to search for
   * @returns {Promise<Object|null>} Genre if found, null otherwise
   */
  async getByNormalizedName(userId, normalizedName) {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('normalizedName', '==', normalizedName));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Get all genres sorted by name
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of genres sorted by name
   */
  async getAllSorted(userId) {
    return this.getWithOptions(userId, {
      orderByField: 'name',
      orderDirection: 'asc',
    });
  }

  /**
   * Check if a genre name exists (case-insensitive via normalized name)
   * @param {string} userId - The user's Firebase UID
   * @param {string} normalizedName - Normalized name to check
   * @param {string} [excludeId] - Genre ID to exclude (for updates)
   * @returns {Promise<boolean>} True if name exists
   */
  async nameExists(userId, normalizedName, excludeId = null) {
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
   * @param {string} userId - The user's Firebase UID
   * @param {Array<string>} genreIds - Array of genre IDs
   * @returns {Promise<Array<Object>>} Array of genres
   */
  async getByIds(userId, genreIds) {
    if (!genreIds || genreIds.length === 0) {
      return [];
    }

    const genres = await this.getAll(userId);
    return genres.filter(g => genreIds.includes(g.id));
  }

  /**
   * Increment book count for a genre
   * @param {string} userId - The user's Firebase UID
   * @param {string} genreId - Genre ID
   * @param {number} [increment=1] - Amount to increment (can be negative)
   * @returns {Promise<void>}
   */
  async incrementBookCount(userId, genreId, increment = 1) {
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
