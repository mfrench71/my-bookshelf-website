/**
 * Form HTML Alignment Tests
 *
 * These tests verify that HTML form elements have the correct `name` attributes
 * to match their corresponding Zod schemas. This catches mismatches that would
 * cause validation errors to not display properly.
 *
 * These tests read actual HTML files and verify structure, unlike unit tests
 * that mock the DOM.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Read HTML files from src directory
const readHtmlFile = (filePath) => {
  const fullPath = path.join(process.cwd(), 'src', filePath);
  return fs.readFileSync(fullPath, 'utf-8');
};

// Extract input name attributes from HTML
const extractInputNames = (html, formId) => {
  // Find the form
  const formRegex = new RegExp(`<form[^>]*id="${formId}"[^>]*>[\\s\\S]*?<\\/form>`, 'i');
  const formMatch = html.match(formRegex);
  if (!formMatch) return [];

  const formHtml = formMatch[0];

  // Find all inputs/textareas/selects with name attributes
  const inputRegex = /<(?:input|textarea|select)[^>]*name="([^"]+)"[^>]*>/gi;
  const names = [];
  let match;
  while ((match = inputRegex.exec(formHtml)) !== null) {
    names.push(match[1]);
  }
  return names;
};

// Check if form has required field indicators
const hasRequiredIndicator = (html, labelText) => {
  // Look for label with asterisk indicator
  const patterns = [
    new RegExp(`<label[^>]*>[^<]*${labelText}[^<]*<span[^>]*class="[^"]*text-red[^"]*"[^>]*>\\*<\\/span>`, 'i'),
    new RegExp(`<label[^>]*>${labelText}\\s*\\*<\\/label>`, 'i')
  ];
  return patterns.some(p => p.test(html));
};

describe('Form HTML Alignment', () => {
  describe('Profile Page Modals', () => {
    let profileHtml;

    beforeAll(() => {
      profileHtml = readHtmlFile('settings/index.njk');
    });

    describe('Password Form', () => {
      it('should have name attributes matching ChangePasswordSchema fields', () => {
        const names = extractInputNames(profileHtml, 'password-form');
        expect(names).toContain('currentPassword');
        expect(names).toContain('newPassword');
        expect(names).toContain('confirmPassword');
      });

      it('should mark all password fields as required', () => {
        expect(hasRequiredIndicator(profileHtml, 'Current Password')).toBe(true);
        expect(hasRequiredIndicator(profileHtml, 'New Password')).toBe(true);
        expect(hasRequiredIndicator(profileHtml, 'Confirm New Password')).toBe(true);
      });
    });

    describe('Delete Account Form', () => {
      it('should have name attributes matching DeleteAccountSchema fields', () => {
        const names = extractInputNames(profileHtml, 'delete-account-form');
        expect(names).toContain('password');
        expect(names).toContain('confirmText');
      });

      it('should mark confirmation fields as required', () => {
        expect(hasRequiredIndicator(profileHtml, 'Enter your password')).toBe(true);
        expect(hasRequiredIndicator(profileHtml, 'Type "DELETE"')).toBe(true);
      });
    });
  });

  describe('Library Page Modals', () => {
    let libraryHtml;

    beforeAll(() => {
      libraryHtml = readHtmlFile('settings/library.njk');
    });

    describe('Genre Form', () => {
      it('should have name attribute matching GenreSchema fields', () => {
        const names = extractInputNames(libraryHtml, 'genre-form');
        expect(names).toContain('name');
      });

      it('should mark Name field as required', () => {
        expect(hasRequiredIndicator(libraryHtml, 'Name')).toBe(true);
      });
    });

    describe('Series Form', () => {
      it('should have name attributes matching SeriesFormSchema fields', () => {
        const names = extractInputNames(libraryHtml, 'series-form');
        expect(names).toContain('name');
        expect(names).toContain('description');
        expect(names).toContain('totalBooks');
      });

      it('should mark Name field as required', () => {
        expect(hasRequiredIndicator(libraryHtml, 'Name')).toBe(true);
      });
    });
  });

  describe('Login Page', () => {
    let loginHtml;

    beforeAll(() => {
      loginHtml = readHtmlFile('login.njk');
    });

    describe('Login Form', () => {
      it('should have name attributes matching LoginSchema fields', () => {
        const names = extractInputNames(loginHtml, 'login-form');
        expect(names).toContain('email');
        expect(names).toContain('password');
      });

      it('should mark all fields as required', () => {
        expect(hasRequiredIndicator(loginHtml, 'Email')).toBe(true);
        expect(hasRequiredIndicator(loginHtml, 'Password')).toBe(true);
      });
    });

    describe('Register Form', () => {
      it('should have name attributes matching RegisterSchema fields', () => {
        const names = extractInputNames(loginHtml, 'register-form');
        expect(names).toContain('email');
        expect(names).toContain('password');
        expect(names).toContain('confirmPassword');
      });

      it('should mark all fields as required', () => {
        // Check register form specifically (multiple Email/Password labels exist)
        const registerFormMatch = loginHtml.match(/<form[^>]*id="register-form"[\s\S]*?<\/form>/i);
        expect(registerFormMatch).not.toBeNull();
        const registerHtml = registerFormMatch[0];
        expect(registerHtml).toMatch(/Email\s*<span[^>]*class="[^"]*text-red/i);
        expect(registerHtml).toMatch(/Password\s*<span[^>]*class="[^"]*text-red/i);
        expect(registerHtml).toMatch(/Confirm Password\s*<span[^>]*class="[^"]*text-red/i);
      });
    });
  });

  describe('Add Book Page', () => {
    let addHtml;

    beforeAll(() => {
      addHtml = readHtmlFile('books/add.njk');
    });

    describe('Book Form', () => {
      it('should have name attributes matching BookSchema required fields', () => {
        const names = extractInputNames(addHtml, 'book-form');
        expect(names).toContain('title');
        expect(names).toContain('author');
      });

      it('should mark required fields', () => {
        expect(hasRequiredIndicator(addHtml, 'Title')).toBe(true);
        expect(hasRequiredIndicator(addHtml, 'Author')).toBe(true);
      });
    });
  });

  describe('Edit Book Page', () => {
    let editHtml;

    beforeAll(() => {
      editHtml = readHtmlFile('books/edit.njk');
    });

    describe('Edit Form', () => {
      it('should have name attributes matching BookSchema required fields', () => {
        const names = extractInputNames(editHtml, 'edit-form');
        expect(names).toContain('title');
        expect(names).toContain('author');
      });

      it('should mark required fields', () => {
        expect(hasRequiredIndicator(editHtml, 'Title')).toBe(true);
        expect(hasRequiredIndicator(editHtml, 'Author')).toBe(true);
      });
    });
  });
});

describe('All Forms Have novalidate', () => {
  it('should have novalidate on all forms to rely on Zod validation', () => {
    const files = [
      'settings/index.njk',
      'settings/library.njk',
      'login.njk',
      'books/add.njk',
      'books/edit.njk'
    ];

    for (const file of files) {
      const html = readHtmlFile(file);
      const formRegex = /<form[^>]*>/gi;
      let match;
      while ((match = formRegex.exec(html)) !== null) {
        const formTag = match[0];
        expect(formTag, `Form in ${file} should have novalidate`).toMatch(/novalidate/i);
      }
    }
  });
});
