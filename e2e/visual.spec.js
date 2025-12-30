// @ts-check
// Visual Regression Tests
// Captures screenshots of key pages/components and compares against baselines
// Run: npx playwright test e2e/visual.spec.js --update-snapshots (to create baselines)

const { test, expect } = require('@playwright/test');

// Configure visual comparison settings
test.use({
  // Allow small pixel differences due to font rendering variations
  screenshot: {
    maxDiffPixelRatio: 0.01,
  },
});

test.describe('Visual Regression - Login Page', () => {
  test('login form appearance', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');

    // Wait for icons to render
    await page.waitForTimeout(500);

    // Capture login form area
    const loginForm = page.locator('#login-form');
    await expect(loginForm).toHaveScreenshot('login-form.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('register form appearance', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');

    // Switch to register form
    await page.click('#show-register-btn');
    await page.waitForTimeout(300);

    // Capture register form area
    const registerForm = page.locator('#register-form');
    await expect(registerForm).toHaveScreenshot('register-form.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('password strength indicator states', async ({ page }) => {
    await page.goto('/login/');
    await page.click('#show-register-btn');
    await page.waitForTimeout(300);

    // Weak password
    await page.fill('#register-password', 'abc');
    await page.waitForTimeout(100);
    const strengthWeak = page.locator('#password-strength');
    await expect(strengthWeak).toHaveScreenshot('password-strength-weak.png');

    // Medium password
    await page.fill('#register-password', 'Abcd1234');
    await page.waitForTimeout(100);
    await expect(strengthWeak).toHaveScreenshot('password-strength-medium.png');

    // Strong password
    await page.fill('#register-password', 'Abcd1234!@#$XYZ');
    await page.waitForTimeout(100);
    await expect(strengthWeak).toHaveScreenshot('password-strength-strong.png');
  });
});

test.describe('Visual Regression - Privacy Page', () => {
  test('privacy policy page appearance', async ({ page }) => {
    await page.goto('/privacy/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Full page screenshot of privacy policy
    await expect(page).toHaveScreenshot('privacy-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Empty States', () => {
  test('books list empty state placeholder', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForTimeout(500);

    const url = page.url();
    // Skip if redirected to login
    if (url.includes('/login/')) {
      test.skip();
      return;
    }

    // Wait for any loading states to resolve
    await page.waitForLoadState('networkidle');

    // If there's an empty state, capture it
    const emptyState = page.locator('.empty-state, [data-empty-state]');
    if (await emptyState.count() > 0) {
      await expect(emptyState.first()).toHaveScreenshot('books-empty-state.png', {
        maxDiffPixelRatio: 0.02,
      });
    }
  });
});

test.describe('Visual Regression - Form Validation', () => {
  test('login validation errors', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');

    // Submit empty form to trigger validation
    await page.click('#login-btn');
    await page.waitForTimeout(300);

    // Capture form with validation errors
    const loginForm = page.locator('#login-form');
    await expect(loginForm).toHaveScreenshot('login-form-errors.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('register validation errors', async ({ page }) => {
    await page.goto('/login/');
    await page.click('#show-register-btn');
    await page.waitForTimeout(300);

    // Submit empty form to trigger validation
    await page.click('#register-btn');
    await page.waitForTimeout(300);

    // Capture form with validation errors
    const registerForm = page.locator('#register-form');
    await expect(registerForm).toHaveScreenshot('register-form-errors.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Skeleton Loaders', () => {
  test('books page skeleton loader', async ({ page }) => {
    await page.goto('/books/');

    // Wait briefly to see if we get redirected
    await page.waitForTimeout(300);
    const url = page.url();
    if (url.includes('/login/')) {
      test.skip();
      return;
    }

    // Capture skeleton loader if visible
    const skeleton = page.locator('#loading-skeleton');
    if (await skeleton.isVisible()) {
      await expect(skeleton).toHaveScreenshot('books-skeleton.png', {
        maxDiffPixelRatio: 0.02,
      });
    }
  });
});

test.describe('Visual Regression - Buttons and Controls', () => {
  test('login page button states', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');

    // Primary button (Login)
    const loginBtn = page.locator('#login-btn');
    await expect(loginBtn).toHaveScreenshot('button-primary.png');

    // Secondary/link button (show register)
    const showRegisterBtn = page.locator('#show-register-btn');
    await expect(showRegisterBtn).toHaveScreenshot('button-link.png');
  });
});

test.describe('Visual Regression - Mobile Views', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('login page mobile layout', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('privacy page mobile layout', async ({ page }) => {
    await page.goto('/privacy/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('privacy-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression - Responsive Breakpoints', () => {
  const breakpoints = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  for (const { name, width, height } of breakpoints) {
    test(`login page at ${name} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/login/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`login-${name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});

test.describe('Visual Regression - Settings Tabs (if accessible)', () => {
  test('settings page tabs appearance', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForTimeout(500);

    const url = page.url();
    if (url.includes('/login/')) {
      test.skip();
      return;
    }

    await page.waitForLoadState('networkidle');

    // Capture settings navigation if visible
    const settingsNav = page.locator('nav, .settings-nav, [role="tablist"]');
    if (await settingsNav.count() > 0) {
      await expect(settingsNav.first()).toHaveScreenshot('settings-nav.png', {
        maxDiffPixelRatio: 0.02,
      });
    }
  });
});
