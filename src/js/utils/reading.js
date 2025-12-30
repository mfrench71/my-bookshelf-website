// Reading Utilities - Reading status and book reads management

/**
 * Migrate a book from old startedAt/finishedAt/status format to reads array
 * @param {Object} book - Book object (may have old or new format)
 * @returns {Object} Book with reads array
 */
export function migrateBookReads(book) {
  // Already migrated
  if (Array.isArray(book.reads)) {
    return book;
  }

  const reads = [];

  // Convert old format to new reads array
  if (book.startedAt || book.finishedAt) {
    reads.push({
      startedAt: book.startedAt || null,
      finishedAt: book.finishedAt || null,
    });
  }

  // Return book with reads array (don't modify original)
  const { startedAt: _startedAt, finishedAt: _finishedAt, status: _status, ...rest } = book;
  return { ...rest, reads };
}

/**
 * Get the current read entry (last in reads array)
 * @param {Object} book - Book with reads array
 * @returns {Object|null} Current read entry or null
 */
export function getCurrentRead(book) {
  const migrated = migrateBookReads(book);
  if (!migrated.reads || migrated.reads.length === 0) {
    return null;
  }
  return migrated.reads[migrated.reads.length - 1];
}

/**
 * Infer reading status from book's reads array
 * @param {Object} book - Book object (can be old or new format)
 * @returns {string|null} 'reading', 'finished', or null (unread)
 */
export function getBookStatus(book) {
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
