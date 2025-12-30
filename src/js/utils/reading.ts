// Reading Utilities - Reading status and book reads management

/** Single read entry */
interface ReadEntry {
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
}

/** Book with old format (legacy) */
interface LegacyBook {
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
  status?: string;
  [key: string]: unknown;
}

/** Book with new reads array format */
interface BookWithReads {
  reads: ReadEntry[];
  [key: string]: unknown;
}

/** Book that may be old or new format */
type Book = LegacyBook | BookWithReads;

/** Reading status type */
type ReadingStatus = 'reading' | 'finished' | null;

/**
 * Migrate a book from old startedAt/finishedAt/status format to reads array
 * @param book - Book object (may have old or new format)
 * @returns Book with reads array
 */
export function migrateBookReads(book: Book): BookWithReads {
  // Already migrated
  if ('reads' in book && Array.isArray(book.reads)) {
    return book as BookWithReads;
  }

  const reads: ReadEntry[] = [];
  const legacyBook = book as LegacyBook;

  // Convert old format to new reads array
  if (legacyBook.startedAt || legacyBook.finishedAt) {
    reads.push({
      startedAt: legacyBook.startedAt || null,
      finishedAt: legacyBook.finishedAt || null,
    });
  }

  // Return book with reads array (don't modify original)
  const { startedAt: _startedAt, finishedAt: _finishedAt, status: _status, ...rest } = legacyBook;
  return { ...rest, reads };
}

/**
 * Get the current read entry (last in reads array)
 * @param book - Book with reads array
 * @returns Current read entry or null
 */
export function getCurrentRead(book: Book): ReadEntry | null {
  const migrated = migrateBookReads(book);
  if (!migrated.reads || migrated.reads.length === 0) {
    return null;
  }
  return migrated.reads[migrated.reads.length - 1];
}

/**
 * Infer reading status from book's reads array
 * @param book - Book object (can be old or new format)
 * @returns 'reading', 'finished', or null (unread)
 */
export function getBookStatus(book: Book): ReadingStatus {
  const currentRead = getCurrentRead(book);

  if (!currentRead) {
    return null; // No reads = unread
  }

  if (currentRead.startedAt && currentRead.finishedAt) {
    return 'finished';
  }

  if (currentRead.startedAt) {
    return 'reading';
  }

  return null; // Has read entry but no dates = unread
}
