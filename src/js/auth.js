// Authentication Logic
import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { initIcons } from './utils.js';

// Initialize Lucide icons
initIcons();

// Check auth state - redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = '/books/';
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
});

showLoginBtn?.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  toggleLogin.classList.add('hidden');
  toggleRegister.classList.remove('hidden');
  authError.classList.add('hidden');
});

// Password strength checking
function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  // Calculate strength score (0-4)
  let score = 0;
  if (checks.length) score++;
  if (checks.uppercase && checks.lowercase) score++;
  if (checks.number) score++;
  if (checks.special || password.length >= 10) score++;

  return { checks, score };
}

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
  const icon = element.querySelector('i');
  if (met) {
    element.classList.remove('text-gray-400');
    element.classList.add('text-green-500');
    if (icon) {
      icon.setAttribute('data-lucide', 'check-circle');
    }
  } else {
    element.classList.remove('text-green-500');
    element.classList.add('text-gray-400');
    if (icon) {
      icon.setAttribute('data-lucide', 'circle');
    }
  }
  initIcons();
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

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';
  authError.classList.add('hidden');

  try {
    await signInWithEmailAndPassword(auth, email, password);
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

  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;
  const submitBtn = registerForm.querySelector('button[type="submit"]');

  authError.classList.add('hidden');

  if (password !== passwordConfirm) {
    showError('Passwords do not match');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
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
