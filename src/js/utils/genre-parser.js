// Genre Parser Utilities - Parse and normalize genre names from APIs

/**
 * Common genre variation mappings
 * Maps informal/abbreviated forms to standard forms
 * NOTE: Only maps synonyms/abbreviations, NOT subgenres to parent genres
 * (to preserve specificity - "Space Opera" stays as "Space Opera", not "Science Fiction")
 */
const GENRE_VARIATIONS = {
  // Abbreviations
  'sci-fi': 'Science Fiction',
  'scifi': 'Science Fiction',
  'sf': 'Science Fiction',
  'ya': 'Young Adult',
  'lit fic': 'Literary Fiction',
  'lit-fic': 'Literary Fiction',
  'rom-com': 'Romantic Comedy',
  'romcom': 'Romantic Comedy',

  // British/American spelling normalization (prefer British per CLAUDE.md)
  'humor': 'Humour',

  // Synonyms and variations
  'nonfiction': 'Non-Fiction',
  'non fiction': 'Non-Fiction',
  'non-fiction': 'Non-Fiction',
  'whodunit': 'Mystery',
  'whodunnit': 'Mystery',
  'literary': 'Literary Fiction',
  'general fiction': 'Fiction',

  // Children/Young Adult variations
  'juvenile fiction': 'Children',
  'juvenile': 'Children',
  "children's": 'Children',
  'teen': 'Young Adult',
  'teens': 'Young Adult',
  'adolescent': 'Young Adult',
  'young adult fiction': 'Young Adult',
  'ya fiction': 'Young Adult'
};

/**
 * Normalize a genre name using variation mapping
 * Returns the canonical form if found, otherwise original (trimmed)
 * @param {string} name - Genre name to normalize
 * @returns {string} Normalized genre name
 */
export function normalizeGenreVariation(name) {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  return GENRE_VARIATIONS[lower] || name.trim();
}

/**
 * Parse hierarchical genre strings into individual genres
 * Splits on: " / ", " - ", " > ", " — " (with spaces around separators)
 *
 * Examples:
 * - "Fiction / Science Fiction / Space Opera" → ["Fiction", "Science Fiction", "Space Opera"]
 * - "Young Adult - Fantasy" → ["Young Adult", "Fantasy"]
 * - "Mystery > Cozy Mystery" → ["Mystery", "Cozy Mystery"]
 * - "Thriller" → ["Thriller"] (no change)
 * - "Sci-Fi" → ["Science Fiction"] (no space around hyphen, so not split)
 *
 * @param {Array<string>} categories - Array of category strings from API
 * @returns {Array<string>} Flattened array of individual genres
 */
export function parseHierarchicalGenres(categories) {
  if (!categories || !Array.isArray(categories)) return [];

  // Regex to split on common hierarchical separators (ONLY when surrounded by spaces)
  // Matches: " / ", " - ", " > ", " — " (em dash), " – " (en dash)
  // Note: Requires at least one space on each side to avoid splitting "Sci-Fi"
  const separators = /\s+[\/\-—–>]\s+/;
  const parsed = new Set();

  for (const category of categories) {
    if (!category || typeof category !== 'string') continue;

    // Split hierarchical category
    const parts = category.split(separators);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        // Apply variation normalization
        const normalized = normalizeGenreVariation(trimmed);
        parsed.add(normalized);
      }
    }
  }

  return Array.from(parsed);
}

/**
 * Get the variation mappings (for testing)
 * @returns {Object} Copy of GENRE_VARIATIONS
 */
export function getGenreVariations() {
  return { ...GENRE_VARIATIONS };
}
