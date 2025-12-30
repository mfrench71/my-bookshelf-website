// Series Repository - Data access for series collection
// Extends BaseRepository with series-specific operations

import { BaseRepository } from './base-repository.js';
import { normalizeText } from '../utils/format.js';
import type { Series } from '../types/index.d.ts';

/** Extended Series type with bookCount */
interface SeriesWithCount extends Series {
  bookCount?: number;
}

/**
 * Repository for series data access
 * Provides series-specific query methods beyond basic CRUD
 */
class SeriesRepository extends BaseRepository<SeriesWithCount> {
  constructor() {
    super('series');
  }

  /**
   * Find a series by name (case-insensitive via normalized comparison)
   * @param userId - The user's Firebase UID
   * @param name - Series name to search for
   * @returns Series if found, null otherwise
   */
  async findByName(userId: string, name: string): Promise<SeriesWithCount | null> {
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
   * @param userId - The user's Firebase UID
   * @returns Array of series sorted by name
   */
  async getAllSorted(userId: string): Promise<SeriesWithCount[]> {
    return this.getWithOptions(userId, {
      orderByField: 'name',
      orderDirection: 'asc',
    });
  }

  /**
   * Get active series (not soft-deleted)
   * @param userId - The user's Firebase UID
   * @returns Array of active series
   */
  async getActive(userId: string): Promise<SeriesWithCount[]> {
    const series = await this.getAll(userId);
    return series.filter(s => !s.deletedAt);
  }

  /**
   * Get soft-deleted series
   * @param userId - The user's Firebase UID
   * @returns Array of deleted series
   */
  async getDeleted(userId: string): Promise<SeriesWithCount[]> {
    const series = await this.getAll(userId);
    return series.filter(s => s.deletedAt);
  }

  /**
   * Check if a series name exists
   * @param userId - The user's Firebase UID
   * @param name - Name to check
   * @param excludeId - Series ID to exclude (for updates)
   * @returns True if name exists
   */
  async nameExists(userId: string, name: string, excludeId: string | null = null): Promise<boolean> {
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
   * @param userId - The user's Firebase UID
   * @param seriesId - Series ID to soft delete
   */
  async softDelete(userId: string, seriesId: string): Promise<void> {
    await this.update(userId, seriesId, {
      deletedAt: new Date().toISOString(),
    } as Partial<SeriesWithCount>);
  }

  /**
   * Restore a soft-deleted series
   * @param userId - The user's Firebase UID
   * @param seriesId - Series ID to restore
   */
  async restore(userId: string, seriesId: string): Promise<void> {
    await this.update(userId, seriesId, {
      deletedAt: null,
    });
  }

  /**
   * Increment book count for a series
   * @param userId - The user's Firebase UID
   * @param seriesId - Series ID
   * @param increment - Amount to increment (can be negative)
   */
  async incrementBookCount(userId: string, seriesId: string, increment = 1): Promise<void> {
    const series = await this.getById(userId, seriesId);
    if (series) {
      const newCount = Math.max(0, (series.bookCount || 0) + increment);
      await this.update(userId, seriesId, { bookCount: newCount });
    }
  }

  /**
   * Get series by IDs
   * @param userId - The user's Firebase UID
   * @param seriesIds - Array of series IDs
   * @returns Array of series
   */
  async getByIds(userId: string, seriesIds: string[]): Promise<SeriesWithCount[]> {
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
