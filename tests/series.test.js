import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadUserSeries,
  findSeriesByName,
  createSeries,
  updateSeries,
  deleteSeries,
  mergeSeries,
  updateSeriesBookCounts,
  recalculateSeriesBookCounts,
  clearSeriesCache,
  createSeriesLookup,
  addExpectedBook,
  removeExpectedBook,
  findPotentialDuplicates
} from '../src/js/series.js';

// Mock Firebase
vi.mock('../src/js/firebase-config.js', () => ({
  db: {}
}));

// Mock series parser
vi.mock('../src/js/utils/series-parser.js', () => ({
  normalizeSeriesName: (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
}));

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDocs: (...args) => mockGetDocs(...args),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: () => mockWriteBatch(),
  serverTimestamp: vi.fn(() => 'timestamp')
}));

describe('clearSeriesCache', () => {
  it('should clear cache without error', () => {
    expect(() => clearSeriesCache()).not.toThrow();
  });
});

describe('loadUserSeries', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
  });

  it('should fetch series from Firestore', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 3 }) },
        { id: 's2', data: () => ({ name: 'Lord of the Rings', normalizedName: 'lordoftherings', bookCount: 2 }) }
      ]
    });

    const series = await loadUserSeries('user123');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ id: 's1', name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 3 });
    expect(series[1]).toEqual({ id: 's2', name: 'Lord of the Rings', normalizedName: 'lordoftherings', bookCount: 2 });
  });

  it('should return cached series on subsequent calls', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });

    await loadUserSeries('user123');
    await loadUserSeries('user123');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('should fetch fresh data when forceRefresh is true', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });

    await loadUserSeries('user123');
    await loadUserSeries('user123', true);

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('should fetch fresh data for different user', async () => {
    mockGetDocs.mockResolvedValue({
      docs: []
    });

    await loadUserSeries('user123');
    await loadUserSeries('user456');

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('findSeriesByName', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
  });

  it('should find series by normalized name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) },
        { id: 's2', data: () => ({ name: 'Lord of the Rings', normalizedName: 'lordoftherings' }) }
      ]
    });

    const result = await findSeriesByName('user123', 'Harry Potter');

    expect(result).toEqual({ id: 's1', name: 'Harry Potter', normalizedName: 'harrypotter' });
  });

  it('should return null when series not found', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });

    const result = await findSeriesByName('user123', 'Narnia');

    expect(result).toBeNull();
  });

  it('should match case-insensitively', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });

    const result = await findSeriesByName('user123', 'HARRY POTTER');

    expect(result).toEqual({ id: 's1', name: 'Harry Potter', normalizedName: 'harrypotter' });
  });
});

describe('createSeries', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockAddDoc.mockReset();
  });

  it('should create a new series', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'newSeriesId' });

    const series = await createSeries('user123', 'Harry Potter', 'Wizard school adventures');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(series.id).toBe('newSeriesId');
    expect(series.name).toBe('Harry Potter');
    expect(series.description).toBe('Wizard school adventures');
    expect(series.normalizedName).toBe('harrypotter');
  });

  it('should throw error for duplicate name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });

    await expect(createSeries('user123', 'harry potter'))
      .rejects.toThrow('Series "Harry Potter" already exists');
  });

  it('should trim whitespace from name', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'newSeriesId' });

    const series = await createSeries('user123', '  Harry Potter  ');

    expect(series.name).toBe('Harry Potter');
  });

  it('should set totalBooks when provided', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'newSeriesId' });

    const series = await createSeries('user123', 'Harry Potter', null, 7);

    expect(series.totalBooks).toBe(7);
  });

  it('should set null for invalid totalBooks', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'newSeriesId' });

    const series = await createSeries('user123', 'Harry Potter', null, 0);

    expect(series.totalBooks).toBeNull();
  });
});

describe('updateSeries', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('should update series name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateSeries('user123', 's1', { name: 'HP Series' });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('HP Series');
    expect(result.normalizedName).toBe('hpseries');
  });

  it('should update description', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateSeries('user123', 's1', { description: 'Wizard school' });

    expect(result.description).toBe('Wizard school');
  });

  it('should update totalBooks', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateSeries('user123', 's1', { totalBooks: 7 });

    expect(result.totalBooks).toBe(7);
  });

  it('should update expectedBooks', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter', expectedBooks: [] }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    const expectedBooks = [{ title: 'Book 5', position: 5 }];
    const result = await updateSeries('user123', 's1', { expectedBooks });

    expect(result.expectedBooks).toEqual(expectedBooks);
  });

  it('should throw error for duplicate name when renaming', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) },
        { id: 's2', data: () => ({ name: 'Narnia', normalizedName: 'narnia' }) }
      ]
    });

    await expect(updateSeries('user123', 's1', { name: 'Narnia' }))
      .rejects.toThrow('Series "Narnia" already exists');
  });

  it('should allow keeping same name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    await expect(updateSeries('user123', 's1', { name: 'Harry Potter' }))
      .resolves.not.toThrow();
  });
});

describe('deleteSeries', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockWriteBatch.mockReset();
  });

  it('should delete series and unlink books', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ seriesId: 's1' }) },
        { id: 'book2', data: () => ({ seriesId: 's1' }) }
      ]
    });

    const count = await deleteSeries('user123', 's1');

    expect(count).toBe(2);
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('should return 0 when no books in series', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const count = await deleteSeries('user123', 's1');

    expect(count).toBe(0);
    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.delete).toHaveBeenCalledTimes(1);
  });
});

describe('mergeSeries', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockWriteBatch.mockReset();
  });

  it('should throw error when merging series into itself', async () => {
    await expect(mergeSeries('user123', 's1', 's1'))
      .rejects.toThrow('Cannot merge a series into itself');
  });

  it('should throw error when source series not found', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's2', data: () => ({ name: 'Target', normalizedName: 'target' }) }
      ]
    });

    await expect(mergeSeries('user123', 's1', 's2'))
      .rejects.toThrow('Source series not found');
  });

  it('should throw error when target series not found', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Source', normalizedName: 'source' }) }
      ]
    });

    await expect(mergeSeries('user123', 's1', 's2'))
      .rejects.toThrow('Target series not found');
  });

  it('should merge series and update books', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    // Load series
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'HP Books', normalizedName: 'hpbooks', bookCount: 2, expectedBooks: [] }) },
        { id: 's2', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 1, expectedBooks: [] }) }
      ]
    });

    // Load books with source series
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ seriesId: 's1' }) },
        { id: 'book2', data: () => ({ seriesId: 's1' }) }
      ]
    });

    const result = await mergeSeries('user123', 's1', 's2');

    expect(result.booksUpdated).toBe(2);
    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('should merge expectedBooks arrays', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    // Load series with expected books
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'HP Books',
            normalizedName: 'hpbooks',
            bookCount: 0,
            expectedBooks: [{ title: 'Book 5', isbn: '123' }]
          })
        },
        {
          id: 's2',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            bookCount: 0,
            expectedBooks: [{ title: 'Book 6', isbn: '456' }]
          })
        }
      ]
    });

    // No books to update
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const result = await mergeSeries('user123', 's1', 's2');

    expect(result.expectedBooksMerged).toBe(1); // 1 new expected book added
  });

  it('should not duplicate expected books by ISBN', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'HP Books',
            normalizedName: 'hpbooks',
            bookCount: 0,
            expectedBooks: [{ title: 'Book 5', isbn: '123' }]
          })
        },
        {
          id: 's2',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            bookCount: 0,
            expectedBooks: [{ title: 'Order of Phoenix', isbn: '123' }] // Same ISBN
          })
        }
      ]
    });

    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const result = await mergeSeries('user123', 's1', 's2');

    expect(result.expectedBooksMerged).toBe(0); // Duplicate not added
  });
});

describe('updateSeriesBookCounts', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockWriteBatch.mockReset();
  });

  it('should do nothing when no series IDs provided', async () => {
    await updateSeriesBookCounts('user123');

    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('should increment count for added series', async () => {
    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 3 }) }
      ]
    });

    await updateSeriesBookCounts('user123', 's1', null);

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('should decrement count for removed series', async () => {
    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 3 }) }
      ]
    });

    await updateSeriesBookCounts('user123', null, 's1');

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('should not decrement below zero', async () => {
    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 0 }) }
      ]
    });

    await updateSeriesBookCounts('user123', null, 's1');

    // Should still call update but with 0
    expect(mockBatch.update).toHaveBeenCalled();
  });
});

describe('recalculateSeriesBookCounts', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockWriteBatch.mockReset();
  });

  it('should return no changes when counts are correct', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ seriesId: 's1' }) },
        { id: 'book2', data: () => ({ seriesId: 's1' }) }
      ]
    });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', bookCount: 2 }) }
      ]
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateSeriesBookCounts('user123');

    expect(results.seriesUpdated).toBe(0);
    expect(results.totalBooks).toBe(2);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('should update counts when incorrect', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ seriesId: 's1' }) },
        { id: 'book2', data: () => ({ seriesId: 's1' }) },
        { id: 'book3', data: () => ({ seriesId: 's2' }) }
      ]
    });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', bookCount: 0 }) },
        { id: 's2', data: () => ({ name: 'Narnia', bookCount: 0 }) }
      ]
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateSeriesBookCounts('user123');

    expect(results.seriesUpdated).toBe(2);
    expect(results.totalBooks).toBe(3);
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('should handle books without series', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ seriesId: null }) },
        { id: 'book2', data: () => ({}) }
      ]
    });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 's1', data: () => ({ name: 'Harry Potter', bookCount: 0 }) }
      ]
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateSeriesBookCounts('user123');

    expect(results.seriesUpdated).toBe(0);
    expect(results.totalBooks).toBe(2);
  });
});

describe('createSeriesLookup', () => {
  it('should return empty map for empty series', () => {
    const result = createSeriesLookup([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('should create map with series IDs as keys', () => {
    const series = [
      { id: 's1', name: 'Harry Potter' },
      { id: 's2', name: 'Narnia' }
    ];
    const result = createSeriesLookup(series);
    expect(result.size).toBe(2);
    expect(result.get('s1')).toEqual(series[0]);
    expect(result.get('s2')).toEqual(series[1]);
  });

  it('should return undefined for non-existent IDs', () => {
    const series = [
      { id: 's1', name: 'Harry Potter' }
    ];
    const result = createSeriesLookup(series);
    expect(result.get('nonexistent')).toBeUndefined();
  });
});

describe('addExpectedBook', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('should throw error when series not found', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await expect(addExpectedBook('user123', 's1', { title: 'Book 5' }))
      .rejects.toThrow('Series not found');
  });

  it('should throw error for duplicate by ISBN', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: [{ title: 'Existing Book', isbn: '123' }]
          })
        }
      ]
    });

    await expect(addExpectedBook('user123', 's1', { title: 'New Book', isbn: '123' }))
      .rejects.toThrow('Book already exists in expected books');
  });

  it('should throw error for duplicate by title', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: [{ title: 'Order of the Phoenix' }]
          })
        }
      ]
    });

    await expect(addExpectedBook('user123', 's1', { title: 'ORDER OF THE PHOENIX' }))
      .rejects.toThrow('Book already exists in expected books');
  });

  it('should add expected book with position', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: []
          })
        }
      ]
    });
    // Second call for updateSeries
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: []
          })
        }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    await addExpectedBook('user123', 's1', { title: 'Book 5', position: 5 });

    expect(mockUpdateDoc).toHaveBeenCalled();
  });
});

describe('removeExpectedBook', () => {
  beforeEach(() => {
    clearSeriesCache();
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('should throw error when series not found', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await expect(removeExpectedBook('user123', 's1', 0))
      .rejects.toThrow('Series not found');
  });

  it('should throw error for invalid index', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: [{ title: 'Book 1' }]
          })
        }
      ]
    });

    await expect(removeExpectedBook('user123', 's1', 5))
      .rejects.toThrow('Invalid book index');
  });

  it('should remove expected book at index', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: [{ title: 'Book 1' }, { title: 'Book 2' }]
          })
        }
      ]
    });
    // Second call for updateSeries
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          data: () => ({
            name: 'Harry Potter',
            normalizedName: 'harrypotter',
            expectedBooks: [{ title: 'Book 1' }, { title: 'Book 2' }]
          })
        }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    await removeExpectedBook('user123', 's1', 0);

    expect(mockUpdateDoc).toHaveBeenCalled();
  });
});

describe('findPotentialDuplicates', () => {
  it('should return empty array for empty series', () => {
    const result = findPotentialDuplicates([]);
    expect(result).toEqual([]);
  });

  it('should return empty array when no duplicates', () => {
    const series = [
      { id: 's1', name: 'Harry Potter' },
      { id: 's2', name: 'Narnia' },
      { id: 's3', name: 'Lord of the Rings' }
    ];
    const result = findPotentialDuplicates(series);
    expect(result).toEqual([]);
  });

  it('should find exact matches after normalization', () => {
    const series = [
      { id: 's1', name: 'Harry Potter' },
      { id: 's2', name: 'harry potter' }
    ];
    const result = findPotentialDuplicates(series);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('should find series with common suffixes', () => {
    const series = [
      { id: 's1', name: 'Harry Potter' },
      { id: 's2', name: 'Harry Potter Series' }
    ];
    const result = findPotentialDuplicates(series);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('should find series where one contains the other', () => {
    const series = [
      { id: 's1', name: 'HP' },
      { id: 's2', name: 'HP Saga' }
    ];
    const result = findPotentialDuplicates(series);
    expect(result).toHaveLength(1);
  });

  it('should group multiple potential duplicates together', () => {
    const series = [
      { id: 's1', name: 'Harry Potter' },
      { id: 's2', name: 'harry potter' },
      { id: 's3', name: 'Harry Potter Series' }
    ];
    const result = findPotentialDuplicates(series);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(3);
  });
});
