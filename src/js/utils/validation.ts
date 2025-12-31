// Validation Utilities - Helpers for form validation with Zod

import type { z } from '/js/vendor/zod.js';

/** Validation result for successful validation */
interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors?: never;
}

/** Validation result for failed validation */
interface ValidationFailure {
  success: false;
  data?: never;
  errors: Record<string, string>;
}

/** Combined validation result type */
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/** Scroll to error options */
interface ScrollToErrorOptions {
  focus?: boolean;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}

/** Setup validation options */
interface SetupValidationOptions {
  validateOnInput?: boolean;
}

/**
 * Validate a single field against a schema
 * @param schema - Zod schema object
 * @param field - Field name to validate
 * @param value - Value to validate
 * @returns Error message or null if valid
 */
export function validateField(schema: z.ZodObject<z.ZodRawShape>, field: string, value: unknown): string | null {
  // Extract the field schema
  const fieldSchema = schema.shape?.[field] as z.ZodSchema | undefined;
  if (!fieldSchema) {
    console.warn(`Field "${field}" not found in schema`);
    return null;
  }

  const result = fieldSchema.safeParse(value);
  if (result.success) {
    return null;
  }

  // Return first error message
  return result.error.issues[0]?.message || 'Invalid value';
}

/**
 * Validate entire form data against a schema
 * @param schema - Zod schema object
 * @param data - Form data to validate
 * @returns Validation result with success, data, or errors
 */
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Convert Zod errors to field-keyed object
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_form';
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return { success: false, errors };
}

/**
 * Show error message on a form field
 * @param input - Input element
 * @param error - Error message or null to clear
 */
export function showFieldError(input: HTMLElement, error: string | null): void {
  // Find or create error container
  let errorEl = input.parentElement?.querySelector('.field-error');

  if (error) {
    // Add error styling to input
    input.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    input.classList.remove('border-gray-300', 'focus:ring-primary', 'focus:border-primary');

    // Create error element if needed
    if (!errorEl && input.parentElement) {
      errorEl = document.createElement('p');
      errorEl.className = 'field-error text-sm text-red-600 mt-1';
      input.parentElement.appendChild(errorEl);
    }
    if (errorEl) {
      errorEl.textContent = error;
    }
  } else {
    // Clear error styling
    input.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    input.classList.add('border-gray-300', 'focus:ring-primary', 'focus:border-primary');

    // Remove error element
    if (errorEl) {
      errorEl.remove();
    }
  }
}

/**
 * Clear all field errors in a form
 * @param form - Form element
 */
export function clearFormErrors(form: HTMLFormElement): void {
  // Remove error styling from all inputs
  form.querySelectorAll('.border-red-500').forEach(input => {
    input.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    input.classList.add('border-gray-300', 'focus:ring-primary', 'focus:border-primary');
  });

  // Remove all error messages
  form.querySelectorAll('.field-error').forEach(el => el.remove());
}

/**
 * Show all form errors at once
 * @param form - Form element
 * @param errors - Object mapping field names to error messages
 */
export function showFormErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  clearFormErrors(form);

  for (const [field, message] of Object.entries(errors)) {
    if (field === '_form') {
      // Form-level error (e.g., "Passwords do not match")
      // Show at the top of the form
      let formError = form.querySelector('.form-error');
      if (!formError) {
        formError = document.createElement('p');
        formError.className = 'form-error text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-lg';
        form.insertBefore(formError, form.firstChild);
      }
      formError.textContent = message;
      continue;
    }

    // Field-level error
    const input = form.querySelector(`[name="${field}"], #${field}`) as HTMLElement | null;
    if (input) {
      showFieldError(input, message);
    }
  }
}

/**
 * Check if device is mobile (matches isMobile() in utils.js)
 */
function isMobileDevice(): boolean {
  return window.innerWidth < 768;
}

/**
 * Scroll to the first invalid field in a form
 * Call after showFormErrors() to bring the first error into view
 * @param form - Form element
 * @param options - Optional settings
 */
export function scrollToFirstError(form: HTMLFormElement, options: ScrollToErrorOptions = {}): void {
  // Default: don't focus on mobile (avoids virtual keyboard popup), focus on desktop
  const defaultFocus = !isMobileDevice();
  const { focus = defaultFocus, behavior = 'smooth', block = 'center' } = options;

  // Find first element with error styling
  const firstError = form.querySelector('.border-red-500') as HTMLElement | null;

  if (firstError) {
    // Scroll into view (CSS scroll-margin-top handles sticky header offset)
    firstError.scrollIntoView({ behavior, block });

    // Optionally focus the field for immediate correction (disabled on mobile by default)
    if (focus && typeof firstError.focus === 'function') {
      // Delay focus slightly to let scroll complete
      setTimeout(() => {
        firstError.focus();
      }, 100);
    }
  }
}

/**
 * Get form data as an object
 * @param form - Form element
 * @returns Form data
 */
export function getFormData(form: HTMLFormElement): Record<string, string | string[]> {
  const formData = new FormData(form);
  const data: Record<string, string | string[]> = {};

  for (const [key, value] of formData.entries()) {
    const stringValue = value as string;
    // Handle multiple values (e.g., checkboxes with same name)
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key])) {
        data[key] = [data[key] as string];
      }
      (data[key] as string[]).push(stringValue);
    } else {
      data[key] = stringValue;
    }
  }

  return data;
}

/**
 * Set up real-time validation on blur
 * @param form - Form element
 * @param schema - Zod schema
 * @param options - Options
 */
export function setupFieldValidation(
  form: HTMLFormElement,
  schema: z.ZodObject<z.ZodRawShape>,
  options: SetupValidationOptions = {}
): void {
  const { validateOnInput = false } = options;

  const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select'
  );

  inputs.forEach(input => {
    const fieldName = input.name || input.id;
    if (!fieldName) return;

    // Validate on blur
    input.addEventListener('blur', () => {
      const error = validateField(schema, fieldName, input.value);
      showFieldError(input, error);
    });

    // Optionally validate on input
    if (validateOnInput) {
      input.addEventListener('input', () => {
        // Only clear error while typing (don't show new errors until blur)
        const error = validateField(schema, fieldName, input.value);
        if (!error) {
          showFieldError(input, null);
        }
      });
    }

    // Clear error when user starts typing
    input.addEventListener('input', () => {
      const errorEl = input.parentElement?.querySelector('.field-error');
      if (errorEl && input.classList.contains('border-red-500')) {
        // If there's an error, revalidate
        const error = validateField(schema, fieldName, input.value);
        if (!error) {
          showFieldError(input, null);
        }
      }
    });
  });
}
