// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation - Page Accessibility', () => {
  test('login page is accessible', async ({ page }) => {
    const response = await page.goto('/login/');
    expect(response.status()).toBe(200);
  });

  test('home page returns 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBe(200);
  });

  test('books page returns 200', async ({ page }) => {
    const response = await page.goto('/books/');
    expect(response.status()).toBe(200);
  });

  test('add book page returns 200', async ({ page }) => {
    const response = await page.goto('/books/add/');
    expect(response.status()).toBe(200);
  });

  test('settings page returns 200', async ({ page }) => {
    const response = await page.goto('/settings/');
    expect(response.status()).toBe(200);
  });
});

test.describe('PWA Configuration', () => {
  test('has correct meta tags', async ({ page }) => {
    await page.goto('/');

    // Check viewport meta
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');

    // Check theme color
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#3b82f6');

    // Check manifest link
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
  });
});

test.describe('Login Page Elements', () => {
  // These tests work because login page doesn't redirect
  test('login form elements are visible', async ({ page }) => {
    await page.goto('/login/');

    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();
  });

  test('can switch to register form', async ({ page }) => {
    await page.goto('/login/');

    // Click to show register form
    await page.click('#show-register-btn');

    // Register form elements
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
    await expect(page.locator('#register-password-confirm')).toBeVisible();
  });
});

test.describe('Add Book Page Elements (unauthenticated)', () => {
  // Test elements if we're not redirected (page actually loads)
  test('add book page has scan button if not redirected', async ({ page }) => {
    await page.goto('/books/add/');

    // Wait a moment for potential redirect
    await page.waitForTimeout(500);

    // Check current URL - if we're still on add page, test the elements
    const url = page.url();
    if (url.includes('/books/add/')) {
      await expect(page.locator('#scan-btn')).toBeVisible();
      await expect(page.locator('#book-search')).toBeVisible();
      await expect(page.locator('#book-form')).toBeVisible();
    } else {
      // We were redirected to login - that's expected behavior for unauthenticated users
      expect(url).toContain('/login/');
    }
  });
});

test.describe('Settings Page Elements (unauthenticated)', () => {
  test('settings page has heading if not redirected', async ({ page }) => {
    await page.goto('/settings/');

    // Wait a moment for potential redirect
    await page.waitForTimeout(500);

    const url = page.url();
    if (url.includes('/settings/')) {
      await expect(page.locator('h1')).toContainText('Settings');
    } else {
      // Redirected to login
      expect(url).toContain('/login/');
    }
  });
});

test.describe('UI Elements on Public Pages', () => {
  test('home page main content area exists', async ({ page }) => {
    await page.goto('/');

    // Wait for potential auth redirect
    await page.waitForTimeout(500);

    const url = page.url();
    if (!url.includes('/login/')) {
      // Main tag should exist in the DOM if not redirected
      await expect(page.locator('main')).toBeAttached();
    } else {
      // Redirected to login is expected for unauthenticated users
      expect(url).toContain('/login/');
    }
  });

  test('books page has book list container in DOM', async ({ page }) => {
    await page.goto('/books/');

    // Wait for page to load, then check if book-list exists
    await page.waitForTimeout(500);

    const url = page.url();
    if (url.includes('/books/')) {
      // Check element is attached (might be hidden initially)
      await expect(page.locator('#book-list')).toBeAttached();
    }
  });
});
