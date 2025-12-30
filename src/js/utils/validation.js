// Validation Utilities - Helpers for form validation with Zod

/**
 * Validate a single field against a schema
 * @param {Object} schema - Zod schema object
 * @param {string} field - Field name to validate
 * @param {any} value - Value to validate
 * @returns {string|null} Error message or null if valid
 */
export function validateField(schema, field, value) {
  // Extract the field schema
  const fieldSchema = schema.shape?.[field];
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
 * @param {Object} schema - Zod schema object
 * @param {Object} data - Form data to validate
 * @returns {{ success: boolean, data?: Object, errors?: Object }}
 */
export function validateForm(schema, data) {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Convert Zod errors to field-keyed object
  const errors = {};
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
 * @param {HTMLElement} input - Input element
 * @param {string|null} error - Error message or null to clear
 */
export function showFieldError(input, error) {
  // Find or create error container
  let errorEl = input.parentElement.querySelector('.field-error');

  if (error) {
    // Add error styling to input
    input.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    input.classList.remove('border-gray-300', 'focus:ring-primary', 'focus:border-primary');

    // Create error element if needed
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'field-error text-sm text-red-600 mt-1';
      input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = error;
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
 * @param {HTMLFormElement} form - Form element
 */
export function clearFormErrors(form) {
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
 * @param {HTMLFormElement} form - Form element
 * @param {Object} errors - Object mapping field names to error messages
 */
export function showFormErrors(form, errors) {
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
    const input = form.querySelector(`[name="${field}"], #${field}`);
    if (input) {
      showFieldError(input, message);
    }
  }
}

/**
 * Check if device is mobile (matches isMobile() in utils.js)
 * @returns {boolean}
 */
function isMobileDevice() {
  return window.innerWidth < 768;
}

/**
 * Scroll to the first invalid field in a form
 * Call after showFormErrors() to bring the first error into view
 * @param {HTMLFormElement} form - Form element
 * @param {Object} options - Optional settings
 * @param {boolean} options.focus - Whether to focus the first invalid field (default: false on mobile to avoid keyboard popup, true on desktop)
 * @param {string} options.behavior - Scroll behavior: 'smooth' or 'instant' (default: 'smooth')
 * @param {string} options.block - Scroll block position: 'center', 'start', 'end', 'nearest' (default: 'center')
 */
export function scrollToFirstError(form, options = {}) {
  // Default: don't focus on mobile (avoids virtual keyboard popup), focus on desktop
  const defaultFocus = !isMobileDevice();
  const { focus = defaultFocus, behavior = 'smooth', block = 'center' } = options;

  // Find first element with error styling
  const firstError = form.querySelector('.border-red-500');

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
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} Form data
 */
export function getFormData(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    // Handle multiple values (e.g., checkboxes with same name)
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }

  return data;
}

/**
 * Set up real-time validation on blur
 * @param {HTMLFormElement} form - Form element
 * @param {Object} schema - Zod schema
 * @param {Object} options - Options
 * @param {boolean} options.validateOnInput - Also validate on input (default: false)
 */
export function setupFieldValidation(form, schema, options = {}) {
  const { validateOnInput = false } = options;

  const inputs = form.querySelectorAll('input, textarea, select');

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
      const errorEl = input.parentElement.querySelector('.field-error');
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
