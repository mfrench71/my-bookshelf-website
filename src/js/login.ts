// Authentication Logic
import { auth } from '/js/firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  User,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { initIcons, checkPasswordStrength } from './utils.js';
import { LoginSchema, RegisterSchema } from './schemas/auth.js';
import { validateForm, showFieldError, clearFormErrors } from './utils/validation.js';

// Initialize Lucide icons
initIcons();

// Check auth state - redirect if already logged in
onAuthStateChanged(auth, (user: User | null) => {
  if (user) {
    window.location.href = '/';
  }
});

// DOM Elements
const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
const registerForm = document.getElementById('register-form') as HTMLFormElement | null;
const showRegisterBtn = document.getElementById('show-register-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const toggleRegister = document.getElementById('toggle-register');
const toggleLogin = document.getElementById('toggle-login');
const authError = document.getElementById('auth-error');

// Password strength elements
const registerPassword = document.getElementById('register-password') as HTMLInputElement | null;
const passwordStrength = document.getElementById('password-strength');
const strengthBars = [
  document.getElementById('strength-bar-1'),
  document.getElementById('strength-bar-2'),
  document.getElementById('strength-bar-3'),
  document.getElementById('strength-bar-4'),
];
const strengthText = document.getElementById('strength-text');
const reqLength = document.getElementById('req-length');
const reqUppercase = document.getElementById('req-uppercase');
const reqNumber = document.getElementById('req-number');

/**
 * Reset both forms to clean state
 */
function resetAllForms(): void {
  // Clear validation errors
  if (loginForm) clearFormErrors(loginForm);
  if (registerForm) clearFormErrors(registerForm);
  // Reset form values
  loginForm?.reset();
  registerForm?.reset();
  // Reset password strength UI
  updatePasswordUI('');
  // Hide auth error
  authError?.classList.add('hidden');
}

// Toggle between login and register forms
showRegisterBtn?.addEventListener('click', () => {
  resetAllForms();
  loginForm?.classList.add('hidden');
  registerForm?.classList.remove('hidden');
  toggleRegister?.classList.add('hidden');
  toggleLogin?.classList.remove('hidden');
});

showLoginBtn?.addEventListener('click', () => {
  resetAllForms();
  registerForm?.classList.add('hidden');
  loginForm?.classList.remove('hidden');
  toggleLogin?.classList.add('hidden');
  toggleRegister?.classList.remove('hidden');
});

/**
 * Update password strength UI
 * @param password - Password to evaluate
 */
function updatePasswordUI(password: string): void {
  if (!passwordStrength || !strengthText) return;

  if (password.length === 0) {
    passwordStrength.classList.add('hidden');
    updateRequirement(reqLength, false);
    updateRequirement(reqUppercase, false);
    updateRequirement(reqNumber, false);
    return;
  }

  passwordStrength.classList.remove('hidden');
  const { checks, score } = checkPasswordStrength(password);

  // Update requirements
  updateRequirement(reqLength, checks.length);
  updateRequirement(reqUppercase, checks.uppercase);
  updateRequirement(reqNumber, checks.number);

  // Update strength bars
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  strengthBars.forEach((bar, index) => {
    if (!bar) return;
    bar.className = 'h-1 flex-1 rounded-full';
    if (index < score) {
      bar.classList.add(colors[Math.min(score - 1, 3)]);
    } else {
      bar.classList.add('bg-gray-200');
    }
  });

  strengthText.textContent = labels[Math.min(score - 1, 3)] || '';
  strengthText.className = 'text-xs';
  if (score === 1) strengthText.classList.add('text-red-500');
  else if (score === 2) strengthText.classList.add('text-orange-500');
  else if (score === 3) strengthText.classList.add('text-yellow-600');
  else if (score === 4) strengthText.classList.add('text-green-500');
}

/**
 * Update requirement indicator color
 * @param element - DOM element to update
 * @param met - Whether requirement is met
 */
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

registerPassword?.addEventListener('input', (e: Event) => {
  const target = e.target as HTMLInputElement;
  updatePasswordUI(target.value);
});

// Login
loginForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  if (!loginForm || !authError) return;

  const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
  const passwordInput = document.getElementById('login-password') as HTMLInputElement | null;
  const submitBtn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;

  if (!emailInput || !passwordInput || !submitBtn) return;

  const email = emailInput.value;
  const password = passwordInput.value;

  // Clear previous errors
  clearFormErrors(loginForm);
  authError.classList.add('hidden');

  // Validate form data
  const validation = validateForm(LoginSchema, { email, password });
  if (!validation.success) {
    // Show field-level errors
    if (validation.errors.email) {
      showFieldError(emailInput, validation.errors.email);
    }
    if (validation.errors.password) {
      showFieldError(passwordInput, validation.errors.password);
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    await signInWithEmailAndPassword(auth, validation.data.email, password);
    // Redirect happens via onAuthStateChanged
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    showError(getErrorMessage(firebaseError.code));
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});

// Register
registerForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  if (!registerForm || !authError) return;

  const emailInput = document.getElementById('register-email') as HTMLInputElement | null;
  const passwordInput = document.getElementById('register-password') as HTMLInputElement | null;
  const confirmPasswordInput = document.getElementById('register-password-confirm') as HTMLInputElement | null;
  const submitBtn = registerForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;

  if (!emailInput || !passwordInput || !confirmPasswordInput || !submitBtn) return;

  const email = emailInput.value;
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Clear previous errors
  clearFormErrors(registerForm);
  authError.classList.add('hidden');

  // Validate form data
  const validation = validateForm(RegisterSchema, { email, password, confirmPassword });
  if (!validation.success) {
    // Show field-level errors
    if (validation.errors.email) {
      showFieldError(emailInput, validation.errors.email);
    }
    if (validation.errors.password) {
      showFieldError(passwordInput, validation.errors.password);
    }
    if (validation.errors.confirmPassword) {
      showFieldError(confirmPasswordInput, validation.errors.confirmPassword);
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, validation.data.email, password);
    // Send verification email
    try {
      await sendEmailVerification(userCredential.user);
    } catch (verifyError) {
      console.warn('Could not send verification email:', verifyError);
    }
    // Redirect happens via onAuthStateChanged
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    showError(getErrorMessage(firebaseError.code));
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
});

/**
 * Show error message
 * @param message - Error message to display
 */
function showError(message: string): void {
  if (!authError) return;
  authError.textContent = message;
  authError.classList.remove('hidden');
}

/**
 * Get user-friendly error message from Firebase error code
 * @param code - Firebase error code
 * @returns User-friendly error message
 */
function getErrorMessage(code: string | undefined): string {
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password should be at least 6 characters',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  };
  return (code && messages[code]) || 'An error occurred. Please try again.';
}
