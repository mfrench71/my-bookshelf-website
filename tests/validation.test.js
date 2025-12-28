/**
 * Unit tests for src/js/utils/validation.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateField,
  validateForm,
  showFieldError,
  clearFormErrors,
  showFormErrors,
  getFormData,
  setupFieldValidation
} from '../src/js/utils/validation.js';

// Create a mock Zod-like schema for testing
function createMockSchema(fields) {
  return {
    shape: Object.fromEntries(
      Object.entries(fields).map(([key, config]) => [
        key,
        {
          safeParse: (value) => {
            if (config.required && !value) {
              return {
                success: false,
                error: { issues: [{ message: config.message || 'Required', path: [key] }] }
              };
            }
            if (config.validate && !config.validate(value)) {
              return {
                success: false,
                error: { issues: [{ message: config.message || 'Invalid', path: [key] }] }
              };
            }
            return { success: true, data: value };
          }
        }
      ])
    ),
    safeParse: (data) => {
      const errors = [];
      for (const [key, config] of Object.entries(fields)) {
        if (config.required && !data[key]) {
          errors.push({ message: config.message || 'Required', path: [key] });
        } else if (config.validate && !config.validate(data[key])) {
          errors.push({ message: config.message || 'Invalid', path: [key] });
        }
      }
      if (errors.length > 0) {
        return { success: false, error: { issues: errors } };
      }
      return { success: true, data };
    }
  };
}

describe('validateField', () => {
  it('should return null for valid field', () => {
    const schema = createMockSchema({
      email: { required: true, message: 'Email is required' }
    });
    const result = validateField(schema, 'email', 'test@example.com');
    expect(result).toBeNull();
  });

  it('should return error message for invalid field', () => {
    const schema = createMockSchema({
      email: { required: true, message: 'Email is required' }
    });
    const result = validateField(schema, 'email', '');
    expect(result).toBe('Email is required');
  });

  it('should return null for unknown field', () => {
    const schema = createMockSchema({ email: { required: true } });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateField(schema, 'unknown', 'value');
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Field "unknown" not found in schema');
    consoleSpy.mockRestore();
  });

  it('should handle custom validation', () => {
    const schema = createMockSchema({
      age: {
        validate: (v) => parseInt(v) >= 18,
        message: 'Must be 18 or older'
      }
    });
    expect(validateField(schema, 'age', '17')).toBe('Must be 18 or older');
    expect(validateField(schema, 'age', '18')).toBeNull();
  });
});

describe('validateForm', () => {
  it('should return success for valid form data', () => {
    const schema = createMockSchema({
      email: { required: true },
      name: { required: true }
    });
    const result = validateForm(schema, { email: 'test@example.com', name: 'John' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'test@example.com', name: 'John' });
  });

  it('should return errors for invalid form data', () => {
    const schema = createMockSchema({
      email: { required: true, message: 'Email required' },
      name: { required: true, message: 'Name required' }
    });
    const result = validateForm(schema, { email: '', name: '' });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty('email', 'Email required');
    expect(result.errors).toHaveProperty('name', 'Name required');
  });

  it('should only include first error per field', () => {
    const schema = createMockSchema({
      email: { required: true, message: 'Email required' }
    });
    const result = validateForm(schema, { email: '' });
    expect(result.errors.email).toBe('Email required');
  });
});

describe('showFieldError', () => {
  let input;
  let parent;

  beforeEach(() => {
    parent = document.createElement('div');
    input = document.createElement('input');
    input.className = 'border-gray-300 focus:ring-primary focus:border-primary';
    parent.appendChild(input);
    document.body.appendChild(parent);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should add error styling and message', () => {
    showFieldError(input, 'This field is required');

    expect(input.classList.contains('border-red-500')).toBe(true);
    expect(input.classList.contains('border-gray-300')).toBe(false);

    const errorEl = parent.querySelector('.field-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('This field is required');
  });

  it('should update existing error message', () => {
    showFieldError(input, 'First error');
    showFieldError(input, 'Updated error');

    const errorEls = parent.querySelectorAll('.field-error');
    expect(errorEls).toHaveLength(1);
    expect(errorEls[0].textContent).toBe('Updated error');
  });

  it('should clear error when null passed', () => {
    showFieldError(input, 'Error');
    showFieldError(input, null);

    expect(input.classList.contains('border-red-500')).toBe(false);
    expect(input.classList.contains('border-gray-300')).toBe(true);
    expect(parent.querySelector('.field-error')).toBeNull();
  });
});

describe('clearFormErrors', () => {
  let form;

  beforeEach(() => {
    form = document.createElement('form');
    form.innerHTML = `
      <div>
        <input name="field1" class="border-red-500 focus:ring-red-500 focus:border-red-500">
        <p class="field-error">Error 1</p>
      </div>
      <div>
        <input name="field2" class="border-red-500">
        <p class="field-error">Error 2</p>
      </div>
    `;
    document.body.appendChild(form);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should remove error styling from all inputs', () => {
    clearFormErrors(form);

    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
      expect(input.classList.contains('border-red-500')).toBe(false);
      expect(input.classList.contains('border-gray-300')).toBe(true);
    });
  });

  it('should remove all error messages', () => {
    clearFormErrors(form);
    expect(form.querySelectorAll('.field-error')).toHaveLength(0);
  });
});

describe('showFormErrors', () => {
  let form;

  beforeEach(() => {
    form = document.createElement('form');
    form.innerHTML = `
      <div><input name="email" class="border-gray-300"></div>
      <div><input name="password" class="border-gray-300"></div>
      <div><input id="confirmPassword" class="border-gray-300"></div>
    `;
    document.body.appendChild(form);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should show field errors by name', () => {
    showFormErrors(form, { email: 'Invalid email', password: 'Too short' });

    const emailInput = form.querySelector('[name="email"]');
    expect(emailInput.classList.contains('border-red-500')).toBe(true);

    const passwordInput = form.querySelector('[name="password"]');
    expect(passwordInput.classList.contains('border-red-500')).toBe(true);
  });

  it('should show field errors by id', () => {
    showFormErrors(form, { confirmPassword: 'Passwords must match' });

    const confirmInput = form.querySelector('#confirmPassword');
    expect(confirmInput.classList.contains('border-red-500')).toBe(true);
  });

  it('should show form-level errors at top', () => {
    showFormErrors(form, { _form: 'Something went wrong' });

    const formError = form.querySelector('.form-error');
    expect(formError).not.toBeNull();
    expect(formError.textContent).toBe('Something went wrong');
    expect(form.firstChild).toBe(formError);
  });

  it('should clear previous errors before showing new ones', () => {
    // Add an initial error
    const emailInput = form.querySelector('[name="email"]');
    emailInput.classList.add('border-red-500');
    const errorEl = document.createElement('p');
    errorEl.className = 'field-error';
    errorEl.textContent = 'Old error';
    emailInput.parentElement.appendChild(errorEl);

    // Show new error on different field
    showFormErrors(form, { password: 'New error' });

    // Old error should be cleared
    expect(emailInput.classList.contains('border-red-500')).toBe(false);
    expect(emailInput.parentElement.querySelector('.field-error')).toBeNull();
  });

  it('should handle non-existent field gracefully', () => {
    // Should not throw
    expect(() => {
      showFormErrors(form, { nonExistent: 'Error' });
    }).not.toThrow();
  });
});

describe('getFormData', () => {
  let form;

  beforeEach(() => {
    form = document.createElement('form');
    document.body.appendChild(form);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should extract form data as object', () => {
    form.innerHTML = `
      <input name="email" value="test@example.com">
      <input name="name" value="John">
    `;

    const data = getFormData(form);
    expect(data).toEqual({ email: 'test@example.com', name: 'John' });
  });

  it('should handle multiple values with same name as array', () => {
    form.innerHTML = `
      <input type="checkbox" name="genres" value="fiction" checked>
      <input type="checkbox" name="genres" value="fantasy" checked>
      <input type="checkbox" name="genres" value="mystery">
    `;

    const data = getFormData(form);
    expect(data.genres).toEqual(['fiction', 'fantasy']);
  });

  it('should handle empty form', () => {
    const data = getFormData(form);
    expect(data).toEqual({});
  });

  it('should include textarea and select values', () => {
    form.innerHTML = `
      <textarea name="notes">Some notes</textarea>
      <select name="status"><option value="active" selected>Active</option></select>
    `;

    const data = getFormData(form);
    expect(data.notes).toBe('Some notes');
    expect(data.status).toBe('active');
  });
});

describe('setupFieldValidation', () => {
  let form;
  let schema;

  beforeEach(() => {
    form = document.createElement('form');
    form.innerHTML = `
      <div><input name="email" class="border-gray-300"></div>
      <div><input name="name" class="border-gray-300"></div>
    `;
    document.body.appendChild(form);

    schema = createMockSchema({
      email: { required: true, message: 'Email is required' },
      name: { required: true, message: 'Name is required' }
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should validate on blur', () => {
    setupFieldValidation(form, schema);

    const emailInput = form.querySelector('[name="email"]');
    emailInput.value = '';
    emailInput.dispatchEvent(new Event('blur'));

    expect(emailInput.classList.contains('border-red-500')).toBe(true);
  });

  it('should clear error on valid input after blur', () => {
    setupFieldValidation(form, schema);

    const emailInput = form.querySelector('[name="email"]');

    // First blur with empty value
    emailInput.value = '';
    emailInput.dispatchEvent(new Event('blur'));
    expect(emailInput.classList.contains('border-red-500')).toBe(true);

    // Then type valid value and blur again
    emailInput.value = 'test@example.com';
    emailInput.dispatchEvent(new Event('blur'));
    expect(emailInput.classList.contains('border-red-500')).toBe(false);
  });

  it('should clear error while typing valid value', () => {
    setupFieldValidation(form, schema);

    const emailInput = form.querySelector('[name="email"]');

    // First blur to show error
    emailInput.value = '';
    emailInput.dispatchEvent(new Event('blur'));
    expect(emailInput.classList.contains('border-red-500')).toBe(true);

    // Type valid value
    emailInput.value = 'test@example.com';
    emailInput.dispatchEvent(new Event('input'));
    expect(emailInput.classList.contains('border-red-500')).toBe(false);
  });

  it('should skip inputs without name or id', () => {
    form.innerHTML = `<div><input class="border-gray-300"></div>`;

    // Should not throw
    expect(() => {
      setupFieldValidation(form, schema);
    }).not.toThrow();
  });
});
