// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login/');

    // Check page title
    await expect(page).toHaveTitle(/MyBookShelf/);

    // Check login form elements exist
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();

    // Check toggle to register exists
    await expect(page.locator('#show-register-btn')).toBeVisible();
  });

  test('can switch between login and register forms', async ({ page }) => {
    await page.goto('/login/');

    // Initially login form is visible, register is hidden
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#register-form')).toBeHidden();

    // Click to show register form
    await page.click('#show-register-btn');

    // Now register form is visible, login is hidden
    await expect(page.locator('#login-form')).toBeHidden();
    await expect(page.locator('#register-form')).toBeVisible();

    // Check register form elements
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
    await expect(page.locator('#register-password-confirm')).toBeVisible();

    // Switch back to login
    await page.click('#show-login-btn');
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('shows password strength indicator on register', async ({ page }) => {
    await page.goto('/login/');
    await page.click('#show-register-btn');

    // Password strength is hidden initially
    await expect(page.locator('#password-strength')).toBeHidden();

    // Type a password to trigger strength indicator
    await page.fill('#register-password', 'abc');
    await expect(page.locator('#password-strength')).toBeVisible();

    // Type a stronger password
    await page.fill('#register-password', 'StrongPass123!');
    await expect(page.locator('#password-strength')).toBeVisible();
  });

  test('login button is enabled', async ({ page }) => {
    await page.goto('/login/');

    // Login button should be enabled (form validation happens on submit)
    const loginBtn = page.locator('#login-btn');
    await expect(loginBtn).toBeEnabled();
  });

  test('shows password requirements on register', async ({ page }) => {
    await page.goto('/login/');
    await page.click('#show-register-btn');

    // Password requirements should be visible
    await expect(page.locator('#req-length')).toBeVisible();
    await expect(page.locator('#req-uppercase')).toBeVisible();
    await expect(page.locator('#req-number')).toBeVisible();
  });
});
