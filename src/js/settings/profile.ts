// Profile Settings Page Logic
import { auth, db } from '/js/firebase-config.js';
import {
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendEmailVerification,
  User,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  showToast,
  initIcons,
  getCachedUserProfile,
  clearUserProfileCache,
  checkPasswordStrength,
  isMobile,
} from '../utils.js';
import { validateForm, showFormErrors, clearFormErrors } from '../utils/validation.js';
import { ChangePasswordSchema, DeleteAccountSchema } from '../schemas/auth.js';
import { getGravatarUrl } from '../md5.js';
import { BottomSheet } from '../components/modal.js';
import { updateSettingsIndicators } from '../utils/settings-indicators.js';
import { deleteImages } from '../utils/image-upload.js';

/** User profile data structure */
interface UserProfileData {
  photoUrl?: string | null;
  [key: string]: unknown;
}

/** Book image data */
interface BookImage {
  storagePath: string;
  [key: string]: unknown;
}

// Initialize icons once on load
initIcons();

// Ensure icons are initialized after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

// State
let currentUser: User | null = null;
let userProfileData: UserProfileData | null = null;

// DOM Elements - Profile
const profileLoading = document.getElementById('profile-loading');
const profileContent = document.getElementById('profile-content');
const profileAvatar = document.getElementById('profile-avatar');
const profileEmail = document.getElementById('profile-email');
const profileCreated = document.getElementById('profile-created');
const editAvatarBtn = document.getElementById('edit-avatar-btn');
const changePasswordBtn = document.getElementById('change-password-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');

// DOM Elements - Email Verification
const emailVerificationSection = document.getElementById('email-verification-section');
const verificationIcon = document.getElementById('verification-icon');
const verificationStatus = document.getElementById('verification-status');
const resendVerificationBtn = document.getElementById('resend-verification-btn') as HTMLButtonElement | null;

// DOM Elements - Photo Modal
const photoModal = document.getElementById('photo-modal');
const photoPreview = document.getElementById('photo-preview');
const photoInput = document.getElementById('photo-input') as HTMLInputElement | null;
const uploadPhotoBtn = document.getElementById('upload-photo-btn') as HTMLButtonElement | null;
const removePhotoBtn = document.getElementById('remove-photo-btn') as HTMLButtonElement | null;
const closePhotoModalBtn = document.getElementById('close-photo-modal');

// DOM Elements - Password Modal
const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form') as HTMLFormElement | null;
const currentPasswordInput = document.getElementById('current-password') as HTMLInputElement | null;
const newPasswordInput = document.getElementById('new-password') as HTMLInputElement | null;
const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement | null;
const cancelPasswordBtn = document.getElementById('cancel-password');
const savePasswordBtn = document.getElementById('save-password') as HTMLButtonElement | null;

// Password strength elements
const newPasswordStrength = document.getElementById('new-password-strength');
const newStrengthBars = [
  document.getElementById('new-strength-bar-1'),
  document.getElementById('new-strength-bar-2'),
  document.getElementById('new-strength-bar-3'),
  document.getElementById('new-strength-bar-4'),
];
const newStrengthText = document.getElementById('new-strength-text');
const newReqLength = document.getElementById('new-req-length');
const newReqUppercase = document.getElementById('new-req-uppercase');
const newReqNumber = document.getElementById('new-req-number');

// DOM Elements - Delete Account Modal
const deleteAccountModal = document.getElementById('delete-account-modal');
const deleteAccountForm = document.getElementById('delete-account-form') as HTMLFormElement | null;
const deleteConfirmPasswordInput = document.getElementById('delete-confirm-password') as HTMLInputElement | null;
const deleteConfirmTextInput = document.getElementById('delete-confirm-text') as HTMLInputElement | null;
const cancelDeleteAccountBtn = document.getElementById('cancel-delete-account');
const confirmDeleteAccountBtn = document.getElementById('confirm-delete-account') as HTMLButtonElement | null;

// Photo upload constants
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Bottom Sheet Instances
const photoSheet = photoModal ? new BottomSheet({ container: photoModal }) : null;
const passwordSheet = passwordModal ? new BottomSheet({ container: passwordModal }) : null;
const deleteAccountSheet = deleteAccountModal ? new BottomSheet({ container: deleteAccountModal }) : null;

// Auth Check
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    await loadProfileInfo();
    updateSettingsIndicators(user.uid);
  }
});

// ==================== Profile ====================

async function loadProfileInfo(): Promise<void> {
  if (!currentUser || !profileEmail || !profileCreated) return;

  // Display email
  profileEmail.textContent = currentUser.email;

  // Display member since date
  const createdAt = currentUser.metadata?.creationTime;
  if (createdAt) {
    const date = new Date(createdAt);
    profileCreated.textContent = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } else {
    profileCreated.textContent = 'Unknown';
  }

  // Load user profile data from Firestore (with caching)
  try {
    userProfileData = await getCachedUserProfile(async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
      return userDoc.exists() ? userDoc.data() : {};
    }, currentUser.uid);
  } catch (_e) {
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

function updateVerificationStatus(): void {
  if (!emailVerificationSection || !currentUser || !verificationIcon || !verificationStatus) return;

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
  if (!currentUser || !resendVerificationBtn) return;

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
  } catch (error: unknown) {
    console.error('Error sending verification email:', error);
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'auth/too-many-requests') {
      showToast('Please wait before resending', { type: 'error' });
    } else {
      showToast('Error sending email', { type: 'error' });
    }
    if (btnText) btnText.textContent = 'Resend';
    resendVerificationBtn.disabled = false;
  }
});

async function updateAvatarDisplay(): Promise<void> {
  if (!currentUser || !profileAvatar) return;

  const initial = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : '?';

  // Helper to safely set avatar image
  const setAvatarImage = (container: HTMLElement, url: string, alt: string): void => {
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
    } catch (_e) {
      // Fall back to initial
      profileAvatar.innerHTML = '';
      profileAvatar.textContent = initial;
    }
  }
}

// ==================== Photo Modal ====================

function openPhotoModal(): void {
  updatePhotoPreview();
  photoSheet?.open();
}

function closePhotoModal(): void {
  photoSheet?.close();
}

function updatePhotoPreview(): void {
  if (!photoPreview || !currentUser) return;

  const setPreviewImage = (url: string, alt: string): void => {
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
  } else {
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
photoModal?.addEventListener('click', (e: Event) => {
  if (e.target === photoModal) closePhotoModal();
});

// Photo Upload
uploadPhotoBtn?.addEventListener('click', () => {
  photoInput?.click();
});

photoInput?.addEventListener('change', async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !uploadPhotoBtn || !currentUser) return;

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast('Please select a JPG, PNG, or WebP image', { type: 'error' });
    if (photoInput) photoInput.value = '';
    return;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showToast('Image must be less than 500KB', { type: 'error' });
    if (photoInput) photoInput.value = '';
    return;
  }

  uploadPhotoBtn.disabled = true;
  uploadPhotoBtn.innerHTML =
    '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>';

  try {
    // Convert to base64
    const base64 = await fileToBase64(file);

    // Save to Firestore
    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        photoUrl: base64,
      },
      { merge: true }
    );

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
    if (photoInput) photoInput.value = '';
  }
});

removePhotoBtn?.addEventListener('click', async () => {
  if (!removePhotoBtn || !currentUser) return;

  removePhotoBtn.disabled = true;
  removePhotoBtn.innerHTML =
    '<span class="inline-block animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>';

  try {
    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        photoUrl: null,
      },
      { merge: true }
    );

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== Change Password ====================

/**
 * Check if password form has all required fields filled
 */
function isPasswordFormComplete(): boolean {
  if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return false;
  if (!currentPasswordInput.value.trim()) return false;
  if (!newPasswordInput.value) return false;
  if (!confirmPasswordInput.value) return false;
  return true;
}

/**
 * Update password save button state based on form completeness
 */
function updatePasswordSaveButtonState(): void {
  if (!savePasswordBtn) return;

  const isComplete = isPasswordFormComplete();
  savePasswordBtn.disabled = !isComplete;
  savePasswordBtn.classList.toggle('opacity-50', !isComplete);
  savePasswordBtn.classList.toggle('cursor-not-allowed', !isComplete);
}

changePasswordBtn?.addEventListener('click', () => {
  if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !passwordForm) return;

  currentPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmPasswordInput.value = '';
  updateNewPasswordUI('');
  clearFormErrors(passwordForm);
  // Initialize button state (disabled until all fields filled)
  updatePasswordSaveButtonState();
  passwordSheet?.open();
  if (!isMobile()) currentPasswordInput.focus();
});

cancelPasswordBtn?.addEventListener('click', () => {
  passwordSheet?.close();
});

// Update save button state when password fields change
currentPasswordInput?.addEventListener('input', updatePasswordSaveButtonState);
newPasswordInput?.addEventListener('input', updatePasswordSaveButtonState);
confirmPasswordInput?.addEventListener('input', updatePasswordSaveButtonState);

function updateNewPasswordUI(password: string): void {
  if (!newPasswordStrength || !newStrengthText) return;

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
    if (!bar) return;
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

function updateRequirement(element: HTMLElement | null, met: boolean): void {
  if (!element) return;
  if (met) {
    element.classList.remove('text-gray-400');
    element.classList.add('text-green-500');
  } else {
    element.classList.remove('text-green-500');
    element.classList.add('text-gray-400');
  }
}

newPasswordInput?.addEventListener('input', (e: Event) => {
  const target = e.target as HTMLInputElement;
  updateNewPasswordUI(target.value);
});

passwordForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  if (
    !passwordForm ||
    !currentPasswordInput ||
    !newPasswordInput ||
    !confirmPasswordInput ||
    !savePasswordBtn ||
    !currentUser
  ) {
    return;
  }

  clearFormErrors(passwordForm);
  const formData = {
    currentPassword: currentPasswordInput.value,
    newPassword: newPasswordInput.value,
    confirmPassword: confirmPasswordInput.value,
  };

  const result = validateForm(ChangePasswordSchema, formData);
  if (!result.success) {
    showFormErrors(passwordForm, result.errors);
    return;
  }

  savePasswordBtn.disabled = true;
  savePasswordBtn.textContent = 'Updating...';

  try {
    const credential = EmailAuthProvider.credential(currentUser.email!, result.data.currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, result.data.newPassword);

    showToast('Password updated successfully!', { type: 'success' });
    passwordSheet?.close();
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
      showToast('Current password is incorrect', { type: 'error' });
    } else if (firebaseError.code === 'auth/weak-password') {
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

// ==================== Delete Account ====================

/**
 * Check if delete account form has all required fields filled
 */
function isDeleteFormComplete(): boolean {
  if (!deleteConfirmPasswordInput || !deleteConfirmTextInput) return false;
  if (!deleteConfirmPasswordInput.value.trim()) return false;
  if (!deleteConfirmTextInput.value.trim()) return false;
  return true;
}

/**
 * Update delete account button state based on form completeness
 */
function updateDeleteButtonState(): void {
  if (!confirmDeleteAccountBtn) return;

  const isComplete = isDeleteFormComplete();
  confirmDeleteAccountBtn.disabled = !isComplete;
  confirmDeleteAccountBtn.classList.toggle('opacity-50', !isComplete);
  confirmDeleteAccountBtn.classList.toggle('cursor-not-allowed', !isComplete);
}

deleteAccountBtn?.addEventListener('click', () => {
  if (!deleteConfirmPasswordInput || !deleteConfirmTextInput || !deleteAccountForm) return;

  deleteConfirmPasswordInput.value = '';
  deleteConfirmTextInput.value = '';
  clearFormErrors(deleteAccountForm);
  // Initialize button state (disabled until all fields filled)
  updateDeleteButtonState();
  deleteAccountSheet?.open();
  if (!isMobile()) deleteConfirmPasswordInput.focus();
});

cancelDeleteAccountBtn?.addEventListener('click', () => {
  deleteAccountSheet?.close();
});

// Update delete button state when form fields change
deleteConfirmPasswordInput?.addEventListener('input', updateDeleteButtonState);
deleteConfirmTextInput?.addEventListener('input', updateDeleteButtonState);

deleteAccountForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  if (
    !deleteAccountForm ||
    !deleteConfirmPasswordInput ||
    !deleteConfirmTextInput ||
    !confirmDeleteAccountBtn ||
    !currentUser
  ) {
    return;
  }

  clearFormErrors(deleteAccountForm);
  const formData = {
    password: deleteConfirmPasswordInput.value,
    confirmText: deleteConfirmTextInput.value,
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
    const credential = EmailAuthProvider.credential(currentUser.email!, result.data.password);
    await reauthenticateWithCredential(currentUser, credential);

    const userId = currentUser.uid;

    // Delete all books (and their images from Storage)
    const booksRef = collection(db, 'users', userId, 'books');
    const booksSnapshot = await getDocs(booksRef);

    // Delete all book images from Storage first
    const allImages: BookImage[] = booksSnapshot.docs.flatMap(bookDoc => bookDoc.data().images || []);
    if (allImages.length > 0) {
      await deleteImages(allImages);
    }

    // Delete book documents
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
    } catch (_e) {
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
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
      showToast('Incorrect password', { type: 'error' });
      // Clear password field so user knows to re-enter
      deleteConfirmPasswordInput.value = '';
      deleteConfirmPasswordInput.focus();
    } else {
      console.error('Error deleting account:', error);
      showToast('Error deleting account', { type: 'error' });
    }
    confirmDeleteAccountBtn.disabled = false;
    confirmDeleteAccountBtn.textContent = 'Delete Account';
  }
});
