import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GENRE_COLORS,
  getUsedColors,
  getAvailableColors,
  createGenreLookup,
  clearGenresCache,
  loadUserGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  recalculateGenreBookCounts
} from '../src/js/genres.js';

// Mock Firebase
vi.mock('../src/js/firebase-config.js', () => ({
  db: {}
}));

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: (...args) => mockGetDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: () => mockWriteBatch(),
  serverTimestamp: vi.fn(() => 'timestamp')
}));

describe('GENRE_COLORS', () => {
  it('should be an array of colors', () => {
    expect(Array.isArray(GENRE_COLORS)).toBe(true);
    expect(GENRE_COLORS.length).toBeGreaterThan(0);
  });

  it('should contain valid hex colors', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    GENRE_COLORS.forEach(color => {
      expect(color).toMatch(hexPattern);
    });
  });

  it('should have at least 60 colors', () => {
    expect(GENRE_COLORS.length).toBeGreaterThanOrEqual(60);
  });

  it('should not have duplicate colors', () => {
    const uniqueColors = new Set(GENRE_COLORS.map(c => c.toLowerCase()));
    expect(uniqueColors.size).toBe(GENRE_COLORS.length);
  });
});

describe('getUsedColors', () => {
  it('should return empty set for empty genres', () => {
    const result = getUsedColors([]);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return set of used colors', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: '#FF0000' },
      { id: '2', name: 'Mystery', color: '#00FF00' }
    ];
    const result = getUsedColors(genres);
    expect(result.size).toBe(2);
    expect(result.has('#ff0000')).toBe(true);
    expect(result.has('#00ff00')).toBe(true);
  });

  it('should exclude specified genre ID', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: '#FF0000' },
      { id: '2', name: 'Mystery', color: '#00FF00' }
    ];
    const result = getUsedColors(genres, '1');
    expect(result.size).toBe(1);
    expect(result.has('#ff0000')).toBe(false);
    expect(result.has('#00ff00')).toBe(true);
  });

  it('should handle genres without color', () => {
    const genres = [
      { id: '1', name: 'Fiction' },
      { id: '2', name: 'Mystery', color: '#00FF00' }
    ];
    const result = getUsedColors(genres);
    expect(result.size).toBe(2);
    expect(result.has(undefined)).toBe(true);
    expect(result.has('#00ff00')).toBe(true);
  });

  it('should normalize colors to lowercase', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: '#AABBCC' }
    ];
    const result = getUsedColors(genres);
    expect(result.has('#aabbcc')).toBe(true);
    expect(result.has('#AABBCC')).toBe(false);
  });
});

describe('getAvailableColors', () => {
  it('should return all colors when no genres exist', () => {
    const result = getAvailableColors([]);
    expect(result).toEqual(GENRE_COLORS);
  });

  it('should exclude used colors', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: GENRE_COLORS[0] }
    ];
    const result = getAvailableColors(genres);
    expect(result.length).toBe(GENRE_COLORS.length - 1);
    expect(result).not.toContain(GENRE_COLORS[0]);
  });

  it('should exclude multiple used colors', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: GENRE_COLORS[0] },
      { id: '2', name: 'Mystery', color: GENRE_COLORS[1] },
      { id: '3', name: 'Romance', color: GENRE_COLORS[2] }
    ];
    const result = getAvailableColors(genres);
    expect(result.length).toBe(GENRE_COLORS.length - 3);
  });

  it('should include color of excluded genre', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: GENRE_COLORS[0] },
      { id: '2', name: 'Mystery', color: GENRE_COLORS[1] }
    ];
    const result = getAvailableColors(genres, '1');
    expect(result).toContain(GENRE_COLORS[0]);
    expect(result).not.toContain(GENRE_COLORS[1]);
  });

  it('should handle case-insensitive color matching', () => {
    const genres = [
      { id: '1', name: 'Fiction', color: GENRE_COLORS[0].toUpperCase() }
    ];
    const result = getAvailableColors(genres);
    expect(result).not.toContain(GENRE_COLORS[0]);
  });
});

describe('createGenreLookup', () => {
  it('should return empty map for empty genres', () => {
    const result = createGenreLookup([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('should create map with genre IDs as keys', () => {
    const genres = [
      { id: 'genre1', name: 'Fiction', color: '#FF0000' },
      { id: 'genre2', name: 'Mystery', color: '#00FF00' }
    ];
    const result = createGenreLookup(genres);
    expect(result.size).toBe(2);
    expect(result.get('genre1')).toEqual(genres[0]);
    expect(result.get('genre2')).toEqual(genres[1]);
  });

  it('should return undefined for non-existent IDs', () => {
    const genres = [
      { id: 'genre1', name: 'Fiction', color: '#FF0000' }
    ];
    const result = createGenreLookup(genres);
    expect(result.get('nonexistent')).toBeUndefined();
  });
});

describe('clearGenresCache', () => {
  it('should clear cache without error', () => {
    expect(() => clearGenresCache()).not.toThrow();
  });
});

describe('loadUserGenres', () => {
  beforeEach(() => {
    clearGenresCache();
    mockGetDocs.mockReset();
  });

  it('should fetch genres from Firestore', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', color: '#FF0000' }) },
        { id: 'g2', data: () => ({ name: 'Mystery', color: '#00FF00' }) }
      ]
    });

    const genres = await loadUserGenres('user123');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(genres).toHaveLength(2);
    expect(genres[0]).toEqual({ id: 'g1', name: 'Fiction', color: '#FF0000' });
    expect(genres[1]).toEqual({ id: 'g2', name: 'Mystery', color: '#00FF00' });
  });

  it('should return cached genres on subsequent calls', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', color: '#FF0000' }) }
      ]
    });

    await loadUserGenres('user123');
    await loadUserGenres('user123');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('should fetch fresh data when forceRefresh is true', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', color: '#FF0000' }) }
      ]
    });

    await loadUserGenres('user123');
    await loadUserGenres('user123', true);

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('should fetch fresh data for different user', async () => {
    mockGetDocs.mockResolvedValue({
      docs: []
    });

    await loadUserGenres('user123');
    await loadUserGenres('user456');

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('createGenre', () => {
  beforeEach(() => {
    clearGenresCache();
    mockGetDocs.mockReset();
    mockAddDoc.mockReset();
  });

  it('should create a new genre', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'newGenreId' });

    const genre = await createGenre('user123', 'Science Fiction', '#FF0000');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(genre.id).toBe('newGenreId');
    expect(genre.name).toBe('Science Fiction');
    expect(genre.color).toBe('#FF0000');
  });

  it('should throw error for duplicate name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Science Fiction', normalizedName: 'science fiction', color: '#00FF00' }) }
      ]
    });

    await expect(createGenre('user123', 'science fiction', '#FF0000'))
      .rejects.toThrow('Genre "Science Fiction" already exists');
  });

  it('should throw error for duplicate color', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Mystery', normalizedName: 'mystery', color: '#ff0000' }) }
      ]
    });

    await expect(createGenre('user123', 'Science Fiction', '#FF0000'))
      .rejects.toThrow('This color is already used by another genre');
  });

  it('should auto-assign color if not provided', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'newGenreId' });

    const genre = await createGenre('user123', 'Science Fiction');

    expect(genre.color).toBe(GENRE_COLORS[0]);
  });

  it('should auto-assign next available color', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: GENRE_COLORS[0] }) }
      ]
    });
    mockAddDoc.mockResolvedValueOnce({ id: 'newGenreId' });

    const genre = await createGenre('user123', 'Mystery');

    expect(genre.color).toBe(GENRE_COLORS[1]);
  });
});

describe('updateGenre', () => {
  beforeEach(() => {
    clearGenresCache();
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
  });

  it('should update genre name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: '#FF0000' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateGenre('user123', 'g1', { name: 'Science Fiction' });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Science Fiction');
  });

  it('should update genre color', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: '#FF0000' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateGenre('user123', 'g1', { color: '#00FF00' });

    expect(result.color).toBe('#00FF00');
  });

  it('should throw error for duplicate name when renaming', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: '#FF0000' }) },
        { id: 'g2', data: () => ({ name: 'Mystery', normalizedName: 'mystery', color: '#00FF00' }) }
      ]
    });

    await expect(updateGenre('user123', 'g1', { name: 'Mystery' }))
      .rejects.toThrow('Genre "Mystery" already exists');
  });

  it('should throw error for duplicate color when changing', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: '#FF0000' }) },
        { id: 'g2', data: () => ({ name: 'Mystery', normalizedName: 'mystery', color: '#00ff00' }) }
      ]
    });

    await expect(updateGenre('user123', 'g1', { color: '#00FF00' }))
      .rejects.toThrow('This color is already used by another genre');
  });

  it('should allow keeping same name', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: '#FF0000' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    await expect(updateGenre('user123', 'g1', { name: 'Fiction' }))
      .resolves.not.toThrow();
  });

  it('should allow keeping same color', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Fiction', normalizedName: 'fiction', color: '#FF0000' }) }
      ]
    });
    mockUpdateDoc.mockResolvedValueOnce();

    await expect(updateGenre('user123', 'g1', { color: '#FF0000' }))
      .resolves.not.toThrow();
  });
});

describe('deleteGenre', () => {
  beforeEach(() => {
    clearGenresCache();
    mockGetDocs.mockReset();
    mockWriteBatch.mockReset();
  });

  it('should delete genre and return count of updated books', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ genres: ['g1', 'g2'] }) },
        { id: 'book2', data: () => ({ genres: ['g1'] }) }
      ]
    });

    const count = await deleteGenre('user123', 'g1');

    expect(count).toBe(2);
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('should return 0 when no books have the genre', async () => {
    const mockBatch = {
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const count = await deleteGenre('user123', 'g1');

    expect(count).toBe(0);
    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.delete).toHaveBeenCalledTimes(1);
  });
});

describe('recalculateGenreBookCounts', () => {
  beforeEach(() => {
    clearGenresCache();
    mockGetDocs.mockReset();
    mockWriteBatch.mockReset();
  });

  it('should return no changes when counts are already correct', async () => {
    // Load books
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ genres: ['genreId1'] }) },
        { id: 'book2', data: () => ({ genres: ['genreId1', 'genreId2'] }) }
      ]
    });
    // Load genres (counts already correct)
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'genreId1', data: () => ({ name: 'Fiction', bookCount: 2 }) },
        { id: 'genreId2', data: () => ({ name: 'Mystery', bookCount: 1 }) }
      ]
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateGenreBookCounts('user123');

    expect(results.genresUpdated).toBe(0);
    expect(results.totalBooks).toBe(2);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('should update counts when they are incorrect', async () => {
    // Load books
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ genres: ['genreId1'] }) },
        { id: 'book2', data: () => ({ genres: ['genreId1'] }) },
        { id: 'book3', data: () => ({ genres: ['genreId2'] }) }
      ]
    });
    // Load genres (counts are wrong)
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'genreId1', data: () => ({ name: 'Fiction', bookCount: 0 }) },
        { id: 'genreId2', data: () => ({ name: 'Mystery', bookCount: 0 }) }
      ]
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateGenreBookCounts('user123');

    expect(results.genresUpdated).toBe(2);
    expect(results.totalBooks).toBe(3);
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('should handle books with no genres', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ genres: [] }) },
        { id: 'book2', data: () => ({}) }
      ]
    });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'genreId1', data: () => ({ name: 'Fiction', bookCount: 0 }) }
      ]
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateGenreBookCounts('user123');

    expect(results.genresUpdated).toBe(0);
    expect(results.totalBooks).toBe(2);
  });

  it('should handle empty genre list', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'book1', data: () => ({ genres: ['unknownGenre'] }) }
      ]
    });
    mockGetDocs.mockResolvedValueOnce({
      docs: []
    });

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const results = await recalculateGenreBookCounts('user123');

    expect(results.genresUpdated).toBe(0);
    expect(results.totalBooks).toBe(1);
  });
});
