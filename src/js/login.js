// Authentication Logic
import { auth } from '/js/firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { initIcons, checkPasswordStrength } from './utils.js';
import { LoginSchema, RegisterSchema } from './schemas/auth.js';
import { validateForm, showFieldError, clearFormErrors } from './utils/validation.js';

// Initialize Lucide icons
initIcons();

// Check auth state - redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = '/';
  }
});

// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register-btn');
const showLoginBtn = document.getElementById('show-login-btn');
const toggleRegister = document.getElementById('toggle-register');
const toggleLogin = document.getElementById('toggle-login');
const authError = document.getElementById('auth-error');

// Password strength elements
const registerPassword = document.getElementById('register-password');
const passwordStrength = document.getElementById('password-strength');
const strengthBars = [
  document.getElementById('strength-bar-1'),
  document.getElementById('strength-bar-2'),
  document.getElementById('strength-bar-3'),
  document.getElementById('strength-bar-4')
];
const strengthText = document.getElementById('strength-text');
const reqLength = document.getElementById('req-length');
const reqUppercase = document.getElementById('req-uppercase');
const reqNumber = document.getElementById('req-number');

// Toggle between login and register forms
showRegisterBtn?.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  toggleRegister.classList.add('hidden');
  toggleLogin.classList.remove('hidden');
  authError.classList.add('hidden');
  // Clear validation errors from login form
  clearFormErrors(loginForm);
  // Reset register form state
  registerForm.reset();
  updatePasswordUI('');
});

showLoginBtn?.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  toggleLogin.classList.add('hidden');
  toggleRegister.classList.remove('hidden');
  authError.classList.add('hidden');
  // Clear validation errors from register form
  clearFormErrors(registerForm);
  // Reset login form and password strength
  loginForm.reset();
  updatePasswordUI('');
});

// checkPasswordStrength imported from utils.js

function updatePasswordUI(password) {
  if (!passwordStrength) return;

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

registerPassword?.addEventListener('input', (e) => {
  updatePasswordUI(e.target.value);
});

// Login
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = loginForm.querySelector('button[type="submit"]');

  // Clear previous errors
  clearFormErrors(loginForm);
  authError.classList.add('hidden');

  // Validate form data
  const validation = validateForm(LoginSchema, { email, password });
  if (!validation.success) {
    // Show field-level errors
    if (validation.errors.email) {
      showFieldError(document.getElementById('login-email'), validation.errors.email);
    }
    if (validation.errors.password) {
      showFieldError(document.getElementById('login-password'), validation.errors.password);
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    await signInWithEmailAndPassword(auth, validation.data.email, password);
    // Redirect happens via onAuthStateChanged
  } catch (error) {
    showError(getErrorMessage(error.code));
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});

// Register
registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-password-confirm').value;
  const submitBtn = registerForm.querySelector('button[type="submit"]');

  // Clear previous errors
  clearFormErrors(registerForm);
  authError.classList.add('hidden');

  // Validate form data
  const validation = validateForm(RegisterSchema, { email, password, confirmPassword });
  if (!validation.success) {
    // Show field-level errors
    if (validation.errors.email) {
      showFieldError(document.getElementById('register-email'), validation.errors.email);
    }
    if (validation.errors.password) {
      showFieldError(document.getElementById('register-password'), validation.errors.password);
    }
    if (validation.errors.confirmPassword) {
      showFieldError(document.getElementById('register-password-confirm'), validation.errors.confirmPassword);
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
    } catch (e) {
      console.warn('Could not send verification email:', e);
    }
    // Redirect happens via onAuthStateChanged
  } catch (error) {
    showError(getErrorMessage(error.code));
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
});

function showError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
}

function getErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password should be at least 6 characters',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
  };
  return messages[code] || 'An error occurred. Please try again.';
}
