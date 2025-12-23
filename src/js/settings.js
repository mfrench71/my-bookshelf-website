// Settings Page Logic
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendEmailVerification
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
  writeBatch,
  serverTimestamp
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
import { showToast, initIcons, getContrastColor, escapeHtml, clearBooksCache, CACHE_KEY, serializeTimestamp, getCachedUserProfile, clearUserProfileCache, checkPasswordStrength, lockBodyScroll, unlockBodyScroll, isMobile, getHomeSettings, saveHomeSettings, lookupISBN } from './utils.js';
import { md5, getGravatarUrl } from './md5.js';
import { loadWidgetSettings, saveWidgetSettings, reorderWidgets } from './utils/widget-settings.js';
import { getWidgetInfo, WIDGET_SIZES } from './widgets/widget-renderer.js';
// Import widgets to ensure they're registered
import './widgets/index.js';

// Initialize icons once on load
initIcons();

// Ensure icons are initialized after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  // DOM already ready, call again to be safe
  setTimeout(initIcons, 0);
}

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

// DOM Elements - Backup & Restore
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file');
const importProgress = document.getElementById('import-progress');
const importStatus = document.getElementById('import-status');

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

// DOM Elements - Cover Fetch
const coverIsbnCount = document.getElementById('cover-isbn-count');
const coverMultiCount = document.getElementById('cover-multi-count');
const coverProgress = document.getElementById('cover-progress');
const coverStatus = document.getElementById('cover-status');
const coverProgressBar = document.getElementById('cover-progress-bar');
const coverResults = document.getElementById('cover-results');
const coverResultsText = document.getElementById('cover-results-text');
const fetchCoversBtn = document.getElementById('fetch-covers-btn');

// DOM Elements - Profile
const profileAvatar = document.getElementById('profile-avatar');
const profileEmail = document.getElementById('profile-email');
const profileCreated = document.getElementById('profile-created');
const changePasswordBtn = document.getElementById('change-password-btn');
const editAvatarBtn = document.getElementById('edit-avatar-btn');
const privacySettingsBtn = document.getElementById('privacy-settings-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// DOM Elements - Email Verification
const emailVerificationSection = document.getElementById('email-verification-section');
const verificationIcon = document.getElementById('verification-icon');
const verificationStatus = document.getElementById('verification-status');
const resendVerificationSettingsBtn = document.getElementById('resend-verification-settings-btn');

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
        // Expand profile section
        content?.classList.remove('hidden');
        icon?.classList.add('rotate-180');
      } else {
        // Collapse other sections
        content?.classList.add('hidden');
        icon?.classList.remove('rotate-180');
      }
    });
  } else {
    // On desktop: ensure all accordion content is visible (expanded)
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

// ==================== Changelog Accordions ====================

function initChangelogAccordions() {
  const changelogBtns = document.querySelectorAll('.changelog-date-btn');

  changelogBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      const chevron = btn.querySelector('.changelog-chevron');

      if (!content) return;

      const isExpanded = !content.classList.contains('hidden');

      if (isExpanded) {
        // Collapse
        content.classList.add('hidden');
        chevron?.classList.remove('rotate-180');
      } else {
        // Expand
        content.classList.remove('hidden');
        chevron?.classList.add('rotate-180');
      }
    });
  });
}

// Initialize changelog accordions
initChangelogAccordions();

// ==================== Profile ====================

async function loadProfileInfo() {
  if (!currentUser) return;

  const profileLoading = document.getElementById('profile-loading');
  const profileContent = document.getElementById('profile-content');

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

  // Update email verification status
  updateVerificationStatus();

  // Hide loading, show content
  profileLoading?.classList.add('hidden');
  profileContent?.classList.remove('hidden');
}

function updateVerificationStatus() {
  if (!emailVerificationSection) return;

  emailVerificationSection.classList.remove('hidden');

  if (currentUser.emailVerified) {
    verificationIcon.setAttribute('data-lucide', 'mail-check');
    verificationIcon.setAttribute('class', 'w-5 h-5 text-green-600');
    verificationStatus.textContent = 'Your email is verified';
    resendVerificationSettingsBtn.classList.add('hidden');
  } else {
    verificationIcon.setAttribute('data-lucide', 'mail-warning');
    verificationIcon.setAttribute('class', 'w-5 h-5 text-amber-600');
    verificationStatus.textContent = 'Not verified - check your inbox';
    resendVerificationSettingsBtn.classList.remove('hidden');
  }
  initIcons();
}

// Resend verification email from settings
resendVerificationSettingsBtn?.addEventListener('click', async () => {
  if (!currentUser) return;

  const btnText = resendVerificationSettingsBtn.querySelector('span');
  resendVerificationSettingsBtn.disabled = true;
  if (btnText) btnText.textContent = 'Sending...';

  try {
    await sendEmailVerification(currentUser);
    if (btnText) btnText.textContent = 'Sent!';
    showToast('Verification email sent!', { type: 'success' });
    setTimeout(() => {
      if (btnText) btnText.textContent = 'Resend';
      resendVerificationSettingsBtn.disabled = false;
    }, 3000);
  } catch (error) {
    console.error('Error sending verification email:', error);
    if (error.code === 'auth/too-many-requests') {
      showToast('Please wait before resending', { type: 'error' });
    } else {
      showToast('Error sending email', { type: 'error' });
    }
    if (btnText) btnText.textContent = 'Resend';
    resendVerificationSettingsBtn.disabled = false;
  }
});

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
  if (met) {
    element.classList.remove('text-gray-400');
    element.classList.add('text-green-500');
  } else {
    element.classList.remove('text-green-500');
    element.classList.add('text-gray-400');
  }
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

// ==================== Backup & Restore ====================

/**
 * Load all books from cache or Firebase for export/import operations.
 * Uses the existing books cache if available, otherwise fetches from Firestore.
 * @returns {Promise<void>} Populates the module-level `books` array
 */
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
    console.warn('Cache read error in settings:', e.message);
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

/**
 * Export all user data (books and genres) as a JSON backup file.
 * Creates a versioned backup format with genre ID mappings for cross-account restoration.
 *
 * Export format:
 * {
 *   version: 1,
 *   exportedAt: ISO timestamp,
 *   genres: [...genre objects with _exportId],
 *   books: [...book objects]
 * }
 *
 * @returns {Promise<void>} Downloads a JSON file named mybookshelf-backup-{date}.json
 */
async function exportBackup() {
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Loading...';

  try {
    await loadAllBooks();

    if (books.length === 0 && genres.length === 0) {
      showToast('No data to export', { type: 'error' });
      return;
    }

    // Prepare export data
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      genres: genres.map(({ id, ...genre }) => ({ ...genre, _exportId: id })),
      books: books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book)
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mybookshelf-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast(`Exported ${books.length} books and ${genres.length} genres`);
  } catch (error) {
    console.error('Error exporting backup:', error);
    showToast('Error exporting backup', { type: 'error' });
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i><span>Download Backup</span>';
    initIcons();
  }
}

exportBtn.addEventListener('click', exportBackup);

/**
 * Import a backup file and restore books and genres to the current user's account.
 *
 * Import process:
 * 1. Parse and validate JSON (must be version 1 format)
 * 2. Import genres first (skip existing by name, create new with ID mapping)
 * 3. Import books with remapped genre IDs
 * 4. Skip duplicate books (by ISBN or title+author match)
 * 5. Recalculate genre book counts
 *
 * @param {File} file - The JSON backup file to import
 * @returns {Promise<void>} Reloads the page on success
 * @throws {Error} If file is invalid, empty, or has unrecognized format
 */
async function importBackup(file) {
  importBtn.disabled = true;
  importProgress.classList.remove('hidden');
  importStatus.textContent = 'Reading file...';

  try {
    const text = await file.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON file');
    }

    // Validate backup format
    if (!data.version || data.version !== 1) {
      throw new Error('Unrecognized backup format');
    }

    const importGenres = data.genres || [];
    const importBooks = data.books || [];

    if (importBooks.length === 0 && importGenres.length === 0) {
      throw new Error('Backup file is empty');
    }

    // Load existing data to check for duplicates
    importStatus.textContent = 'Checking for duplicates...';
    await loadAllBooks();
    const existingGenres = await loadUserGenres(currentUser.uid);

    // Build genre ID mapping (old export ID -> new Firestore ID)
    const genreIdMap = new Map();
    let genresImported = 0;
    let genresSkipped = 0;

    // Import genres first
    if (importGenres.length > 0) {
      importStatus.textContent = 'Importing genres...';

      for (const genre of importGenres) {
        // Check if genre with same name already exists
        const existingGenre = existingGenres.find(g => g.name.toLowerCase() === genre.name.toLowerCase());

        if (existingGenre) {
          // Map old ID to existing genre ID
          genreIdMap.set(genre._exportId, existingGenre.id);
          genresSkipped++;
        } else {
          // Create new genre
          const newGenre = await createGenre(currentUser.uid, genre.name, genre.color);
          genreIdMap.set(genre._exportId, newGenre.id);
          genresImported++;
        }
      }
    }

    // Import books using batch writes for better performance
    let booksImported = 0;
    let booksSkipped = 0;

    if (importBooks.length > 0) {
      importStatus.textContent = 'Importing books...';

      const booksRef = collection(db, 'users', currentUser.uid, 'books');

      // Collect books to import (filter duplicates first)
      const booksToImport = [];
      for (const book of importBooks) {
        // Check for duplicates by ISBN or title+author
        const isDuplicate = books.some(existing => {
          if (book.isbn && existing.isbn && book.isbn === existing.isbn) return true;
          if (book.title && existing.title &&
              book.title.toLowerCase() === existing.title.toLowerCase() &&
              (book.author || '').toLowerCase() === (existing.author || '').toLowerCase()) return true;
          return false;
        });

        if (isDuplicate) {
          booksSkipped++;
          continue;
        }

        // Remap genre IDs
        let remappedGenres = [];
        if (book.genres && Array.isArray(book.genres)) {
          remappedGenres = book.genres
            .map(oldId => genreIdMap.get(oldId))
            .filter(id => id); // Remove any unmapped genres
        }

        // Prepare book data
        const bookData = { ...book };
        delete bookData.createdAt;
        delete bookData.updatedAt;

        booksToImport.push({
          ...bookData,
          genres: remappedGenres
        });
      }

      // Import in batches of 500 (Firestore limit)
      const BATCH_SIZE = 500;
      for (let i = 0; i < booksToImport.length; i += BATCH_SIZE) {
        const batchBooks = booksToImport.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const bookData of batchBooks) {
          const docRef = doc(booksRef);
          batch.set(docRef, {
            ...bookData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        booksImported += batchBooks.length;
        importStatus.textContent = `Importing books... ${booksImported}/${booksToImport.length}`;
      }
    }

    // Clear caches and refresh
    clearBooksCache(currentUser.uid);
    clearGenresCache();

    // Recalculate genre book counts
    if (genresImported > 0 || booksImported > 0) {
      importStatus.textContent = 'Updating genre counts...';
      await recalculateGenreBookCounts(currentUser.uid);
    }

    // Show results
    const results = [];
    if (booksImported > 0) results.push(`${booksImported} books`);
    if (genresImported > 0) results.push(`${genresImported} genres`);

    const skipped = [];
    if (booksSkipped > 0) skipped.push(`${booksSkipped} duplicate books`);
    if (genresSkipped > 0) skipped.push(`${genresSkipped} existing genres`);

    let message = `Imported ${results.join(' and ') || 'nothing'}`;
    if (skipped.length > 0) message += `. Skipped ${skipped.join(', ')}`;

    showToast(message);

    // Reload page to show new data
    setTimeout(() => window.location.reload(), 1500);

  } catch (error) {
    console.error('Error importing backup:', error);
    showToast(error.message || 'Error importing backup', { type: 'error' });
    importProgress.classList.add('hidden');
  } finally {
    importBtn.disabled = false;
    importFileInput.value = '';
  }
}

// Import button click handler
importBtn.addEventListener('click', () => {
  importFileInput.click();
});

// File input change handler
importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    importBackup(file);
  }
});

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

// ==================== Cover Fetch ====================

/**
 * Update cover statistics display showing books with ISBNs and multiple covers.
 */
async function updateCoverStats() {
  if (!coverIsbnCount || !coverMultiCount) return;

  const coverStatsLoading = document.getElementById('cover-stats-loading');
  const coverStats = document.getElementById('cover-stats');

  try {
    await loadAllBooks();

    const booksWithIsbn = books.filter(b => b.isbn);
    const booksWithMultipleCovers = books.filter(b => {
      if (!b.covers) return false;
      const coverCount = Object.values(b.covers).filter(url => url).length;
      return coverCount > 1;
    });

    coverIsbnCount.textContent = booksWithIsbn.length;
    coverMultiCount.textContent = booksWithMultipleCovers.length;
  } catch (error) {
    console.error('Error updating cover stats:', error);
    coverIsbnCount.textContent = '-';
    coverMultiCount.textContent = '-';
  }

  // Hide loading, show content
  coverStatsLoading?.classList.add('hidden');
  coverStats?.classList.remove('hidden');
}

/**
 * Bulk fetch covers for all books with ISBNs.
 * Calls lookupISBN for each book and stores available covers.
 * Rate-limited to avoid API throttling.
 */
async function runFetchCovers() {
  fetchCoversBtn.disabled = true;
  fetchCoversBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Fetching...';
  coverProgress.classList.remove('hidden');
  coverResults.classList.add('hidden');
  coverProgressBar.style.width = '0%';

  try {
    await loadAllBooks();

    const booksWithIsbn = books.filter(b => b.isbn);

    if (booksWithIsbn.length === 0) {
      coverProgress.classList.add('hidden');
      coverResults.classList.remove('hidden');
      coverResultsText.textContent = 'No books with ISBNs found.';
      showToast('No books with ISBNs to process', { type: 'info' });
      return;
    }

    let processed = 0;
    let updated = 0;
    let newCoversFound = 0;
    const updatedBooks = []; // Track which books were updated

    const booksRef = collection(db, 'users', currentUser.uid, 'books');

    for (const book of booksWithIsbn) {
      processed++;
      const percent = Math.round((processed / booksWithIsbn.length) * 100);
      coverProgressBar.style.width = `${percent}%`;
      coverStatus.textContent = `Processing ${processed} of ${booksWithIsbn.length}...`;

      try {
        // Fetch fresh cover data from APIs
        const result = await lookupISBN(book.isbn, { skipCache: true });

        if (result && result.covers) {
          const existingCovers = book.covers || {};
          const newCovers = result.covers;

          // Check if we found new covers
          const hasNewGoogle = newCovers.googleBooks && !existingCovers.googleBooks;
          const hasNewOpenLibrary = newCovers.openLibrary && !existingCovers.openLibrary;

          if (hasNewGoogle || hasNewOpenLibrary) {
            newCoversFound++;
          }

          // Merge covers (keep existing, add new)
          const mergedCovers = {
            ...existingCovers,
            ...newCovers
          };

          // Only update if covers changed
          const coversChanged =
            (mergedCovers.googleBooks !== existingCovers.googleBooks) ||
            (mergedCovers.openLibrary !== existingCovers.openLibrary);

          if (coversChanged) {
            await setDoc(doc(booksRef, book.id), {
              covers: mergedCovers,
              updatedAt: serverTimestamp()
            }, { merge: true });
            updated++;

            // Track updated book with details of what changed
            const sources = [];
            if (hasNewGoogle) sources.push('Google Books');
            if (hasNewOpenLibrary) sources.push('Open Library');
            updatedBooks.push({
              title: book.title,
              sources: sources.length > 0 ? sources : ['updated']
            });
          }
        }
      } catch (error) {
        console.warn(`Error fetching covers for book ${book.id}:`, error);
        // Continue with next book
      }

      // Rate limit: 500ms delay between API calls
      if (processed < booksWithIsbn.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Show results
    coverProgress.classList.add('hidden');
    coverResults.classList.remove('hidden');

    if (updated === 0) {
      coverResultsText.innerHTML = `Scanned ${processed} books. No new covers found.`;
      showToast('No new covers found', { type: 'info' });
    } else {
      // Build detailed results with list of updated books
      let html = `<p class="mb-2">Scanned ${processed} books. Updated ${updated} with new cover options.</p>`;
      html += `<ul class="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">`;
      for (const book of updatedBooks) {
        const sourcesText = book.sources.join(', ');
        html += `<li class="flex items-start gap-2">
          <i data-lucide="check" class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"></i>
          <span><strong>${escapeHtml(book.title)}</strong> <span class="text-gray-400">(${sourcesText})</span></span>
        </li>`;
      }
      html += `</ul>`;
      coverResultsText.innerHTML = html;
      initIcons();
      showToast(`Found ${newCoversFound} new covers!`, { type: 'success' });
    }

    // Clear cache and update stats
    clearBooksCache(currentUser.uid);
    allBooksLoaded = false;
    await updateCoverStats();

  } catch (error) {
    console.error('Error fetching covers:', error);
    coverProgress.classList.add('hidden');
    coverResults.classList.remove('hidden');
    coverResultsText.textContent = `Error: ${error.message}`;
    showToast('Cover fetch failed', { type: 'error' });
  } finally {
    fetchCoversBtn.disabled = false;
    fetchCoversBtn.innerHTML = '<i data-lucide="image" class="w-4 h-4"></i><span>Fetch Covers</span>';
    initIcons();
  }
}

fetchCoversBtn?.addEventListener('click', runFetchCovers);

// Update cover stats when cleanup section is visible
// (delayed to avoid unnecessary API calls on page load)
let coverStatsLoaded = false;
const cleanupSection = document.getElementById('cleanup-section');
const cleanupAccordion = document.querySelector('[data-accordion="cleanup"]');

function checkAndLoadCoverStats() {
  if (coverStatsLoaded) return;
  if (cleanupSection && !cleanupSection.classList.contains('hidden')) {
    coverStatsLoaded = true;
    updateCoverStats();
  }
}

// Check when switching to cleanup section (desktop)
document.querySelector('[data-section="cleanup"]')?.addEventListener('click', () => {
  setTimeout(checkAndLoadCoverStats, 100);
});

// Check when expanding cleanup accordion (mobile)
cleanupAccordion?.addEventListener('click', () => {
  setTimeout(checkAndLoadCoverStats, 100);
});

// ==================== Home Content Settings (Widget System) ====================

// DOM Elements - Widget Settings
const widgetsLoading = document.getElementById('widgets-loading');
const widgetSettingsList = document.getElementById('widget-settings-list');

// Widget settings state
let widgetSettings = null;

/**
 * Load and render widget settings
 */
async function loadAndRenderWidgetSettings() {
  if (!currentUser || !widgetSettingsList) return;

  try {
    widgetSettings = await loadWidgetSettings(currentUser.uid);
    renderWidgetSettings();
  } catch (error) {
    console.error('Error loading widget settings:', error);
    showToast('Error loading widget settings', { type: 'error' });
  }
}

/**
 * Render widget settings UI
 */
function renderWidgetSettings() {
  if (!widgetSettings || !widgetSettingsList) return;

  const widgetInfo = getWidgetInfo();
  const widgetInfoMap = new Map(widgetInfo.map(w => [w.id, w]));

  // Sort widgets by order
  const sortedWidgets = [...widgetSettings.widgets].sort((a, b) => a.order - b.order);

  widgetSettingsList.innerHTML = sortedWidgets.map((widget, index) => {
    const info = widgetInfoMap.get(widget.id);
    if (!info) return '';

    const isFirst = index === 0;
    const isLast = index === sortedWidgets.length - 1;

    return `
      <div class="bg-gray-50 rounded-xl p-4" data-widget-id="${widget.id}">
        <div class="flex items-center gap-3">
          <!-- Reorder Buttons -->
          <div class="flex flex-col gap-0.5">
            <button class="move-up-btn p-1 rounded hover:bg-gray-200 ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}"
                    data-id="${widget.id}" ${isFirst ? 'disabled' : ''} title="Move up">
              <i data-lucide="chevron-up" class="w-4 h-4 text-gray-500"></i>
            </button>
            <button class="move-down-btn p-1 rounded hover:bg-gray-200 ${isLast ? 'opacity-30 cursor-not-allowed' : ''}"
                    data-id="${widget.id}" ${isLast ? 'disabled' : ''} title="Move down">
              <i data-lucide="chevron-down" class="w-4 h-4 text-gray-500"></i>
            </button>
          </div>

          <!-- Widget Info -->
          <i data-lucide="${info.icon}" class="w-5 h-5 ${info.iconColor}"></i>
          <span class="font-medium text-gray-900 flex-1">${info.name}</span>

          <!-- Toggle -->
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="widget-toggle sr-only peer" data-id="${widget.id}" ${widget.enabled ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <!-- Settings Row -->
        <div class="flex items-center gap-4 mt-3 pl-10">
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600">Items:</label>
            <select class="widget-count px-2 py-1 border border-gray-300 rounded text-sm" data-id="${widget.id}">
              <option value="3" ${widget.settings?.count === 3 ? 'selected' : ''}>3</option>
              <option value="6" ${(widget.settings?.count || 6) === 6 ? 'selected' : ''}>6</option>
              <option value="9" ${widget.settings?.count === 9 ? 'selected' : ''}>9</option>
              <option value="12" ${widget.settings?.count === 12 ? 'selected' : ''}>12</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600">Size:</label>
            <select class="widget-size px-2 py-1 border border-gray-300 rounded text-sm" data-id="${widget.id}">
              ${WIDGET_SIZES.map(size => `
                <option value="${size.value}" ${widget.size === size.value ? 'selected' : ''}>${size.label}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Hide loading, show list
  widgetsLoading?.classList.add('hidden');
  widgetSettingsList.classList.remove('hidden');

  // Attach event listeners
  attachWidgetSettingsListeners();
  initIcons();
}

/**
 * Attach event listeners to widget settings controls
 */
function attachWidgetSettingsListeners() {
  // Toggle listeners
  widgetSettingsList.querySelectorAll('.widget-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const widgetId = e.target.dataset.id;
      const enabled = e.target.checked;
      await updateWidgetSetting(widgetId, { enabled });
    });
  });

  // Count select listeners
  widgetSettingsList.querySelectorAll('.widget-count').forEach(select => {
    select.addEventListener('change', async (e) => {
      const widgetId = e.target.dataset.id;
      const count = parseInt(e.target.value, 10);
      await updateWidgetSetting(widgetId, { settings: { count } });
    });
  });

  // Size select listeners
  widgetSettingsList.querySelectorAll('.widget-size').forEach(select => {
    select.addEventListener('change', async (e) => {
      const widgetId = e.target.dataset.id;
      const size = parseInt(e.target.value, 10);
      await updateWidgetSetting(widgetId, { size });
    });
  });

  // Move up listeners
  widgetSettingsList.querySelectorAll('.move-up-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const widgetId = btn.dataset.id;
      await moveWidget(widgetId, -1);
    });
  });

  // Move down listeners
  widgetSettingsList.querySelectorAll('.move-down-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const widgetId = btn.dataset.id;
      await moveWidget(widgetId, 1);
    });
  });
}

/**
 * Update a single widget setting
 */
async function updateWidgetSetting(widgetId, updates) {
  if (!widgetSettings || !currentUser) return;

  const widgetIndex = widgetSettings.widgets.findIndex(w => w.id === widgetId);
  if (widgetIndex === -1) return;

  // Update local state
  widgetSettings.widgets[widgetIndex] = {
    ...widgetSettings.widgets[widgetIndex],
    ...updates,
    settings: {
      ...widgetSettings.widgets[widgetIndex].settings,
      ...updates.settings
    }
  };

  try {
    await saveWidgetSettings(currentUser.uid, widgetSettings);
    showToast('Settings saved', { type: 'success' });
  } catch (error) {
    console.error('Error saving widget settings:', error);
    showToast('Error saving settings', { type: 'error' });
  }
}

/**
 * Move a widget up or down
 */
async function moveWidget(widgetId, direction) {
  if (!widgetSettings || !currentUser) return;

  const sortedWidgets = [...widgetSettings.widgets].sort((a, b) => a.order - b.order);
  const currentIndex = sortedWidgets.findIndex(w => w.id === widgetId);
  const newIndex = currentIndex + direction;

  if (newIndex < 0 || newIndex >= sortedWidgets.length) return;

  // Swap orders
  const orderedIds = sortedWidgets.map(w => w.id);
  [orderedIds[currentIndex], orderedIds[newIndex]] = [orderedIds[newIndex], orderedIds[currentIndex]];

  try {
    widgetSettings = await reorderWidgets(currentUser.uid, orderedIds);
    renderWidgetSettings();
    showToast('Order updated', { type: 'success' });
  } catch (error) {
    console.error('Error reordering widgets:', error);
    showToast('Error updating order', { type: 'error' });
  }
}

// Load widget settings when content section becomes visible
const contentSection = document.getElementById('content-section');
const contentNavBtn = document.querySelector('[data-section="content"]');
const contentAccordion = document.querySelector('[data-accordion="content"]');
let widgetSettingsLoaded = false;

function checkAndLoadWidgetSettings() {
  if (widgetSettingsLoaded || !currentUser) return;
  widgetSettingsLoaded = true;
  loadAndRenderWidgetSettings();
}

// Load when switching to content section (desktop)
contentNavBtn?.addEventListener('click', () => {
  setTimeout(checkAndLoadWidgetSettings, 100);
});

// Load when expanding content accordion (mobile)
contentAccordion?.addEventListener('click', () => {
  setTimeout(checkAndLoadWidgetSettings, 100);
});
