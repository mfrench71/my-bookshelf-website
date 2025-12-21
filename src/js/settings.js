// Settings Page Logic
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  loadUserGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  GENRE_COLORS,
  getUsedColors,
  getAvailableColors,
  clearGenresCache,
  migrateGenreData,
  recalculateGenreBookCounts
} from './genres.js';
import { showToast, initIcons, getContrastColor, escapeHtml, clearBooksCache, CACHE_KEY, serializeTimestamp, getCachedUserProfile, clearUserProfileCache, checkPasswordStrength, lockBodyScroll, unlockBodyScroll, isMobile } from './utils.js';
import { md5, getGravatarUrl } from './md5.js';

// Initialize icons once on load
initIcons();

// Back button - smart navigation
const backBtn = document.getElementById('back-btn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    if (history.length > 1) {
      history.back();
    } else {
      window.location.href = '/';
    }
  });
}

// State
let currentUser = null;
let genres = [];
let editingGenreId = null;
let selectedColor = GENRE_COLORS[0];
let books = [];
let allBooksLoaded = false;

// DOM Elements - Navigation
const navBtns = document.querySelectorAll('.settings-nav-btn');
const sections = document.querySelectorAll('.settings-section');
const accordionHeaders = document.querySelectorAll('.accordion-header');

// DOM Elements - Genres
const genresLoading = document.getElementById('genres-loading');
const genresEmpty = document.getElementById('genres-empty');
const genreList = document.getElementById('genre-list');
const addGenreBtn = document.getElementById('add-genre-btn');
const genreModal = document.getElementById('genre-modal');
const modalTitle = document.getElementById('modal-title');
const genreForm = document.getElementById('genre-form');
const genreNameInput = document.getElementById('genre-name');
const colorPicker = document.getElementById('color-picker');
const cancelGenreBtn = document.getElementById('cancel-genre');
const saveGenreBtn = document.getElementById('save-genre');
const deleteModal = document.getElementById('delete-modal');
const deleteMessage = document.getElementById('delete-message');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

// DOM Elements - Export
const exportBtn = document.getElementById('export-btn');

// DOM Elements - Cleanup
const cleanupGenresBtn = document.getElementById('cleanup-genres-btn');
const cleanupProgress = document.getElementById('cleanup-progress');
const cleanupStatus = document.getElementById('cleanup-status');
const cleanupProgressBar = document.getElementById('cleanup-progress-bar');
const cleanupResults = document.getElementById('cleanup-results');
const cleanupResultsText = document.getElementById('cleanup-results-text');
const recountGenresBtn = document.getElementById('recount-genres-btn');
const recountResults = document.getElementById('recount-results');
const recountResultsText = document.getElementById('recount-results-text');

// DOM Elements - Profile
const profileAvatar = document.getElementById('profile-avatar');
const profileEmail = document.getElementById('profile-email');
const profileCreated = document.getElementById('profile-created');
const changePasswordBtn = document.getElementById('change-password-btn');
const editAvatarBtn = document.getElementById('edit-avatar-btn');
const privacySettingsBtn = document.getElementById('privacy-settings-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// DOM Elements - Photo Modal
const photoModal = document.getElementById('photo-modal');
const photoPreview = document.getElementById('photo-preview');
const photoInput = document.getElementById('photo-input');
const uploadPhotoBtn = document.getElementById('upload-photo-btn');
const removePhotoBtn = document.getElementById('remove-photo-btn');
const closePhotoModalBtn = document.getElementById('close-photo-modal');

// Profile photo state
let userProfileData = null;

// DOM Elements - Password Modal
const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const cancelPasswordBtn = document.getElementById('cancel-password');
const savePasswordBtn = document.getElementById('save-password');

// Password strength elements
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

// DOM Elements - Delete Account Modal
const deleteAccountModal = document.getElementById('delete-account-modal');
const deleteAccountForm = document.getElementById('delete-account-form');
const deleteConfirmPasswordInput = document.getElementById('delete-confirm-password');
const deleteConfirmTextInput = document.getElementById('delete-confirm-text');
const cancelDeleteAccountBtn = document.getElementById('cancel-delete-account');
const confirmDeleteAccountBtn = document.getElementById('confirm-delete-account');

// Auth Check
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadProfileInfo();
    loadGenres();
  }
});

// ==================== Section Navigation ====================

// Desktop nav button clicks
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const sectionId = btn.dataset.section;
    switchSection(sectionId);
  });
});

// Mobile accordion header clicks
accordionHeaders.forEach(header => {
  header.addEventListener('click', () => {
    const sectionId = header.dataset.accordion;
    toggleAccordion(sectionId);
  });
});

function switchSection(sectionId) {
  // Update nav buttons (desktop)
  navBtns.forEach(btn => {
    const isActive = btn.dataset.section === sectionId;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('bg-primary', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('text-gray-700', !isActive);
    btn.classList.toggle('hover:bg-gray-100', !isActive);
  });

  // Show/hide sections (desktop mode - only one visible)
  sections.forEach(section => {
    const isActive = section.id === `${sectionId}-section`;
    section.classList.toggle('hidden', !isActive);
  });

  initIcons();
}

function toggleAccordion(sectionId) {
  const section = document.getElementById(`${sectionId}-section`);
  const header = document.querySelector(`[data-accordion="${sectionId}"]`);
  const content = section?.querySelector('.accordion-content');
  const icon = header?.querySelector('.accordion-icon');

  if (!section || !content) return;

  const isExpanded = !content.classList.contains('hidden');

  if (isExpanded) {
    // Collapse this section
    content.classList.add('hidden');
    icon?.classList.remove('rotate-180');
  } else {
    // Close all other accordions first
    sections.forEach(otherSection => {
      if (otherSection.id !== `${sectionId}-section`) {
        const otherContent = otherSection.querySelector('.accordion-content');
        const otherSectionId = otherSection.id.replace('-section', '');
        const otherIcon = document.querySelector(`[data-accordion="${otherSectionId}"] .accordion-icon`);
        otherContent?.classList.add('hidden');
        otherIcon?.classList.remove('rotate-180');
      }
    });

    // Expand this section
    content.classList.remove('hidden');
    icon?.classList.add('rotate-180');

    // Scroll to the accordion header, accounting for sticky header
    setTimeout(() => {
      if (header) {
        const headerHeight = document.querySelector('header')?.offsetHeight || 0;
        const subNavHeight = document.querySelector('.bg-white.border-b')?.offsetHeight || 0;
        const offset = headerHeight + subNavHeight + 16; // 16px extra padding
        const elementTop = header.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementTop - offset, behavior: 'smooth' });
      }
    }, 50);
  }

  initIcons();
}

function initializeAccordions() {
  if (isMobile()) {
    // On mobile: show all sections (for accordion headers), but collapse content except profile
    sections.forEach(section => {
      section.classList.remove('hidden');
      const content = section.querySelector('.accordion-content');
      const sectionId = section.id.replace('-section', '');
      const icon = document.querySelector(`[data-accordion="${sectionId}"] .accordion-icon`);

      if (sectionId === 'profile') {
        content?.classList.remove('hidden');
        icon?.classList.add('rotate-180');
      } else {
        content?.classList.add('hidden');
        icon?.classList.remove('rotate-180');
      }
    });
  } else {
    // On desktop: ensure all accordion content is visible (not collapsed from mobile)
    sections.forEach(section => {
      const content = section.querySelector('.accordion-content');
      content?.classList.remove('hidden');
    });
    // Then use sidebar navigation to show only active section
    switchSection('profile');
  }
  initIcons();
}

// Handle window resize
let lastIsMobile = isMobile();
window.addEventListener('resize', () => {
  const currentIsMobile = isMobile();
  if (currentIsMobile !== lastIsMobile) {
    lastIsMobile = currentIsMobile;
    initializeAccordions();
  }
});

// Initialize on load
initializeAccordions();

// ==================== Profile ====================

async function loadProfileInfo() {
  if (!currentUser) return;

  // Display email
  profileEmail.textContent = currentUser.email;

  // Display member since date
  const createdAt = currentUser.metadata?.creationTime;
  if (createdAt) {
    const date = new Date(createdAt);
    profileCreated.textContent = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } else {
    profileCreated.textContent = 'Unknown';
  }

  // Load user profile data from Firestore (with caching)
  try {
    userProfileData = await getCachedUserProfile(
      async () => {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        return userDoc.exists() ? userDoc.data() : {};
      },
      currentUser.uid
    );
  } catch (e) {
    userProfileData = {};
  }

  // Update avatar display
  await updateAvatarDisplay();
}

async function updateAvatarDisplay() {
  const initial = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : '?';

  // Helper to safely set avatar image
  const setAvatarImage = (container, url, alt) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.className = 'w-full h-full object-cover';
    container.innerHTML = '';
    container.appendChild(img);
  };

  // Priority: uploaded photo > Gravatar > initial
  if (userProfileData?.photoUrl) {
    // User has uploaded photo
    setAvatarImage(profileAvatar, userProfileData.photoUrl, 'Profile');
  } else {
    // Try Gravatar
    const gravatarUrl = getGravatarUrl(currentUser.email, 160);
    try {
      const response = await fetch(gravatarUrl, { method: 'HEAD' });
      if (response.ok) {
        setAvatarImage(profileAvatar, gravatarUrl, 'Profile');
      } else {
        throw new Error('No Gravatar');
      }
    } catch (e) {
      // Fall back to initial
      profileAvatar.innerHTML = '';
      profileAvatar.textContent = initial;
    }
  }
}

// Photo Upload
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

uploadPhotoBtn.addEventListener('click', () => {
  photoInput.click();
});

photoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast('Please select a JPG, PNG, or WebP image', { type: 'error' });
    photoInput.value = '';
    return;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showToast('Image must be less than 500KB', { type: 'error' });
    photoInput.value = '';
    return;
  }

  uploadPhotoBtn.disabled = true;
  uploadPhotoBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>';

  try {
    // Convert to base64
    const base64 = await fileToBase64(file);

    // Save to Firestore
    await setDoc(doc(db, 'users', currentUser.uid), {
      photoUrl: base64
    }, { merge: true });

    userProfileData = { ...userProfileData, photoUrl: base64 };
    clearUserProfileCache(); // Clear cache so header will refetch
    await updateAvatarDisplay();
    updatePhotoPreview();

    showToast('Profile photo updated!', { type: 'success' });
    closePhotoModal();
  } catch (error) {
    console.error('Error uploading photo:', error);
    showToast('Error uploading photo', { type: 'error' });
  } finally {
    uploadPhotoBtn.disabled = false;
    uploadPhotoBtn.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i><span>Upload</span>';
    initIcons();
    photoInput.value = '';
  }
});

removePhotoBtn.addEventListener('click', async () => {
  removePhotoBtn.disabled = true;
  removePhotoBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>';

  try {
    // Remove from Firestore
    await setDoc(doc(db, 'users', currentUser.uid), {
      photoUrl: null
    }, { merge: true });

    userProfileData = { ...userProfileData, photoUrl: null };
    clearUserProfileCache(); // Clear cache so header will refetch
    await updateAvatarDisplay();
    updatePhotoPreview();

    showToast('Profile photo removed', { type: 'success' });
  } catch (error) {
    console.error('Error removing photo:', error);
    showToast('Error removing photo', { type: 'error' });
  } finally {
    removePhotoBtn.disabled = false;
    removePhotoBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i><span>Remove</span>';
    initIcons();
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Photo Modal
function openPhotoModal() {
  // Sync photo preview with current state
  updatePhotoPreview();
  photoModal.classList.remove('hidden');
  lockBodyScroll();
  initIcons();
}

function closePhotoModal() {
  photoModal.classList.add('hidden');
  unlockBodyScroll();
}

function updatePhotoPreview() {
  // Helper to safely set preview image
  const setPreviewImage = (url, alt) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.className = 'w-full h-full object-cover';
    photoPreview.innerHTML = '';
    photoPreview.appendChild(img);
  };

  if (userProfileData?.photoUrl) {
    setPreviewImage(userProfileData.photoUrl, 'Profile');
    removePhotoBtn.classList.remove('hidden');
  } else if (currentUser) {
    const gravatarUrl = getGravatarUrl(currentUser.email, 160);
    // Check if we have a cached Gravatar response
    fetch(gravatarUrl, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          setPreviewImage(gravatarUrl, 'Gravatar');
        } else {
          photoPreview.innerHTML = '<i data-lucide="user" class="w-10 h-10 text-gray-400"></i>';
          initIcons();
        }
      })
      .catch(() => {
        photoPreview.innerHTML = '<i data-lucide="user" class="w-10 h-10 text-gray-400"></i>';
        initIcons();
      });
    removePhotoBtn.classList.add('hidden');
  }
}

editAvatarBtn.addEventListener('click', openPhotoModal);
closePhotoModalBtn.addEventListener('click', closePhotoModal);
photoModal.addEventListener('click', (e) => {
  if (e.target === photoModal) closePhotoModal();
});

// Change Password
changePasswordBtn.addEventListener('click', () => {
  currentPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmPasswordInput.value = '';
  // Reset password strength UI
  updateNewPasswordUI('');
  passwordModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) currentPasswordInput.focus();
});

cancelPasswordBtn.addEventListener('click', () => {
  passwordModal.classList.add('hidden');
  unlockBodyScroll();
});

passwordModal.addEventListener('click', (e) => {
  if (e.target === passwordModal) {
    passwordModal.classList.add('hidden');
    unlockBodyScroll();
  }
});

// checkPasswordStrength imported from utils.js

function updateNewPasswordUI(password) {
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
  newStrengthText.className = 'text-xs';
  if (score === 1) newStrengthText.classList.add('text-red-500');
  else if (score === 2) newStrengthText.classList.add('text-orange-500');
  else if (score === 3) newStrengthText.classList.add('text-yellow-600');
  else if (score === 4) newStrengthText.classList.add('text-green-500');
}

function updateRequirement(element, met) {
  if (!element) return;
  const icon = element.querySelector('i');
  if (met) {
    element.classList.remove('text-gray-400');
    element.classList.add('text-green-500');
    if (icon) icon.setAttribute('data-lucide', 'check-circle');
  } else {
    element.classList.remove('text-green-500');
    element.classList.add('text-gray-400');
    if (icon) icon.setAttribute('data-lucide', 'circle');
  }
  initIcons();
}

newPasswordInput?.addEventListener('input', (e) => {
  updateNewPasswordUI(e.target.value);
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', { type: 'error' });
    return;
  }

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', { type: 'error' });
    return;
  }

  savePasswordBtn.disabled = true;
  savePasswordBtn.textContent = 'Updating...';

  try {
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);

    // Update password
    await updatePassword(currentUser, newPassword);

    showToast('Password updated successfully!', { type: 'success' });
    passwordModal.classList.add('hidden');
    unlockBodyScroll();
  } catch (error) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      showToast('Current password is incorrect', { type: 'error' });
    } else if (error.code === 'auth/weak-password') {
      showToast('New password is too weak', { type: 'error' });
    } else {
      console.error('Error updating password:', error);
      showToast('Error updating password', { type: 'error' });
    }
  } finally {
    savePasswordBtn.disabled = false;
    savePasswordBtn.textContent = 'Update Password';
  }
});

// Privacy Settings (placeholder)
privacySettingsBtn.addEventListener('click', () => {
  showToast('Privacy settings coming soon!', { type: 'info' });
});

// Delete Account
deleteAccountBtn.addEventListener('click', () => {
  deleteConfirmPasswordInput.value = '';
  deleteConfirmTextInput.value = '';
  deleteAccountModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) deleteConfirmPasswordInput.focus();
});

cancelDeleteAccountBtn.addEventListener('click', () => {
  deleteAccountModal.classList.add('hidden');
  unlockBodyScroll();
});

deleteAccountModal.addEventListener('click', (e) => {
  if (e.target === deleteAccountModal) {
    deleteAccountModal.classList.add('hidden');
    unlockBodyScroll();
  }
});

deleteAccountForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = deleteConfirmPasswordInput.value;
  const confirmText = deleteConfirmTextInput.value;

  if (confirmText !== 'DELETE') {
    showToast('Please type DELETE to confirm', { type: 'error' });
    return;
  }

  confirmDeleteAccountBtn.disabled = true;
  confirmDeleteAccountBtn.textContent = 'Deleting...';

  try {
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    // Delete all user data from Firestore
    const userId = currentUser.uid;

    // Delete all books
    const booksRef = collection(db, 'users', userId, 'books');
    const booksSnapshot = await getDocs(booksRef);
    const batch1 = writeBatch(db);
    booksSnapshot.docs.forEach(bookDoc => {
      batch1.delete(bookDoc.ref);
    });
    if (booksSnapshot.docs.length > 0) {
      await batch1.commit();
    }

    // Delete all genres
    const genresRef = collection(db, 'users', userId, 'genres');
    const genresSnapshot = await getDocs(genresRef);
    const batch2 = writeBatch(db);
    genresSnapshot.docs.forEach(genreDoc => {
      batch2.delete(genreDoc.ref);
    });
    if (genresSnapshot.docs.length > 0) {
      await batch2.commit();
    }

    // Delete the user document if it exists
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      // User document may not exist, ignore error
    }

    // Delete the Firebase Auth user
    await deleteUser(currentUser);

    // Clear local storage
    localStorage.clear();

    showToast('Account deleted successfully', { type: 'success' });

    // Redirect to login
    setTimeout(() => {
      window.location.href = '/login/';
    }, 1500);
  } catch (error) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      showToast('Incorrect password', { type: 'error' });
    } else {
      console.error('Error deleting account:', error);
      showToast('Error deleting account', { type: 'error' });
    }
    confirmDeleteAccountBtn.disabled = false;
    confirmDeleteAccountBtn.textContent = 'Delete Account';
  }
});

// ==================== Genres ====================

async function loadGenres() {
  try {
    genres = await loadUserGenres(currentUser.uid, true);
    renderGenres();
  } catch (error) {
    console.error('Error loading genres:', error);
    showToast('Error loading genres', { type: 'error' });
  }
}

function renderGenres() {
  genresLoading.classList.add('hidden');

  if (genres.length === 0) {
    genresEmpty.classList.remove('hidden');
    genreList.innerHTML = '';
    initIcons();
    return;
  }

  genresEmpty.classList.add('hidden');

  genreList.innerHTML = genres.map(genre => {
    const textColor = getContrastColor(genre.color);
    return `
      <div class="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <span class="genre-badge" style="background-color: ${genre.color}; color: ${textColor}">${escapeHtml(genre.name)}</span>
        <span class="text-sm text-gray-500 flex-1">${genre.bookCount || 0} book${(genre.bookCount || 0) !== 1 ? 's' : ''}</span>
        <button class="edit-btn p-2 hover:bg-gray-100 rounded-lg text-gray-500" data-id="${genre.id}" title="Edit">
          <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
        <button class="delete-btn p-2 hover:bg-red-50 rounded-lg text-red-500" data-id="${genre.id}" data-name="${escapeHtml(genre.name)}" data-count="${genre.bookCount || 0}" title="Delete">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');

  // Attach event listeners
  genreList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  genreList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name, parseInt(btn.dataset.count)));
  });

  initIcons();
}

function renderColorPicker() {
  const usedColors = getUsedColors(genres, editingGenreId);

  colorPicker.innerHTML = GENRE_COLORS.map(color => {
    const isSelected = color.toLowerCase() === selectedColor?.toLowerCase();
    const isUsed = usedColors.has(color.toLowerCase());
    const textColor = getContrastColor(color);

    if (isUsed) {
      return `
        <button type="button" class="color-btn w-8 h-8 rounded-full border-2 border-transparent opacity-30 cursor-not-allowed relative"
          style="background-color: ${color}" disabled title="Already in use">
          <i data-lucide="x" class="w-4 h-4 mx-auto" style="color: ${textColor}"></i>
        </button>
      `;
    }

    return `
      <button type="button" class="color-btn w-8 h-8 rounded-full border-2 ${isSelected ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-transparent'} hover:scale-110 transition-transform"
        style="background-color: ${color}" data-color="${color}">
        ${isSelected ? `<i data-lucide="check" class="w-4 h-4 mx-auto" style="color: ${textColor}"></i>` : ''}
      </button>
    `;
  }).join('');

  colorPicker.querySelectorAll('.color-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      renderColorPicker();
    });
  });

  initIcons();
}

function openAddModal() {
  editingGenreId = null;
  modalTitle.textContent = 'Add Genre';
  genreNameInput.value = '';
  const availableColors = getAvailableColors(genres);
  selectedColor = availableColors[0] || GENRE_COLORS[0];
  saveGenreBtn.textContent = 'Add';
  renderColorPicker();
  genreModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) genreNameInput.focus();
}

function openEditModal(genreId) {
  const genre = genres.find(g => g.id === genreId);
  if (!genre) return;

  editingGenreId = genreId;
  modalTitle.textContent = 'Edit Genre';
  genreNameInput.value = genre.name;
  selectedColor = genre.color;
  saveGenreBtn.textContent = 'Save';
  renderColorPicker();
  genreModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) genreNameInput.focus();
}

function closeModal() {
  genreModal.classList.add('hidden');
  unlockBodyScroll();
  editingGenreId = null;
}

let deletingGenreId = null;

function openDeleteModal(genreId, name, bookCount) {
  deletingGenreId = genreId;
  deleteMessage.textContent = bookCount > 0
    ? `This will remove "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
    : `Are you sure you want to delete "${name}"?`;
  deleteModal.classList.remove('hidden');
  lockBodyScroll();
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  unlockBodyScroll();
  deletingGenreId = null;
}

// Genre Event Listeners
addGenreBtn.addEventListener('click', openAddModal);
cancelGenreBtn.addEventListener('click', closeModal);
genreModal.addEventListener('click', (e) => {
  if (e.target === genreModal) closeModal();
});
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

genreForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = genreNameInput.value.trim();
  if (!name) {
    showToast('Please enter a genre name', { type: 'error' });
    return;
  }

  saveGenreBtn.disabled = true;
  saveGenreBtn.textContent = 'Saving...';

  try {
    if (editingGenreId) {
      await updateGenre(currentUser.uid, editingGenreId, { name, color: selectedColor });
      showToast('Genre updated!', { type: 'success' });
    } else {
      await createGenre(currentUser.uid, name, selectedColor);
      showToast('Genre created!', { type: 'success' });
    }

    closeModal();
    clearGenresCache();
    await loadGenres();
  } catch (error) {
    console.error('Error saving genre:', error);
    showToast(error.message || 'Error saving genre', { type: 'error' });
  } finally {
    saveGenreBtn.disabled = false;
    saveGenreBtn.textContent = editingGenreId ? 'Save' : 'Add';
  }
});

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deletingGenreId) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting...';

  try {
    const booksUpdated = await deleteGenre(currentUser.uid, deletingGenreId);

    if (booksUpdated > 0) {
      clearBooksCache(currentUser.uid);
    }

    showToast('Genre deleted', { type: 'success' });
    closeDeleteModal();
    clearGenresCache();
    await loadGenres();
  } catch (error) {
    console.error('Error deleting genre:', error);
    showToast('Error deleting genre', { type: 'error' });
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Delete';
  }
});

// ==================== Export ====================

async function loadAllBooks() {
  if (allBooksLoaded) return;

  // Try cache first
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const cachedBooks = parsed.books || parsed || [];
      const hasMore = parsed.hasMore ?? true;

      if (cachedBooks.length > 0 && !hasMore) {
        books = cachedBooks;
        allBooksLoaded = true;
        return;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }

  // Fetch from Firebase
  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const q = query(booksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    books = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt)
      };
    });
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books:', error);
    throw error;
  }
}

async function exportBooks() {
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Loading...';

  try {
    await loadAllBooks();

    if (books.length === 0) {
      showToast('No books to export', { type: 'error' });
      return;
    }

    const data = books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mybookshelf-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('Books exported!', { type: 'success' });
  } catch (error) {
    console.error('Error exporting books:', error);
    showToast('Error exporting books', { type: 'error' });
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i><span>Download Backup</span>';
    initIcons();
  }
}

exportBtn.addEventListener('click', exportBooks);

// ==================== Data Cleanup ====================

async function runGenreCleanup() {
  cleanupGenresBtn.disabled = true;
  cleanupGenresBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Processing...';
  cleanupProgress.classList.remove('hidden');
  cleanupResults.classList.add('hidden');
  cleanupProgressBar.style.width = '0%';

  try {
    const results = await migrateGenreData(currentUser.uid, (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      cleanupProgressBar.style.width = `${percent}%`;
      cleanupStatus.textContent = `Processing book ${processed} of ${total}...`;
    });

    // Show results
    cleanupProgress.classList.add('hidden');
    cleanupResults.classList.remove('hidden');

    if (results.booksUpdated === 0 && results.genresCreated === 0) {
      cleanupResultsText.textContent = 'No issues found. All genre references are valid.';
      showToast('Data is clean!', { type: 'success' });
      // Auto-hide success message after 5 seconds
      setTimeout(() => cleanupResults.classList.add('hidden'), 5000);
    } else {
      const parts = [];
      if (results.booksUpdated > 0) {
        parts.push(`${results.booksUpdated} book${results.booksUpdated !== 1 ? 's' : ''} updated`);
      }
      if (results.genresCreated > 0) {
        parts.push(`${results.genresCreated} genre${results.genresCreated !== 1 ? 's' : ''} created`);
      }
      cleanupResultsText.textContent = parts.join(', ') + '.';

      if (results.errors.length > 0) {
        cleanupResultsText.textContent += ` ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''} occurred.`;
        console.error('Cleanup errors:', results.errors);
      }

      showToast('Cleanup complete!', { type: 'success' });

      // Clear caches and reload genres
      clearBooksCache(currentUser.uid);
      clearGenresCache();
      await loadGenres();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    cleanupProgress.classList.add('hidden');
    cleanupResults.classList.remove('hidden');
    cleanupResultsText.textContent = `Error: ${error.message}`;
    showToast('Cleanup failed', { type: 'error' });
  } finally {
    cleanupGenresBtn.disabled = false;
    cleanupGenresBtn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i><span>Run Cleanup</span>';
    initIcons();
  }
}

cleanupGenresBtn.addEventListener('click', runGenreCleanup);

async function runRecountGenres() {
  recountGenresBtn.disabled = true;
  recountGenresBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Counting...';
  recountResults.classList.add('hidden');

  try {
    const results = await recalculateGenreBookCounts(currentUser.uid);

    recountResults.classList.remove('hidden');

    if (results.genresUpdated === 0) {
      recountResultsText.textContent = 'All genre counts are correct.';
      showToast('Counts verified!', { type: 'success' });
      // Auto-hide success message after 5 seconds
      setTimeout(() => recountResults.classList.add('hidden'), 5000);
    } else {
      recountResultsText.textContent = `Updated ${results.genresUpdated} genre${results.genresUpdated !== 1 ? 's' : ''} after scanning ${results.totalBooks} books.`;
      showToast('Counts updated!', { type: 'success' });

      // Reload genres to show updated counts
      clearGenresCache();
      await loadGenres();
    }
  } catch (error) {
    console.error('Error recounting genres:', error);
    recountResults.classList.remove('hidden');
    recountResultsText.textContent = `Error: ${error.message}`;
    showToast('Recount failed', { type: 'error' });
  } finally {
    recountGenresBtn.disabled = false;
    recountGenresBtn.innerHTML = '<i data-lucide="calculator" class="w-4 h-4"></i><span>Recalculate Counts</span>';
    initIcons();
  }
}

recountGenresBtn.addEventListener('click', runRecountGenres);

// ==================== Home Content Settings ====================

const HOME_SETTINGS_KEY = 'homeSettings';

// Default home settings
const DEFAULT_HOME_SETTINGS = {
  currentlyReading: { enabled: true, count: 6 },
  recentlyAdded: { enabled: true, count: 6 },
  topRated: { enabled: true, count: 6 },
  recentlyFinished: { enabled: true, count: 6 },
  recommendations: { enabled: true, count: 6 }
};

// Load home settings from localStorage
function loadHomeSettings() {
  try {
    const stored = localStorage.getItem(HOME_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_HOME_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Error loading home settings:', e);
  }
  return { ...DEFAULT_HOME_SETTINGS };
}

// Save home settings to localStorage
function saveHomeSettings(settings) {
  try {
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Error saving home settings:', e);
  }
}

// Export for home.js to use
export function getHomeSettings() {
  return loadHomeSettings();
}

// Initialize content settings UI
function initContentSettings() {
  const settings = loadHomeSettings();
  const sections = ['currentlyReading', 'recentlyAdded', 'topRated', 'recentlyFinished', 'recommendations'];

  sections.forEach(section => {
    const toggle = document.getElementById(`toggle-${section}`);
    const countSelect = document.getElementById(`count-${section}`);

    if (toggle) {
      toggle.checked = settings[section]?.enabled ?? true;
      toggle.addEventListener('change', () => {
        const currentSettings = loadHomeSettings();
        currentSettings[section] = {
          ...currentSettings[section],
          enabled: toggle.checked
        };
        saveHomeSettings(currentSettings);
        showToast('Settings saved', { type: 'success' });
      });
    }

    if (countSelect) {
      countSelect.value = String(settings[section]?.count ?? 6);
      countSelect.addEventListener('change', () => {
        const currentSettings = loadHomeSettings();
        currentSettings[section] = {
          ...currentSettings[section],
          count: parseInt(countSelect.value, 10)
        };
        saveHomeSettings(currentSettings);
        showToast('Settings saved', { type: 'success' });
      });
    }
  });
}

// Initialize content settings on load
initContentSettings();
