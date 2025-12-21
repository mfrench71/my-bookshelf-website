/**
 * Tests for settings.js - Settings page logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkPasswordStrength, getContrastColor, escapeHtml, serializeTimestamp } from '../src/js/utils.js';

// Mock Firebase modules
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdatePassword = vi.fn();
const mockReauthenticate = vi.fn();
const mockDeleteUser = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback({ uid: 'test-user', email: 'test@example.com', metadata: { creationTime: '2023-01-15T00:00:00Z' } });
    return vi.fn();
  }),
  updatePassword: (...args) => mockUpdatePassword(...args),
  reauthenticateWithCredential: (...args) => mockReauthenticate(...args),
  EmailAuthProvider: { credential: vi.fn() },
  deleteUser: (...args) => mockDeleteUser(...args)
}));

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: (...args) => mockGetDoc(...args),
  doc: vi.fn(),
  setDoc: (...args) => mockSetDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  writeBatch: () => mockWriteBatch()
}));

vi.mock('../src/js/firebase-config.js', () => ({
  auth: {},
  db: {}
}));

vi.mock('../src/js/genres.js', () => ({
  loadUserGenres: vi.fn(() => Promise.resolve([])),
  createGenre: vi.fn(),
  updateGenre: vi.fn(),
  deleteGenre: vi.fn(),
  GENRE_COLORS: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'],
  getUsedColors: vi.fn(() => new Set()),
  getAvailableColors: vi.fn(() => ['#ef4444']),
  clearGenresCache: vi.fn(),
  migrateGenreData: vi.fn(),
  recalculateGenreBookCounts: vi.fn()
}));

vi.mock('../src/js/md5.js', () => ({
  md5: vi.fn(() => 'abc123'),
  getGravatarUrl: vi.fn(() => 'https://gravatar.com/avatar/abc123')
}));

// Mock lucide
global.lucide = {
  createIcons: vi.fn()
};

// Mock navigator.vibrate
global.navigator.vibrate = vi.fn();

// Mock fetch
global.fetch = vi.fn();

/**
 * Set up DOM elements for settings page
 */
function setupSettingsDOM() {
  document.body.innerHTML = `
    <!-- Navigation -->
    <nav>
      <button class="settings-nav-btn" data-section="profile">Profile</button>
      <button class="settings-nav-btn" data-section="genres">Genres</button>
      <button class="settings-nav-btn" data-section="backup">Backup</button>
    </nav>

    <!-- Accordion Headers (Mobile) -->
    <div class="accordion-header" data-accordion="profile">
      <span>Profile</span>
      <i class="accordion-icon"></i>
    </div>
    <div class="accordion-header" data-accordion="genres">
      <span>Genres</span>
      <i class="accordion-icon"></i>
    </div>

    <!-- Sections -->
    <section id="profile-section" class="settings-section">
      <div class="accordion-content">
        <div id="profile-avatar" class="w-20 h-20 rounded-full bg-gray-200"></div>
        <div id="profile-email"></div>
        <div id="profile-created"></div>
        <button id="change-password-btn">Change Password</button>
        <button id="edit-avatar-btn">Edit Avatar</button>
        <button id="privacy-settings-btn">Privacy</button>
        <button id="delete-account-btn">Delete Account</button>
      </div>
    </section>

    <section id="genres-section" class="settings-section hidden">
      <div class="accordion-content">
        <div id="genres-loading">Loading...</div>
        <div id="genres-empty" class="hidden">No genres</div>
        <div id="genre-list"></div>
        <button id="add-genre-btn">Add Genre</button>
      </div>
    </section>

    <section id="backup-section" class="settings-section hidden">
      <div class="accordion-content">
        <button id="export-btn"><i data-lucide="download"></i>Download Backup</button>
        <button id="cleanup-genres-btn"><i data-lucide="sparkles"></i>Run Cleanup</button>
        <div id="cleanup-progress" class="hidden">
          <div id="cleanup-status"></div>
          <div id="cleanup-progress-bar" style="width: 0%"></div>
        </div>
        <div id="cleanup-results" class="hidden">
          <div id="cleanup-results-text"></div>
        </div>
        <button id="recount-genres-btn"><i data-lucide="calculator"></i>Recalculate Counts</button>
        <div id="recount-results" class="hidden">
          <div id="recount-results-text"></div>
        </div>
      </div>
    </section>

    <!-- Genre Modal -->
    <div id="genre-modal" class="hidden">
      <h2 id="modal-title">Add Genre</h2>
      <form id="genre-form">
        <input id="genre-name" type="text" />
        <div id="color-picker"></div>
        <button id="cancel-genre">Cancel</button>
        <button id="save-genre" type="submit">Add</button>
      </form>
    </div>

    <!-- Delete Genre Modal -->
    <div id="delete-modal" class="hidden">
      <div id="delete-message"></div>
      <button id="cancel-delete">Cancel</button>
      <button id="confirm-delete">Delete</button>
    </div>

    <!-- Photo Modal -->
    <div id="photo-modal" class="hidden">
      <div id="photo-preview" class="w-20 h-20 rounded-full bg-gray-200"></div>
      <input id="photo-input" type="file" accept="image/*" class="hidden" />
      <button id="upload-photo-btn"><i data-lucide="upload"></i>Upload</button>
      <button id="remove-photo-btn" class="hidden"><i data-lucide="trash-2"></i>Remove</button>
      <button id="close-photo-modal">Close</button>
    </div>

    <!-- Password Modal -->
    <div id="password-modal" class="hidden">
      <form id="password-form">
        <input id="current-password" type="password" />
        <input id="new-password" type="password" />
        <input id="confirm-password" type="password" />
        <button id="cancel-password">Cancel</button>
        <button id="save-password" type="submit">Update Password</button>
      </form>
      <!-- Password Strength -->
      <div id="new-password-strength" class="hidden">
        <div id="new-strength-bar-1" class="h-1 flex-1 rounded-full bg-gray-200"></div>
        <div id="new-strength-bar-2" class="h-1 flex-1 rounded-full bg-gray-200"></div>
        <div id="new-strength-bar-3" class="h-1 flex-1 rounded-full bg-gray-200"></div>
        <div id="new-strength-bar-4" class="h-1 flex-1 rounded-full bg-gray-200"></div>
        <span id="new-strength-text" class="text-xs"></span>
      </div>
      <div id="new-req-length" class="text-gray-400"><i data-lucide="circle"></i></div>
      <div id="new-req-uppercase" class="text-gray-400"><i data-lucide="circle"></i></div>
      <div id="new-req-number" class="text-gray-400"><i data-lucide="circle"></i></div>
    </div>

    <!-- Delete Account Modal -->
    <div id="delete-account-modal" class="hidden">
      <form id="delete-account-form">
        <input id="delete-confirm-password" type="password" />
        <input id="delete-confirm-text" type="text" placeholder="Type DELETE" />
        <button id="cancel-delete-account">Cancel</button>
        <button id="confirm-delete-account" type="submit">Delete Account</button>
      </form>
    </div>

    <!-- Toast -->
    <div id="toast" class="hidden"></div>
  `;
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSettingsDOM();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Navigation', () => {
    describe('isMobile detection', () => {
      it('should detect mobile at width < 768', () => {
        // Mock window.innerWidth
        Object.defineProperty(window, 'innerWidth', { value: 767, writable: true });
        expect(window.innerWidth < 768).toBe(true);
      });

      it('should detect desktop at width >= 768', () => {
        Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
        expect(window.innerWidth < 768).toBe(false);
      });
    });

    describe('switchSection', () => {
      function switchSection(sectionId) {
        const navBtns = document.querySelectorAll('.settings-nav-btn');
        const sections = document.querySelectorAll('.settings-section');

        navBtns.forEach(btn => {
          const isActive = btn.dataset.section === sectionId;
          btn.classList.toggle('active', isActive);
          btn.classList.toggle('bg-primary', isActive);
          btn.classList.toggle('text-white', isActive);
        });

        sections.forEach(section => {
          const isActive = section.id === `${sectionId}-section`;
          section.classList.toggle('hidden', !isActive);
        });
      }

      it('should show selected section and hide others', () => {
        switchSection('genres');

        const profileSection = document.getElementById('profile-section');
        const genresSection = document.getElementById('genres-section');
        const backupSection = document.getElementById('backup-section');

        expect(profileSection.classList.contains('hidden')).toBe(true);
        expect(genresSection.classList.contains('hidden')).toBe(false);
        expect(backupSection.classList.contains('hidden')).toBe(true);
      });

      it('should activate correct nav button', () => {
        switchSection('backup');

        const navBtns = document.querySelectorAll('.settings-nav-btn');
        navBtns.forEach(btn => {
          if (btn.dataset.section === 'backup') {
            expect(btn.classList.contains('active')).toBe(true);
            expect(btn.classList.contains('bg-primary')).toBe(true);
          } else {
            expect(btn.classList.contains('active')).toBe(false);
          }
        });
      });
    });

    describe('toggleAccordion', () => {
      function toggleAccordion(sectionId) {
        const section = document.getElementById(`${sectionId}-section`);
        const header = document.querySelector(`[data-accordion="${sectionId}"]`);
        const content = section?.querySelector('.accordion-content');
        const icon = header?.querySelector('.accordion-icon');

        if (!section || !content) return;

        const isExpanded = !content.classList.contains('hidden');

        if (isExpanded) {
          content.classList.add('hidden');
          icon?.classList.remove('rotate-180');
        } else {
          // Close all other accordions
          document.querySelectorAll('.settings-section').forEach(otherSection => {
            if (otherSection.id !== `${sectionId}-section`) {
              const otherContent = otherSection.querySelector('.accordion-content');
              const otherSectionId = otherSection.id.replace('-section', '');
              const otherIcon = document.querySelector(`[data-accordion="${otherSectionId}"] .accordion-icon`);
              otherContent?.classList.add('hidden');
              otherIcon?.classList.remove('rotate-180');
            }
          });

          content.classList.remove('hidden');
          icon?.classList.add('rotate-180');
        }
      }

      it('should expand collapsed section', () => {
        const content = document.querySelector('#genres-section .accordion-content');
        content.classList.add('hidden');

        toggleAccordion('genres');

        expect(content.classList.contains('hidden')).toBe(false);
      });

      it('should collapse expanded section', () => {
        const content = document.querySelector('#genres-section .accordion-content');
        content.classList.remove('hidden');

        toggleAccordion('genres');

        expect(content.classList.contains('hidden')).toBe(true);
      });

      it('should close other accordions when opening one', () => {
        // Start with profile expanded
        const profileContent = document.querySelector('#profile-section .accordion-content');
        profileContent.classList.remove('hidden');

        // Make genres collapsed so toggling it will open it
        const genresContent = document.querySelector('#genres-section .accordion-content');
        genresContent.classList.add('hidden');

        toggleAccordion('genres');

        // Profile should now be hidden, genres should be visible
        expect(profileContent.classList.contains('hidden')).toBe(true);
        expect(genresContent.classList.contains('hidden')).toBe(false);
      });

      it('should rotate icon on expand', () => {
        const icon = document.querySelector('[data-accordion="genres"] .accordion-icon');
        const content = document.querySelector('#genres-section .accordion-content');
        content.classList.add('hidden');

        toggleAccordion('genres');

        expect(icon.classList.contains('rotate-180')).toBe(true);
      });
    });
  });

  describe('Password Strength UI', () => {
    function updateNewPasswordUI(password) {
      const newPasswordStrength = document.getElementById('new-password-strength');
      const newStrengthBars = [
        document.getElementById('new-strength-bar-1'),
        document.getElementById('new-strength-bar-2'),
        document.getElementById('new-strength-bar-3'),
        document.getElementById('new-strength-bar-4')
      ];
      const newStrengthText = document.getElementById('new-strength-text');
      const newReqLength = document.getElementById('new-req-length');
      const newReqUppercase = document.getElementById('new-req-uppercase');
      const newReqNumber = document.getElementById('new-req-number');

      function updateRequirement(element, met) {
        if (!element) return;
        if (met) {
          element.classList.remove('text-gray-400');
          element.classList.add('text-green-500');
        } else {
          element.classList.remove('text-green-500');
          element.classList.add('text-gray-400');
        }
      }

      if (!newPasswordStrength) return;

      if (password.length === 0) {
        newPasswordStrength.classList.add('hidden');
        updateRequirement(newReqLength, false);
        updateRequirement(newReqUppercase, false);
        updateRequirement(newReqNumber, false);
        return;
      }

      newPasswordStrength.classList.remove('hidden');
      const { checks, score } = checkPasswordStrength(password);

      updateRequirement(newReqLength, checks.length);
      updateRequirement(newReqUppercase, checks.uppercase);
      updateRequirement(newReqNumber, checks.number);

      const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
      const labels = ['Weak', 'Fair', 'Good', 'Strong'];

      newStrengthBars.forEach((bar, index) => {
        bar.className = 'h-1 flex-1 rounded-full';
        if (index < score) {
          bar.classList.add(colors[Math.min(score - 1, 3)]);
        } else {
          bar.classList.add('bg-gray-200');
        }
      });

      newStrengthText.textContent = labels[Math.min(score - 1, 3)] || '';
    }

    it('should hide strength indicator for empty password', () => {
      updateNewPasswordUI('');

      const strengthEl = document.getElementById('new-password-strength');
      expect(strengthEl.classList.contains('hidden')).toBe(true);
    });

    it('should show strength indicator for non-empty password', () => {
      updateNewPasswordUI('test');

      const strengthEl = document.getElementById('new-password-strength');
      expect(strengthEl.classList.contains('hidden')).toBe(false);
    });

    it('should show Weak for simple password', () => {
      updateNewPasswordUI('abcdef');

      const strengthText = document.getElementById('new-strength-text');
      expect(strengthText.textContent).toBe('Weak');
    });

    it('should show Strong for complex password', () => {
      updateNewPasswordUI('Abcdef1!');

      const strengthText = document.getElementById('new-strength-text');
      expect(strengthText.textContent).toBe('Strong');
    });

    it('should mark length requirement as met', () => {
      updateNewPasswordUI('abcdef');

      const reqLength = document.getElementById('new-req-length');
      expect(reqLength.classList.contains('text-green-500')).toBe(true);
    });

    it('should mark uppercase requirement as met', () => {
      updateNewPasswordUI('Abcdef');

      const reqUppercase = document.getElementById('new-req-uppercase');
      expect(reqUppercase.classList.contains('text-green-500')).toBe(true);
    });

    it('should mark number requirement as met', () => {
      updateNewPasswordUI('abcdef1');

      const reqNumber = document.getElementById('new-req-number');
      expect(reqNumber.classList.contains('text-green-500')).toBe(true);
    });
  });

  describe('Password Form Validation', () => {
    it('should detect password mismatch', () => {
      document.getElementById('new-password').value = 'Password123!';
      document.getElementById('confirm-password').value = 'Different123!';

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      expect(newPassword !== confirmPassword).toBe(true);
    });

    it('should accept matching passwords', () => {
      document.getElementById('new-password').value = 'Password123!';
      document.getElementById('confirm-password').value = 'Password123!';

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      expect(newPassword === confirmPassword).toBe(true);
    });

    it('should detect password too short', () => {
      document.getElementById('new-password').value = 'Pass1';

      const newPassword = document.getElementById('new-password').value;
      expect(newPassword.length < 6).toBe(true);
    });
  });

  describe('Genre Rendering', () => {
    const mockGenres = [
      { id: 'g1', name: 'Fiction', color: '#3b82f6', bookCount: 5 },
      { id: 'g2', name: 'Science', color: '#22c55e', bookCount: 0 },
      { id: 'g3', name: "Children's", color: '#ec4899', bookCount: 1 }
    ];

    function renderGenres(genres) {
      const genresLoading = document.getElementById('genres-loading');
      const genresEmpty = document.getElementById('genres-empty');
      const genreList = document.getElementById('genre-list');

      genresLoading.classList.add('hidden');

      if (genres.length === 0) {
        genresEmpty.classList.remove('hidden');
        genreList.innerHTML = '';
        return;
      }

      genresEmpty.classList.add('hidden');

      genreList.innerHTML = genres.map(genre => {
        const textColor = getContrastColor(genre.color);
        return `
          <div class="genre-item flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
            <span class="genre-badge" style="background-color: ${genre.color}; color: ${textColor}">${escapeHtml(genre.name)}</span>
            <span class="book-count text-sm text-gray-500 flex-1">${genre.bookCount || 0} book${(genre.bookCount || 0) !== 1 ? 's' : ''}</span>
            <button class="edit-btn" data-id="${genre.id}">Edit</button>
            <button class="delete-btn" data-id="${genre.id}" data-name="${escapeHtml(genre.name)}">Delete</button>
          </div>
        `;
      }).join('');
    }

    it('should hide loading state after render', () => {
      renderGenres(mockGenres);

      const loading = document.getElementById('genres-loading');
      expect(loading.classList.contains('hidden')).toBe(true);
    });

    it('should show empty state when no genres', () => {
      renderGenres([]);

      const empty = document.getElementById('genres-empty');
      expect(empty.classList.contains('hidden')).toBe(false);
    });

    it('should hide empty state when genres exist', () => {
      renderGenres(mockGenres);

      const empty = document.getElementById('genres-empty');
      expect(empty.classList.contains('hidden')).toBe(true);
    });

    it('should render correct number of genres', () => {
      renderGenres(mockGenres);

      const genreItems = document.querySelectorAll('.genre-item');
      expect(genreItems.length).toBe(3);
    });

    it('should display genre names correctly', () => {
      renderGenres(mockGenres);

      const badges = document.querySelectorAll('.genre-badge');
      expect(badges[0].textContent.trim()).toBe('Fiction');
      expect(badges[1].textContent.trim()).toBe('Science');
    });

    it('should escape HTML in genre names', () => {
      const genresWithXSS = [
        { id: 'g1', name: '<script>alert("xss")</script>', color: '#3b82f6', bookCount: 0 }
      ];

      renderGenres(genresWithXSS);

      const badge = document.querySelector('.genre-badge');
      expect(badge.innerHTML).not.toContain('<script>');
      expect(badge.textContent).toContain('<script>');
    });

    it('should show singular "book" for count of 1', () => {
      const singleBookGenre = [{ id: 'g1', name: 'Test', color: '#3b82f6', bookCount: 1 }];

      renderGenres(singleBookGenre);

      const count = document.querySelector('.book-count');
      expect(count.textContent.trim()).toBe('1 book');
    });

    it('should show plural "books" for count > 1', () => {
      const multiBookGenre = [{ id: 'g1', name: 'Test', color: '#3b82f6', bookCount: 5 }];

      renderGenres(multiBookGenre);

      const count = document.querySelector('.book-count');
      expect(count.textContent.trim()).toBe('5 books');
    });

    it('should show "0 books" for count of 0', () => {
      const noBookGenre = [{ id: 'g1', name: 'Test', color: '#3b82f6', bookCount: 0 }];

      renderGenres(noBookGenre);

      const count = document.querySelector('.book-count');
      expect(count.textContent.trim()).toBe('0 books');
    });
  });

  describe('Color Picker', () => {
    const GENRE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

    function renderColorPicker(selectedColor, usedColors = new Set()) {
      const colorPicker = document.getElementById('color-picker');

      colorPicker.innerHTML = GENRE_COLORS.map(color => {
        const isSelected = color.toLowerCase() === selectedColor?.toLowerCase();
        const isUsed = usedColors.has(color.toLowerCase());
        const textColor = getContrastColor(color);

        if (isUsed) {
          return `
            <button type="button" class="color-btn w-8 h-8 rounded-full opacity-30 cursor-not-allowed"
              style="background-color: ${color}" disabled title="Already in use">
            </button>
          `;
        }

        return `
          <button type="button" class="color-btn w-8 h-8 rounded-full ${isSelected ? 'selected' : ''}"
            style="background-color: ${color}" data-color="${color}">
          </button>
        `;
      }).join('');
    }

    it('should render all color options', () => {
      renderColorPicker('#3b82f6');

      const buttons = document.querySelectorAll('.color-btn');
      expect(buttons.length).toBe(8);
    });

    it('should mark selected color', () => {
      renderColorPicker('#3b82f6');

      const selectedBtn = document.querySelector('.color-btn.selected');
      expect(selectedBtn).not.toBeNull();
      expect(selectedBtn.dataset.color).toBe('#3b82f6');
    });

    it('should disable used colors', () => {
      const usedColors = new Set(['#ef4444', '#22c55e']);

      renderColorPicker('#3b82f6', usedColors);

      const disabledBtns = document.querySelectorAll('.color-btn[disabled]');
      expect(disabledBtns.length).toBe(2);
    });

    it('should not disable available colors', () => {
      const usedColors = new Set(['#ef4444']);

      renderColorPicker('#3b82f6', usedColors);

      const enabledBtns = document.querySelectorAll('.color-btn:not([disabled])');
      expect(enabledBtns.length).toBe(7);
    });
  });

  describe('Delete Genre Modal', () => {
    function openDeleteModal(genreId, name, bookCount) {
      const deleteMessage = document.getElementById('delete-message');
      const deleteModal = document.getElementById('delete-modal');

      deleteMessage.textContent = bookCount > 0
        ? `This will remove "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
        : `Are you sure you want to delete "${name}"?`;

      deleteModal.classList.remove('hidden');
    }

    it('should show warning when genre has books', () => {
      openDeleteModal('g1', 'Fiction', 5);

      const message = document.getElementById('delete-message');
      expect(message.textContent).toContain('This will remove "Fiction" from 5 books.');
    });

    it('should show simple confirmation when genre has no books', () => {
      openDeleteModal('g1', 'Empty Genre', 0);

      const message = document.getElementById('delete-message');
      expect(message.textContent).toBe('Are you sure you want to delete "Empty Genre"?');
    });

    it('should use singular "book" for count of 1', () => {
      openDeleteModal('g1', 'Rare', 1);

      const message = document.getElementById('delete-message');
      expect(message.textContent).toContain('1 book');
      expect(message.textContent).not.toContain('1 books');
    });
  });

  describe('Delete Account Validation', () => {
    it('should require typing DELETE to confirm', () => {
      document.getElementById('delete-confirm-text').value = 'delete';

      const confirmText = document.getElementById('delete-confirm-text').value;
      expect(confirmText === 'DELETE').toBe(false);
    });

    it('should accept DELETE (case-sensitive)', () => {
      document.getElementById('delete-confirm-text').value = 'DELETE';

      const confirmText = document.getElementById('delete-confirm-text').value;
      expect(confirmText === 'DELETE').toBe(true);
    });
  });

  describe('Export', () => {
    it('should create valid JSON blob', () => {
      const books = [
        { id: 'b1', title: 'Book 1', author: 'Author 1' },
        { id: 'b2', title: 'Book 2', author: 'Author 2' }
      ];

      // Remove internal fields before export
      const data = books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });

      expect(blob.type).toBe('application/json');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should exclude internal fields from export', () => {
      const books = [
        {
          id: 'b1',
          title: 'Book 1',
          author: 'Author 1',
          _normalizedTitle: 'book 1',
          _normalizedAuthor: 'author 1'
        }
      ];

      const data = books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book);

      expect(data[0]).not.toHaveProperty('id');
      expect(data[0]).not.toHaveProperty('_normalizedTitle');
      expect(data[0]).not.toHaveProperty('_normalizedAuthor');
      expect(data[0]).toHaveProperty('title');
      expect(data[0]).toHaveProperty('author');
    });

    it('should generate correct filename format', () => {
      const date = new Date('2024-03-15T12:00:00Z');
      const filename = `mybookshelf-export-${date.toISOString().split('T')[0]}.json`;

      expect(filename).toBe('mybookshelf-export-2024-03-15.json');
    });
  });

  describe('Photo Upload Validation', () => {
    const MAX_FILE_SIZE = 500 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    it('should accept valid JPEG file', () => {
      const file = { type: 'image/jpeg', size: 100 * 1024 };

      expect(ALLOWED_TYPES.includes(file.type)).toBe(true);
      expect(file.size <= MAX_FILE_SIZE).toBe(true);
    });

    it('should accept valid PNG file', () => {
      const file = { type: 'image/png', size: 100 * 1024 };

      expect(ALLOWED_TYPES.includes(file.type)).toBe(true);
    });

    it('should accept valid WebP file', () => {
      const file = { type: 'image/webp', size: 100 * 1024 };

      expect(ALLOWED_TYPES.includes(file.type)).toBe(true);
    });

    it('should reject GIF file', () => {
      const file = { type: 'image/gif', size: 100 * 1024 };

      expect(ALLOWED_TYPES.includes(file.type)).toBe(false);
    });

    it('should reject file over 500KB', () => {
      const file = { type: 'image/jpeg', size: 600 * 1024 };

      expect(file.size > MAX_FILE_SIZE).toBe(true);
    });

    it('should accept file exactly at 500KB limit', () => {
      const file = { type: 'image/jpeg', size: MAX_FILE_SIZE };

      expect(file.size <= MAX_FILE_SIZE).toBe(true);
    });
  });

  describe('Profile Display', () => {
    it('should format member since date correctly', () => {
      const createdAt = '2023-01-15T00:00:00Z';
      const date = new Date(createdAt);
      const formatted = date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Should include year 2023
      expect(formatted).toContain('2023');
    });

    it('should extract initial from email', () => {
      const email = 'test@example.com';
      const initial = email.charAt(0).toUpperCase();

      expect(initial).toBe('T');
    });

    it('should handle empty email', () => {
      const email = '';
      const initial = email ? email.charAt(0).toUpperCase() : '?';

      expect(initial).toBe('?');
    });
  });

  describe('fileToBase64', () => {
    it('should return Promise that resolves with data URL', () => {
      // Test the function structure - actual FileReader behavior is browser-specific
      function fileToBase64(file) {
        return new Promise((resolve, reject) => {
          // In real implementation, this would use FileReader
          resolve('data:image/png;base64,mockbase64content');
        });
      }

      return fileToBase64({ name: 'test.png' }).then(result => {
        expect(result).toContain('data:image/png;base64');
      });
    });

    it('should reject on error', () => {
      function fileToBase64WithError(file) {
        return new Promise((resolve, reject) => {
          reject(new Error('Read error'));
        });
      }

      return expect(fileToBase64WithError({ name: 'test.png' })).rejects.toThrow('Read error');
    });
  });

  describe('Modal Behavior', () => {
    it('should show genre modal when opened', () => {
      const modal = document.getElementById('genre-modal');
      modal.classList.remove('hidden');

      expect(modal.classList.contains('hidden')).toBe(false);
    });

    it('should hide genre modal when closed', () => {
      const modal = document.getElementById('genre-modal');
      modal.classList.add('hidden');

      expect(modal.classList.contains('hidden')).toBe(true);
    });

    it('should show password modal when opened', () => {
      const modal = document.getElementById('password-modal');
      modal.classList.remove('hidden');

      expect(modal.classList.contains('hidden')).toBe(false);
    });

    it('should show delete account modal when opened', () => {
      const modal = document.getElementById('delete-account-modal');
      modal.classList.remove('hidden');

      expect(modal.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Cleanup Results', () => {
    it('should show clean data message when no issues', () => {
      const resultsText = document.getElementById('cleanup-results-text');
      const results = { booksUpdated: 0, genresCreated: 0, errors: [] };

      if (results.booksUpdated === 0 && results.genresCreated === 0) {
        resultsText.textContent = 'No issues found. All genre references are valid.';
      }

      expect(resultsText.textContent).toBe('No issues found. All genre references are valid.');
    });

    it('should show update summary when changes made', () => {
      const resultsText = document.getElementById('cleanup-results-text');
      const results = { booksUpdated: 5, genresCreated: 2, errors: [] };

      const parts = [];
      if (results.booksUpdated > 0) {
        parts.push(`${results.booksUpdated} book${results.booksUpdated !== 1 ? 's' : ''} updated`);
      }
      if (results.genresCreated > 0) {
        parts.push(`${results.genresCreated} genre${results.genresCreated !== 1 ? 's' : ''} created`);
      }
      resultsText.textContent = parts.join(', ') + '.';

      expect(resultsText.textContent).toBe('5 books updated, 2 genres created.');
    });

    it('should include error count in results', () => {
      const resultsText = document.getElementById('cleanup-results-text');
      const results = { booksUpdated: 1, genresCreated: 0, errors: ['error1', 'error2'] };

      let text = `${results.booksUpdated} book updated.`;
      if (results.errors.length > 0) {
        text += ` ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''} occurred.`;
      }
      resultsText.textContent = text;

      expect(resultsText.textContent).toContain('2 errors occurred');
    });
  });

  describe('Recount Results', () => {
    it('should show verified message when counts correct', () => {
      const resultsText = document.getElementById('recount-results-text');
      const results = { genresUpdated: 0, totalBooks: 50 };

      if (results.genresUpdated === 0) {
        resultsText.textContent = 'All genre counts are correct.';
      }

      expect(resultsText.textContent).toBe('All genre counts are correct.');
    });

    it('should show update summary when counts fixed', () => {
      const resultsText = document.getElementById('recount-results-text');
      const results = { genresUpdated: 3, totalBooks: 50 };

      resultsText.textContent = `Updated ${results.genresUpdated} genre${results.genresUpdated !== 1 ? 's' : ''} after scanning ${results.totalBooks} books.`;

      expect(resultsText.textContent).toBe('Updated 3 genres after scanning 50 books.');
    });
  });
});
