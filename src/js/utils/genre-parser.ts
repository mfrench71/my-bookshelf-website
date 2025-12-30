// Genre Parser Utilities - Parse and normalize genre names from APIs

/** Genre variation mapping type */
type GenreVariations = Record<string, string>;

/**
 * Common genre variation mappings
 * Maps informal/abbreviated forms to standard forms
 * NOTE: Only maps synonyms/abbreviations, NOT subgenres to parent genres
 * (to preserve specificity - "Space Opera" stays as "Space Opera", not "Science Fiction")
 */
const GENRE_VARIATIONS: GenreVariations = {
  // Abbreviations
  'sci-fi': 'Science Fiction',
  scifi: 'Science Fiction',
  sf: 'Science Fiction',
  ya: 'Young Adult',
  'lit fic': 'Literary Fiction',
  'lit-fic': 'Literary Fiction',
  'rom-com': 'Romantic Comedy',
  romcom: 'Romantic Comedy',

  // British/American spelling normalization (only genre-relevant terms)
  humor: 'Humour',
  humorous: 'Humour',

  // Synonyms and variations
  nonfiction: 'Non-Fiction',
  'non fiction': 'Non-Fiction',
  'non-fiction': 'Non-Fiction',
  whodunit: 'Mystery',
  whodunnit: 'Mystery',
  literary: 'Literary Fiction',
  'general fiction': 'Fiction',
  general: '', // Filter out - not useful alone
  accessible: '', // Filter out - not a genre
  readable: '', // Filter out - not a genre

  // Compound genre normalizations (remove redundant "fiction" suffix)
  'fantasy fiction': 'Fantasy',
  'adventure fiction': 'Adventure',
  'science fiction': 'Science Fiction', // Keep as-is (established term)
  'historical fiction': 'Historical Fiction', // Keep as-is
  'psychological fiction': 'Psychological',
  'political fiction': 'Political',
  'domestic fiction': 'Domestic',
  'satirical literature': 'Satire',
  'picaresque literature': 'Picaresque',
  'romance fiction': 'Romance',
  'crime fiction': 'Crime',
  'detective fiction': 'Detective',
  'legal stories': 'Legal',
  'school stories': 'School',
  'love stories': 'Romance',
  'horror fiction': 'Horror',
  'ghost fiction': 'Ghost',
  'paranormal fiction': 'Paranormal',
  'supernatural thrillers': 'Supernatural',
  'horror & ghost stories': 'Horror',
  'contemporary women': 'Contemporary',
  'fiction, women': "Women's Fiction",

  // Ampersand format normalizations
  'science fiction & fantasy': 'Science Fiction',
  'action & adventure': 'Adventure',
  'fantasy & magic': 'Fantasy',
  'fiction & literature': 'Fiction',
  'body, mind & spirit': 'Spirituality',

  // More compound genres from API audit
  'fiction classics': 'Classics',
  'contemporary fiction': 'Contemporary',
  'modern fiction': 'Contemporary',
  'teen fiction': 'Young Adult',
  "children's fiction": 'Children',
  "children's stories": 'Children',
  'english fantasy literature': 'Fantasy',
  'english science fiction': 'Science Fiction',
  'american fiction': 'Fiction',
  bildungsromans: 'Coming of Age',

  // Filter out non-genre metadata
  'new york times bestseller': '',
  'new york times reviewed': '',
  'open library staff picks': '',
  novela: '', // Spanish for "novel"
  ficción: '', // Spanish for "fiction"
  romans: '', // French for "novels"
  'juvenile audience': '',
  'juvenile works': '',
  'juvenile literature': '',
  'translations from english': '',
  'translating into welsh': '',
  'translations into marathi': '',
  'translations into chinese': '',
  'german language materials': '',
  'spanish language materials': '',
  'latin language materials': '',
  'english language': '',
  'chinese fiction': '', // Language, not genre
  'english fiction': '', // Language, not genre
  'english literature': '', // Too broad
  roman: '', // French for "novel"

  // Specific character/location references (filter out)
  'harry potter': '',
  'j.k rowling': '',

  // Children/Young Adult variations
  'juvenile fiction': 'Children',
  juvenile: 'Children',
  "children's": 'Children',
  teen: 'Young Adult',
  teens: 'Young Adult',
  adolescent: 'Young Adult',
  'young adult fiction': 'Young Adult',
  'ya fiction': 'Young Adult',
};

/**
 * Normalize a genre name using variation mapping
 * Returns the canonical form if found, otherwise original (trimmed)
 * @param name - Genre name to normalize
 * @returns Normalized genre name
 */
export function normalizeGenreVariation(name: string | null | undefined): string {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  // Use 'in' check instead of || to allow empty string mappings (for filtering)
  if (lower in GENRE_VARIATIONS) {
    return GENRE_VARIATIONS[lower];
  }
  return name.trim();
}

/**
 * Parse hierarchical genre strings into individual genres
 * Splits on: " / ", " - ", " > ", " — ", ", " (comma-space)
 *
 * Examples:
 * - "Fiction / Science Fiction / Space Opera" → ["Fiction", "Science Fiction", "Space Opera"]
 * - "Young Adult - Fantasy" → ["Young Adult", "Fantasy"]
 * - "Mystery > Cozy Mystery" → ["Mystery", "Cozy Mystery"]
 * - "Fiction, humorous, general" → ["Fiction", "Humorous", "General"]
 * - "Thriller" → ["Thriller"] (no change)
 * - "Sci-Fi" → ["Science Fiction"] (no space around hyphen, so not split)
 *
 * @param categories - Array of category strings from API
 * @returns Flattened array of individual genres
 */
export function parseHierarchicalGenres(categories: string[] | null | undefined): string[] {
  if (!categories || !Array.isArray(categories)) return [];

  // Regex to split on common hierarchical separators
  // Matches: " / ", " - ", " -- ", " > ", " — " (em dash), " – " (en dash), ", " (comma-space)
  // Note: Requires at least one space on each side for slashes/dashes to avoid splitting "Sci-Fi"
  const separators = /\s+[/\-—–>]\s+|\s+--\s+|,\s+/;
  const parsed = new Set<string>();

  // Patterns to filter out (clearly NOT genres - just metadata)
  // Keep borderline items for user to manage via genre management UI
  const filterPatterns: RegExp[] = [
    /^series:/i, // series:Harry_Potter
    /^nyt:/i, // nyt:advice-how-to-and-miscellaneous=2016-10-02
    /^collectionid:/i, // collectionid:nyt2020s
    /^award:/i, // Award:National_book_award=1992
    /\baward\s+winner\b/i, // National Book Award Winner
    /\baward\s*=\s*/i, // Award:National_book_critics_circle_award=Fiction
    /^reading level/i, // Reading Level-Grade 9
    /\bpublication type\b/i, // Fictional Works [Publication Type]
    /\bmanual for civilization\b/i, // Long Now Manual for Civilization
    /large type books?/i, // Large type books (format, not genre)
    /^translations? (?:from|into)/i, // Translations from English
    / language materials?$/i, // Spanish language materials
    /\(\d{4}-\d{4}\)/, // Author dates like (1896-1940)
    /\(fictional works by one author\)/i, // American fiction (fictional works by one author)
  ];

  /**
   * Convert string to Title Case for consistent genre display
   */
  function toTitleCase(str: string): string {
    if (!str || str.length <= 1) return str;
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  for (const category of categories) {
    if (!category || typeof category !== 'string') continue;

    // Skip entire category if it matches filter patterns
    if (filterPatterns.some(pattern => pattern.test(category))) continue;

    // Split hierarchical category
    const parts = category.split(separators);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        // Skip if matches filter patterns (after splitting)
        if (filterPatterns.some(pattern => pattern.test(trimmed))) continue;
        // Convert ALL CAPS to Title Case first (e.g., "FICTION CLASSICS" → "Fiction Classics")
        const caseFixed = toTitleCase(trimmed);
        // Apply variation normalization (may return '' to filter out)
        const normalized = normalizeGenreVariation(caseFixed);
        if (!normalized) continue; // Skip filtered terms like "general"
        // Title-case first char if lowercase (e.g., "humorous" → "Humorous")
        const titleCased =
          normalized.charAt(0) === normalized.charAt(0).toLowerCase()
            ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
            : normalized;
        parsed.add(titleCased);
      }
    }
  }

  return Array.from(parsed);
}

/**
 * Get the variation mappings (for testing)
 * @returns Copy of GENRE_VARIATIONS
 */
export function getGenreVariations(): GenreVariations {
  return { ...GENRE_VARIATIONS };
}
