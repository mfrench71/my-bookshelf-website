// Profile Settings Page Logic
import { auth, db } from '/js/firebase-config.js';
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
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast, initIcons, getCachedUserProfile, clearUserProfileCache, checkPasswordStrength, isMobile } from '../utils.js';
import { validateForm, showFormErrors, clearFormErrors } from '../utils/validation.js';
import { ChangePasswordSchema, DeleteAccountSchema } from '../schemas/auth.js';
import { getGravatarUrl } from '../md5.js';
import { BottomSheet } from '../components/modal.js';

// Initialize icons once on load
initIcons();

// Ensure icons are initialized after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

// State
let currentUser = null;
let userProfileData = null;

// DOM Elements - Profile
const profileLoading = document.getElementById('profile-loading');
const profileContent = document.getElementById('profile-content');
const profileAvatar = document.getElementById('profile-avatar');
const profileEmail = document.getElementById('profile-email');
const profileCreated = document.getElementById('profile-created');
const editAvatarBtn = document.getElementById('edit-avatar-btn');
const changePasswordBtn = document.getElementById('change-password-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// DOM Elements - Email Verification
const emailVerificationSection = document.getElementById('email-verification-section');
const verificationIcon = document.getElementById('verification-icon');
const verificationStatus = document.getElementById('verification-status');
const resendVerificationBtn = document.getElementById('resend-verification-btn');

// DOM Elements - Photo Modal
const photoModal = document.getElementById('photo-modal');
const photoPreview = document.getElementById('photo-preview');
const photoInput = document.getElementById('photo-input');
const uploadPhotoBtn = document.getElementById('upload-photo-btn');
const removePhotoBtn = document.getElementById('remove-photo-btn');
const closePhotoModalBtn = document.getElementById('close-photo-modal');

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

// Photo upload constants
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Bottom Sheet Instances
const photoSheet = photoModal ? new BottomSheet({ container: photoModal }) : null;
const passwordSheet = passwordModal ? new BottomSheet({ container: passwordModal }) : null;
const deleteAccountSheet = deleteAccountModal ? new BottomSheet({ container: deleteAccountModal }) : null;

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadProfileInfo();
  }
});

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
    resendVerificationBtn?.classList.add('hidden');
  } else {
    verificationIcon.setAttribute('data-lucide', 'mail-warning');
    verificationIcon.setAttribute('class', 'w-5 h-5 text-amber-600');
    verificationStatus.textContent = 'Not verified - check your inbox';
    resendVerificationBtn?.classList.remove('hidden');
  }
  initIcons();
}

// Resend verification email
resendVerificationBtn?.addEventListener('click', async () => {
  if (!currentUser) return;

  const btnText = resendVerificationBtn.querySelector('span');
  resendVerificationBtn.disabled = true;
  if (btnText) btnText.textContent = 'Sending...';

  try {
    await sendEmailVerification(currentUser);
    if (btnText) btnText.textContent = 'Sent!';
    showToast('Verification email sent!', { type: 'success' });
    setTimeout(() => {
      if (btnText) btnText.textContent = 'Resend';
      resendVerificationBtn.disabled = false;
    }, 3000);
  } catch (error) {
    console.error('Error sending verification email:', error);
    if (error.code === 'auth/too-many-requests') {
      showToast('Please wait before resending', { type: 'error' });
    } else {
      showToast('Error sending email', { type: 'error' });
    }
    if (btnText) btnText.textContent = 'Resend';
    resendVerificationBtn.disabled = false;
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

// ==================== Photo Modal ====================

function openPhotoModal() {
  updatePhotoPreview();
  photoSheet?.open();
}

function closePhotoModal() {
  photoSheet?.close();
}

function updatePhotoPreview() {
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
    removePhotoBtn?.classList.remove('hidden');
  } else if (currentUser) {
    const gravatarUrl = getGravatarUrl(currentUser.email, 160);
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
    removePhotoBtn?.classList.add('hidden');
  }
}

editAvatarBtn?.addEventListener('click', openPhotoModal);
closePhotoModalBtn?.addEventListener('click', closePhotoModal);
photoModal?.addEventListener('click', (e) => {
  if (e.target === photoModal) closePhotoModal();
});

// Photo Upload
uploadPhotoBtn?.addEventListener('click', () => {
  photoInput?.click();
});

photoInput?.addEventListener('change', async (e) => {
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
    clearUserProfileCache();
    await updateAvatarDisplay();
    updatePhotoPreview();

    showToast('Profile photo updated!', { type: 'success' });
    closePhotoModal();
  } catch (error) {
    console.error('Error uploading photo:', error);
    showToast('Error uploading photo', { type: 'error' });
  } finally {
    uploadPhotoBtn.disabled = false;
    uploadPhotoBtn.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i><span>Upload Photo</span>';
    initIcons();
    photoInput.value = '';
  }
});

removePhotoBtn?.addEventListener('click', async () => {
  removePhotoBtn.disabled = true;
  removePhotoBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>';

  try {
    await setDoc(doc(db, 'users', currentUser.uid), {
      photoUrl: null
    }, { merge: true });

    userProfileData = { ...userProfileData, photoUrl: null };
    clearUserProfileCache();
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

// ==================== Change Password ====================

changePasswordBtn?.addEventListener('click', () => {
  currentPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmPasswordInput.value = '';
  updateNewPasswordUI('');
  clearFormErrors(passwordForm);
  passwordSheet?.open();
  if (!isMobile()) currentPasswordInput.focus();
});

cancelPasswordBtn?.addEventListener('click', () => {
  passwordSheet?.close();
});

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

passwordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFormErrors(passwordForm);
  const formData = {
    currentPassword: currentPasswordInput.value,
    newPassword: newPasswordInput.value,
    confirmPassword: confirmPasswordInput.value
  };

  const result = validateForm(ChangePasswordSchema, formData);
  if (!result.success) {
    showFormErrors(passwordForm, result.errors);
    return;
  }

  savePasswordBtn.disabled = true;
  savePasswordBtn.textContent = 'Updating...';

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, result.data.currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, result.data.newPassword);

    showToast('Password updated successfully!', { type: 'success' });
    passwordSheet?.close();
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

// ==================== Privacy & Data ====================

// Export My Data
exportDataBtn?.addEventListener('click', async () => {
  if (!currentUser) return;

  const btnText = exportDataBtn.querySelector('span');
  exportDataBtn.disabled = true;
  if (btnText) btnText.textContent = 'Exporting...';

  try {
    // Fetch all user data
    const [booksSnapshot, genresSnapshot, seriesSnapshot] = await Promise.all([
      getDocs(collection(db, 'users', currentUser.uid, 'books')),
      getDocs(collection(db, 'users', currentUser.uid, 'genres')),
      getDocs(collection(db, 'users', currentUser.uid, 'series'))
    ]);

    const books = booksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const genres = genresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const series = seriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Create export object
    const exportData = {
      exportDate: new Date().toISOString(),
      userEmail: currentUser.email,
      version: '1.0',
      data: {
        books,
        genres,
        series,
        profile: userProfileData || {}
      },
      counts: {
        books: books.length,
        genres: genres.length,
        series: series.length
      }
    };

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `mybookshelf-export-${date}.json`;

    // Create and trigger download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${books.length} books, ${genres.length} genres, ${series.length} series`, { type: 'success' });
  } catch (error) {
    console.error('Error exporting data:', error);
    showToast('Error exporting data', { type: 'error' });
  } finally {
    exportDataBtn.disabled = false;
    if (btnText) btnText.textContent = 'Export';
  }
});

// Clear Local Cache
clearCacheBtn?.addEventListener('click', () => {
  if (!confirm('This will clear all cached data from your browser. Your data in the cloud will not be affected. Continue?')) {
    return;
  }

  try {
    // Get all localStorage keys that belong to this app
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('mybookshelf_') || key.startsWith('homeSettings') || key.startsWith('syncSettings') || key.startsWith('widgetSettings') || key.startsWith('gravatar_'))) {
        keysToRemove.push(key);
      }
    }

    // Remove the keys
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Also clear sessionStorage
    sessionStorage.clear();

    showToast(`Cleared ${keysToRemove.length} cached items`, { type: 'success' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    showToast('Error clearing cache', { type: 'error' });
  }
});

// ==================== Delete Account ====================

deleteAccountBtn?.addEventListener('click', () => {
  deleteConfirmPasswordInput.value = '';
  deleteConfirmTextInput.value = '';
  clearFormErrors(deleteAccountForm);
  deleteAccountSheet?.open();
  if (!isMobile()) deleteConfirmPasswordInput.focus();
});

cancelDeleteAccountBtn?.addEventListener('click', () => {
  deleteAccountSheet?.close();
});

deleteAccountForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFormErrors(deleteAccountForm);
  const formData = {
    password: deleteConfirmPasswordInput.value,
    confirmText: deleteConfirmTextInput.value
  };

  const result = validateForm(DeleteAccountSchema, formData);
  if (!result.success) {
    showFormErrors(deleteAccountForm, result.errors);
    return;
  }

  confirmDeleteAccountBtn.disabled = true;
  confirmDeleteAccountBtn.textContent = 'Deleting...';

  try {
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(currentUser.email, result.data.password);
    await reauthenticateWithCredential(currentUser, credential);

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

    // Delete all series
    const seriesRef = collection(db, 'users', userId, 'series');
    const seriesSnapshot = await getDocs(seriesRef);
    const batch3 = writeBatch(db);
    seriesSnapshot.docs.forEach(seriesDoc => {
      batch3.delete(seriesDoc.ref);
    });
    if (seriesSnapshot.docs.length > 0) {
      await batch3.commit();
    }

    // Delete all wishlist items
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const wishlistSnapshot = await getDocs(wishlistRef);
    const batch4 = writeBatch(db);
    wishlistSnapshot.docs.forEach(wishlistDoc => {
      batch4.delete(wishlistDoc.ref);
    });
    if (wishlistSnapshot.docs.length > 0) {
      await batch4.commit();
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
