// @ts-check
/**
 * Settings Pages E2E Tests
 *
 * Tests for settings page structure and navigation.
 */
const { test, expect } = require('@playwright/test');

test.describe('Settings - Main Page', () => {
  test('settings page returns 200', async ({ page }) => {
    const response = await page.goto('/settings/');
    expect(response.status()).toBe(200);
  });

  test('settings page has navigation tabs', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/')) {
      // Check profile section elements
      await expect(page.locator('main')).toBeAttached();
    } else {
      expect(url).toContain('/login/');
    }
  });
});

test.describe('Settings - Library Page', () => {
  test('library settings page returns 200', async ({ page }) => {
    const response = await page.goto('/settings/library/');
    expect(response.status()).toBe(200);
  });

  test('library page has genres section', async ({ page }) => {
    await page.goto('/settings/library/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/library/')) {
      // Check genre list container exists
      await expect(page.locator('#genres-list')).toBeAttached();

      // Check add genre button
      await expect(page.locator('#add-genre-btn')).toBeAttached();
    }
  });

  test('library page has series section', async ({ page }) => {
    await page.goto('/settings/library/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/library/')) {
      // Check series list container exists
      await expect(page.locator('#series-list')).toBeAttached();

      // Check add series button
      await expect(page.locator('#add-series-btn')).toBeAttached();
    }
  });

  test('library page has backup/restore section', async ({ page }) => {
    await page.goto('/settings/library/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/library/')) {
      // Check backup buttons exist
      await expect(page.locator('#export-btn')).toBeAttached();
      await expect(page.locator('#import-file')).toBeAttached();
    }
  });
});

test.describe('Settings - Preferences Page', () => {
  test('preferences page returns 200', async ({ page }) => {
    const response = await page.goto('/settings/preferences/');
    expect(response.status()).toBe(200);
  });

  test('preferences page has widget settings', async ({ page }) => {
    await page.goto('/settings/preferences/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/preferences/')) {
      // Check widget toggles section exists
      await expect(page.locator('#widget-toggles')).toBeAttached();
    }
  });
});

test.describe('Settings - Maintenance Page', () => {
  test('maintenance page returns 200', async ({ page }) => {
    const response = await page.goto('/settings/maintenance/');
    expect(response.status()).toBe(200);
  });

  test('maintenance page has data tools', async ({ page }) => {
    await page.goto('/settings/maintenance/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/maintenance/')) {
      // Check maintenance sections exist
      await expect(page.locator('#bin-section')).toBeAttached();
    }
  });
});

test.describe('Settings - About Page', () => {
  test('about page returns 200', async ({ page }) => {
    const response = await page.goto('/settings/about/');
    expect(response.status()).toBe(200);
  });

  test('about page has version info', async ({ page }) => {
    await page.goto('/settings/about/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/about/')) {
      // Check version is displayed
      const versionText = page.locator('text=/v\\d+\\.\\d+\\.\\d+/');
      await expect(versionText).toBeAttached();
    }
  });

  test('about page has changelog section', async ({ page }) => {
    await page.goto('/settings/about/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (url.includes('/settings/about/')) {
      // Check changelog section exists
      await expect(page.locator('#changelog')).toBeAttached();
    }
  });
});

test.describe('Settings - Navigation', () => {
  test('settings tabs work correctly', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    if (!url.includes('/settings/')) {
      test.skip();
      return;
    }

    // Check navigation links exist
    const libraryLink = page.locator('a[href="/settings/library/"]');
    const preferencesLink = page.locator('a[href="/settings/preferences/"]');
    const maintenanceLink = page.locator('a[href="/settings/maintenance/"]');
    const aboutLink = page.locator('a[href="/settings/about/"]');

    await expect(libraryLink).toBeAttached();
    await expect(preferencesLink).toBeAttached();
    await expect(maintenanceLink).toBeAttached();
    await expect(aboutLink).toBeAttached();
  });
});
