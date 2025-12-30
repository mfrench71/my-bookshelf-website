// Helper Utilities - Misc helper functions

/**
 * Debounce function calls
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function calls to max once per delay
 * @param fn - Function to throttle
 * @param delay - Minimum time between calls in ms
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/** Password strength check results */
export interface PasswordStrengthChecks {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  lowercase: boolean;
  special: boolean;
}

export interface PasswordStrengthResult {
  checks: PasswordStrengthChecks;
  score: number;
}

/**
 * Check password strength
 * @param password - Password to check
 * @returns Strength checks and score (0-4)
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const checks: PasswordStrengthChecks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  let score = 0;
  if (checks.length) score++;
  if (checks.uppercase && checks.lowercase) score++;
  if (checks.number) score++;
  if (checks.special || password.length >= 10) score++;

  return { checks, score };
}

/**
 * Check if the browser is online
 * @returns True if online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Validate an image URL for safe use in img src attributes
 * Only allows http: and https: protocols
 * @param url - URL to validate
 * @returns True if URL is valid and safe
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate a hex colour string for safe use in CSS
 * Prevents CSS injection attacks via style attributes
 * @param color - Colour string to validate (e.g., '#3b82f6')
 * @returns True if valid hex colour
 */
export function isValidHexColor(color: string | null | undefined): boolean {
  if (!color || typeof color !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
