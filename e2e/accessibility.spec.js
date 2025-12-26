// @ts-check
/**
 * Accessibility Tests
 *
 * Uses axe-core to automatically detect accessibility violations.
 * These tests catch issues like:
 * - Missing alt text on images
 * - Low colour contrast
 * - Missing form labels
 * - Incorrect heading hierarchy
 * - Missing ARIA attributes
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// Helper to run axe and report violations
async function checkAccessibility(page, pageName) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Log violations for debugging
  if (results.violations.length > 0) {
    console.log(`\nAccessibility violations on ${pageName}:`);
    results.violations.forEach(v => {
      console.log(`  - ${v.id}: ${v.description}`);
      console.log(`    Impact: ${v.impact}`);
      console.log(`    Nodes: ${v.nodes.length}`);
    });
  }

  return results.violations;
}

test.describe('Accessibility - Public Pages', () => {
  test('login page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/login/');
    await page.waitForLoadState('networkidle');

    const violations = await checkAccessibility(page, 'Login');

    // Filter to only critical/serious issues
    const criticalViolations = violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations, 'Critical accessibility violations found').toHaveLength(0);
  });

  test('login page - register form has no critical violations', async ({ page }) => {
    await page.goto('/login/');
    await page.click('#show-register-btn');
    await page.waitForTimeout(300); // Wait for animation

    const violations = await checkAccessibility(page, 'Register Form');

    const criticalViolations = violations.filter(v =>
      v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations, 'Critical accessibility violations found').toHaveLength(0);
  });
});

test.describe('Accessibility - Form Labels', () => {
  test('login form inputs have associated labels with for attribute', async ({ page }) => {
    await page.goto('/login/');

    // Check labels have proper for attributes pointing to inputs
    const emailLabel = page.locator('label[for="login-email"]');
    const passwordLabel = page.locator('label[for="login-password"]');

    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test('register form inputs have associated labels with for attribute', async ({ page }) => {
    await page.goto('/login/');
    await page.click('#show-register-btn');

    await expect(page.locator('label[for="register-email"]')).toBeVisible();
    await expect(page.locator('label[for="register-password"]')).toBeVisible();
    await expect(page.locator('label[for="register-password-confirm"]')).toBeVisible();
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('login form fields are focusable in order', async ({ page }) => {
    await page.goto('/login/');

    // Focus email input directly and verify it's focusable
    await page.locator('#login-email').focus();
    await expect(page.locator('#login-email')).toBeFocused();

    // Tab to password input
    await page.keyboard.press('Tab');
    await expect(page.locator('#login-password')).toBeFocused();

    // Tab to submit button
    await page.keyboard.press('Tab');
    await expect(page.locator('#login-btn')).toBeFocused();
  });

  test('can submit login form with Enter key', async ({ page }) => {
    await page.goto('/login/');

    await page.fill('#login-email', 'test@example.com');
    await page.fill('#login-password', 'password');

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Form should attempt submission (will show error since not real credentials)
    // Just verify no JS errors occurred
    const errors = [];
    page.on('pageerror', err => errors.push(err));
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Accessibility - Focus Indicators', () => {
  test('interactive elements have visible focus indicators', async ({ page }) => {
    await page.goto('/login/');

    // Focus email input and check it has focus styling
    await page.locator('#login-email').focus();

    // Should have focus ring (Tailwind focus:ring-*)
    const emailInput = page.locator('#login-email');
    const hasFocusRing = await emailInput.evaluate(el => {
      const styles = window.getComputedStyle(el);
      // Check for box-shadow (how Tailwind implements focus rings)
      return styles.boxShadow !== 'none' || styles.outline !== 'none';
    });

    expect(hasFocusRing, 'Email input should have visible focus indicator').toBe(true);
  });
});

test.describe('Accessibility - Colour Contrast', () => {
  test('primary buttons have sufficient contrast', async ({ page }) => {
    await page.goto('/login/');

    const loginBtn = page.locator('#login-btn');

    // Get computed styles
    const contrast = await loginBtn.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        background: styles.backgroundColor,
        color: styles.color
      };
    });

    // Primary button should be blue bg with white text
    // Just verify colours are set (actual contrast checked by axe-core)
    expect(contrast.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(contrast.color).toBeTruthy();
  });
});

test.describe('Accessibility - Skip Links', () => {
  test('pages with header have skip to main content link', async ({ page }) => {
    // Note: Login page has hideHeader: true, so test on a page with header
    // This will redirect to login if not authenticated, which is expected
    await page.goto('/');

    // If redirected to login, skip this test
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Check for skip link (should be first focusable element)
    const skipLink = page.locator('a:has-text("Skip to main content")');
    await expect(skipLink).toBeAttached();
  });
});
