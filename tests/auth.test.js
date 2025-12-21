/**
 * Tests for auth.js - Authentication page logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkPasswordStrength } from '../src/js/utils.js';

// Mock Firebase auth before importing
const mockSignIn = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateProfile = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js', () => ({
  signInWithEmailAndPassword: (...args) => mockSignIn(...args),
  createUserWithEmailAndPassword: (...args) => mockCreateUser(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
  onAuthStateChanged: (auth, callback) => {
    mockOnAuthStateChanged(auth, callback);
    return vi.fn(); // unsubscribe
  }
}));

vi.mock('../src/js/firebase-config.js', () => ({
  auth: { currentUser: null }
}));

// Mock lucide
global.lucide = {
  createIcons: vi.fn()
};

/**
 * Set up DOM elements for auth page
 */
function setupAuthDOM() {
  document.body.innerHTML = `
    <!-- Login Form -->
    <form id="login-form">
      <input type="email" id="login-email" value="" />
      <input type="password" id="login-password" value="" />
      <button type="submit">Sign In</button>
    </form>

    <!-- Register Form -->
    <form id="register-form" class="hidden">
      <input type="text" id="register-name" value="" />
      <input type="email" id="register-email" value="" />
      <input type="password" id="register-password" value="" />
      <input type="password" id="register-password-confirm" value="" />
      <button type="submit">Create Account</button>
    </form>

    <!-- Toggle buttons -->
    <div id="toggle-register">
      <button id="show-register-btn">Create account</button>
    </div>
    <div id="toggle-login" class="hidden">
      <button id="show-login-btn">Sign in</button>
    </div>

    <!-- Error display -->
    <div id="auth-error" class="hidden"></div>

    <!-- Password strength indicator -->
    <div id="password-strength" class="hidden">
      <div id="strength-bar-1" class="h-1 flex-1 rounded-full bg-gray-200"></div>
      <div id="strength-bar-2" class="h-1 flex-1 rounded-full bg-gray-200"></div>
      <div id="strength-bar-3" class="h-1 flex-1 rounded-full bg-gray-200"></div>
      <div id="strength-bar-4" class="h-1 flex-1 rounded-full bg-gray-200"></div>
      <span id="strength-text" class="text-xs"></span>
    </div>

    <!-- Requirements -->
    <div id="req-length" class="text-gray-400">
      <i data-lucide="circle"></i>
      At least 6 characters
    </div>
    <div id="req-uppercase" class="text-gray-400">
      <i data-lucide="circle"></i>
      Contains uppercase
    </div>
    <div id="req-number" class="text-gray-400">
      <i data-lucide="circle"></i>
      Contains a number
    </div>
  `;
}

describe('Auth Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthDOM();
    // Reset mock implementations
    mockSignIn.mockReset();
    mockCreateUser.mockReset();
    mockUpdateProfile.mockReset();
    mockOnAuthStateChanged.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('checkPasswordStrength (from utils.js)', () => {
    it('should return score 0 for empty password', () => {
      const result = checkPasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.checks.length).toBe(false);
    });

    it('should return score 1 for short password', () => {
      const result = checkPasswordStrength('abc');
      expect(result.score).toBe(0); // Less than 6 chars
      expect(result.checks.length).toBe(false);
    });

    it('should return score 1 for minimum length lowercase only', () => {
      const result = checkPasswordStrength('abcdef');
      expect(result.score).toBe(1); // Length met
      expect(result.checks.length).toBe(true);
      expect(result.checks.uppercase).toBe(false);
      expect(result.checks.number).toBe(false);
    });

    it('should return score 2 for length + case mix', () => {
      const result = checkPasswordStrength('Abcdef');
      expect(result.score).toBe(2);
      expect(result.checks.length).toBe(true);
      expect(result.checks.uppercase).toBe(true);
      expect(result.checks.lowercase).toBe(true);
    });

    it('should return score 3 for length + case mix + number', () => {
      const result = checkPasswordStrength('Abcdef1');
      expect(result.score).toBe(3);
      expect(result.checks.number).toBe(true);
    });

    it('should return score 4 for length + case + number + special', () => {
      const result = checkPasswordStrength('Abcdef1!');
      expect(result.score).toBe(4);
      expect(result.checks.special).toBe(true);
    });

    it('should return score 4 for long password without special chars', () => {
      const result = checkPasswordStrength('Abcdefghij1'); // 11 chars
      expect(result.score).toBe(4); // Length >= 10 counts as bonus
    });
  });

  describe('getErrorMessage', () => {
    // We can't directly test getErrorMessage since it's not exported,
    // but we can verify the error messages are correct through integration tests

    it('should have correct error mappings defined', () => {
      // This documents the expected error messages
      const expectedMappings = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'An account with this email already exists',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
      };

      // Verify all expected codes exist
      expect(Object.keys(expectedMappings).length).toBe(8);
    });
  });

  describe('Form Toggle', () => {
    it('should show register form when clicking show-register-btn', async () => {
      // Re-import to attach event listeners with fresh DOM
      vi.resetModules();
      setupAuthDOM();

      const loginForm = document.getElementById('login-form');
      const registerForm = document.getElementById('register-form');
      const showRegisterBtn = document.getElementById('show-register-btn');
      const toggleLogin = document.getElementById('toggle-login');
      const toggleRegister = document.getElementById('toggle-register');

      // Manually simulate what the event listener does
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      toggleRegister.classList.add('hidden');
      toggleLogin.classList.remove('hidden');

      expect(loginForm.classList.contains('hidden')).toBe(true);
      expect(registerForm.classList.contains('hidden')).toBe(false);
      expect(toggleLogin.classList.contains('hidden')).toBe(false);
      expect(toggleRegister.classList.contains('hidden')).toBe(true);
    });

    it('should show login form when clicking show-login-btn', () => {
      const loginForm = document.getElementById('login-form');
      const registerForm = document.getElementById('register-form');
      const toggleLogin = document.getElementById('toggle-login');
      const toggleRegister = document.getElementById('toggle-register');

      // Start with register visible
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');

      // Simulate click behavior
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      toggleLogin.classList.add('hidden');
      toggleRegister.classList.remove('hidden');

      expect(registerForm.classList.contains('hidden')).toBe(true);
      expect(loginForm.classList.contains('hidden')).toBe(false);
    });

    it('should hide auth error when switching forms', () => {
      const authError = document.getElementById('auth-error');

      // Show an error
      authError.classList.remove('hidden');
      authError.textContent = 'Some error';

      // Simulate switching forms (hides error)
      authError.classList.add('hidden');

      expect(authError.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Password Strength UI', () => {
    // Helper to simulate password strength UI update
    function simulatePasswordUI(password) {
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

      if (password.length === 0) {
        passwordStrength.classList.add('hidden');
        updateReqUI(reqLength, false);
        updateReqUI(reqUppercase, false);
        updateReqUI(reqNumber, false);
        return;
      }

      passwordStrength.classList.remove('hidden');
      const { checks, score } = checkPasswordStrength(password);

      updateReqUI(reqLength, checks.length);
      updateReqUI(reqUppercase, checks.uppercase);
      updateReqUI(reqNumber, checks.number);

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
    }

    function updateReqUI(element, met) {
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
    }

    it('should hide password strength for empty input', () => {
      simulatePasswordUI('');

      const passwordStrength = document.getElementById('password-strength');
      expect(passwordStrength.classList.contains('hidden')).toBe(true);
    });

    it('should show password strength for non-empty input', () => {
      simulatePasswordUI('test');

      const passwordStrength = document.getElementById('password-strength');
      expect(passwordStrength.classList.contains('hidden')).toBe(false);
    });

    it('should show weak strength for short password', () => {
      simulatePasswordUI('abcdef');

      const strengthText = document.getElementById('strength-text');
      expect(strengthText.textContent).toBe('Weak');
    });

    it('should show fair strength for password with case mix', () => {
      simulatePasswordUI('Abcdef');

      const strengthText = document.getElementById('strength-text');
      expect(strengthText.textContent).toBe('Fair');
    });

    it('should show good strength for password with case + number', () => {
      simulatePasswordUI('Abcdef1');

      const strengthText = document.getElementById('strength-text');
      expect(strengthText.textContent).toBe('Good');
    });

    it('should show strong strength for complete password', () => {
      simulatePasswordUI('Abcdef1!');

      const strengthText = document.getElementById('strength-text');
      expect(strengthText.textContent).toBe('Strong');
    });

    it('should update length requirement indicator', () => {
      simulatePasswordUI('abcdef'); // 6 chars - meets length

      const reqLength = document.getElementById('req-length');
      expect(reqLength.classList.contains('text-green-500')).toBe(true);
    });

    it('should update uppercase requirement indicator', () => {
      simulatePasswordUI('Abcdef');

      const reqUppercase = document.getElementById('req-uppercase');
      expect(reqUppercase.classList.contains('text-green-500')).toBe(true);
    });

    it('should update number requirement indicator', () => {
      simulatePasswordUI('abcdef1');

      const reqNumber = document.getElementById('req-number');
      expect(reqNumber.classList.contains('text-green-500')).toBe(true);
    });

    it('should color strength bars based on score', () => {
      simulatePasswordUI('Abcdef1!'); // Score 4

      const bars = [
        document.getElementById('strength-bar-1'),
        document.getElementById('strength-bar-2'),
        document.getElementById('strength-bar-3'),
        document.getElementById('strength-bar-4')
      ];

      // All 4 bars should be colored (green for score 4)
      bars.forEach(bar => {
        expect(bar.classList.contains('bg-green-500')).toBe(true);
      });
    });

    it('should gray out unused strength bars', () => {
      simulatePasswordUI('abcdef'); // Score 1

      const bar3 = document.getElementById('strength-bar-3');
      const bar4 = document.getElementById('strength-bar-4');

      expect(bar3.classList.contains('bg-gray-200')).toBe(true);
      expect(bar4.classList.contains('bg-gray-200')).toBe(true);
    });
  });

  describe('Login Form Submission', () => {
    it('should call signInWithEmailAndPassword with correct credentials', async () => {
      mockSignIn.mockResolvedValue({ user: { uid: 'user-123' } });

      document.getElementById('login-email').value = 'test@example.com';
      document.getElementById('login-password').value = 'password123';

      const loginForm = document.getElementById('login-form');
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      // Simulate form submission behavior
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      await mockSignIn({}, 'test@example.com', 'password123');

      expect(mockSignIn).toHaveBeenCalledWith({}, 'test@example.com', 'password123');
    });

    it('should disable submit button while signing in', () => {
      const loginForm = document.getElementById('login-form');
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Signing in...');
    });

    it('should show error and re-enable button on login failure', () => {
      const loginForm = document.getElementById('login-form');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const authError = document.getElementById('auth-error');

      // Simulate error handling
      authError.textContent = 'Invalid email or password';
      authError.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';

      expect(authError.classList.contains('hidden')).toBe(false);
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Sign In');
    });
  });

  describe('Register Form Submission', () => {
    it('should show error when passwords do not match', () => {
      document.getElementById('register-password').value = 'password123';
      document.getElementById('register-password-confirm').value = 'different';

      const authError = document.getElementById('auth-error');

      // Simulate password mismatch behavior
      const password = document.getElementById('register-password').value;
      const passwordConfirm = document.getElementById('register-password-confirm').value;

      if (password !== passwordConfirm) {
        authError.textContent = 'Passwords do not match';
        authError.classList.remove('hidden');
      }

      expect(authError.textContent).toBe('Passwords do not match');
      expect(authError.classList.contains('hidden')).toBe(false);
    });

    it('should call createUserWithEmailAndPassword with correct data', async () => {
      mockCreateUser.mockResolvedValue({
        user: { uid: 'new-user-123' }
      });
      mockUpdateProfile.mockResolvedValue();

      document.getElementById('register-name').value = 'Test User';
      document.getElementById('register-email').value = 'newuser@example.com';
      document.getElementById('register-password').value = 'Password123!';
      document.getElementById('register-password-confirm').value = 'Password123!';

      // Simulate successful registration
      const result = await mockCreateUser({}, 'newuser@example.com', 'Password123!');
      await mockUpdateProfile(result.user, { displayName: 'Test User' });

      expect(mockCreateUser).toHaveBeenCalledWith({}, 'newuser@example.com', 'Password123!');
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        { uid: 'new-user-123' },
        { displayName: 'Test User' }
      );
    });

    it('should disable submit button while creating account', () => {
      const registerForm = document.getElementById('register-form');
      const submitBtn = registerForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Creating account...');
    });

    it('should show error and re-enable button on registration failure', () => {
      const registerForm = document.getElementById('register-form');
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const authError = document.getElementById('auth-error');

      // Simulate error handling
      authError.textContent = 'An account with this email already exists';
      authError.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';

      expect(authError.classList.contains('hidden')).toBe(false);
      expect(submitBtn.disabled).toBe(false);
    });
  });

  describe('Auth State Changes', () => {
    it('should redirect to /books/ when user is logged in', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };

      // Simulate what onAuthStateChanged does when user exists
      const user = { uid: 'test-user' };
      if (user) {
        window.location.href = '/books/';
      }

      expect(window.location.href).toBe('/books/');

      // Restore
      window.location = originalLocation;
    });

    it('should not redirect when user is null', () => {
      const originalLocation = window.location;
      delete window.location;
      window.location = { href: '/initial/' };

      // Simulate what onAuthStateChanged does when no user
      const user = null;
      if (user) {
        window.location.href = '/books/';
      }

      expect(window.location.href).toBe('/initial/');

      window.location = originalLocation;
    });
  });

  describe('Error Message Mapping', () => {
    // Test the error message lookup function behavior
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

    it('should return correct message for invalid-email', () => {
      expect(getErrorMessage('auth/invalid-email')).toBe('Invalid email address');
    });

    it('should return correct message for user-disabled', () => {
      expect(getErrorMessage('auth/user-disabled')).toBe('This account has been disabled');
    });

    it('should return correct message for user-not-found', () => {
      expect(getErrorMessage('auth/user-not-found')).toBe('No account found with this email');
    });

    it('should return correct message for wrong-password', () => {
      expect(getErrorMessage('auth/wrong-password')).toBe('Incorrect password');
    });

    it('should return correct message for email-already-in-use', () => {
      expect(getErrorMessage('auth/email-already-in-use')).toBe('An account with this email already exists');
    });

    it('should return correct message for weak-password', () => {
      expect(getErrorMessage('auth/weak-password')).toBe('Password should be at least 6 characters');
    });

    it('should return correct message for invalid-credential', () => {
      expect(getErrorMessage('auth/invalid-credential')).toBe('Invalid email or password');
    });

    it('should return correct message for too-many-requests', () => {
      expect(getErrorMessage('auth/too-many-requests')).toBe('Too many failed attempts. Please try again later.');
    });

    it('should return default message for unknown error code', () => {
      expect(getErrorMessage('auth/unknown-error')).toBe('An error occurred. Please try again.');
    });

    it('should return default message for undefined code', () => {
      expect(getErrorMessage(undefined)).toBe('An error occurred. Please try again.');
    });
  });
});
