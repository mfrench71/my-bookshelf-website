// Series Repository - Data access for series collection
// Extends BaseRepository with series-specific operations

import { BaseRepository } from './base-repository.js';
import { normalizeText } from '../utils/format.js';

/**
 * Repository for series data access
 * Provides series-specific query methods beyond basic CRUD
 */
class SeriesRepository extends BaseRepository {
  constructor() {
    super('series');
  }

  /**
   * Find a series by name (case-insensitive via normalized comparison)
   * @param {string} userId - The user's Firebase UID
   * @param {string} name - Series name to search for
   * @returns {Promise<Object|null>} Series if found, null otherwise
   */
  async findByName(userId, name) {
    const normalizedSearch = normalizeText(name);
    const allSeries = await this.getAll(userId);

    return (
      allSeries.find(s => {
        const normalizedName = normalizeText(s.name || '');
        return normalizedName === normalizedSearch;
      }) || null
    );
  }

  /**
   * Get all series sorted by name
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of series sorted by name
   */
  async getAllSorted(userId) {
    return this.getWithOptions(userId, {
      orderByField: 'name',
      orderDirection: 'asc',
    });
  }

  /**
   * Get active series (not soft-deleted)
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of active series
   */
  async getActive(userId) {
    const series = await this.getAll(userId);
    return series.filter(s => !s.deletedAt);
  }

  /**
   * Get soft-deleted series
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of deleted series
   */
  async getDeleted(userId) {
    const series = await this.getAll(userId);
    return series.filter(s => s.deletedAt);
  }

  /**
   * Check if a series name exists
   * @param {string} userId - The user's Firebase UID
   * @param {string} name - Name to check
   * @param {string} [excludeId] - Series ID to exclude (for updates)
   * @returns {Promise<boolean>} True if name exists
   */
  async nameExists(userId, name, excludeId = null) {
    const existing = await this.findByName(userId, name);
    if (!existing) {
      return false;
    }
    if (excludeId && existing.id === excludeId) {
      return false;
    }
    return true;
  }

  /**
   * Soft delete a series
   * @param {string} userId - The user's Firebase UID
   * @param {string} seriesId - Series ID to soft delete
   * @returns {Promise<void>}
   */
  async softDelete(userId, seriesId) {
    await this.update(userId, seriesId, {
      deletedAt: new Date().toISOString(),
    });
  }

  /**
   * Restore a soft-deleted series
   * @param {string} userId - The user's Firebase UID
   * @param {string} seriesId - Series ID to restore
   * @returns {Promise<void>}
   */
  async restore(userId, seriesId) {
    await this.update(userId, seriesId, {
      deletedAt: null,
    });
  }

  /**
   * Increment book count for a series
   * @param {string} userId - The user's Firebase UID
   * @param {string} seriesId - Series ID
   * @param {number} [increment=1] - Amount to increment (can be negative)
   * @returns {Promise<void>}
   */
  async incrementBookCount(userId, seriesId, increment = 1) {
    const series = await this.getById(userId, seriesId);
    if (series) {
      const newCount = Math.max(0, (series.bookCount || 0) + increment);
      await this.update(userId, seriesId, { bookCount: newCount });
    }
  }

  /**
   * Get series by IDs
   * @param {string} userId - The user's Firebase UID
   * @param {Array<string>} seriesIds - Array of series IDs
   * @returns {Promise<Array<Object>>} Array of series
   */
  async getByIds(userId, seriesIds) {
    if (!seriesIds || seriesIds.length === 0) {
      return [];
    }

    const allSeries = await this.getAll(userId);
    return allSeries.filter(s => seriesIds.includes(s.id));
  }
}

// Export singleton instance
export const seriesRepository = new SeriesRepository();

// Also export class for testing
export { SeriesRepository };
