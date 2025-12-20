// Authentication Logic
import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Initialize Lucide icons
lucide.createIcons();

// Check auth state - redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = '/books.html';
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
  const submitBtn = registerForm.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  authError.classList.add('hidden');

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
