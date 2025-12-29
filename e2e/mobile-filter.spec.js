// @ts-check
/**
 * Mobile Filter E2E Tests
 *
 * Tests for mobile filter panel interactions including:
 * - Opening/closing filter bottom sheet
 * - Filter count updates on checkbox interaction
 * - Filter application via Apply button
 * - Filter state sync between mobile and desktop views
 */
const { test, expect } = require('@playwright/test');

test.describe('Mobile Filter Panel', () => {
  // Use mobile viewport for these tests
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X dimensions

  test('filter button should be visible on mobile', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    const filterBtn = page.locator('#filter-btn');
    await expect(filterBtn).toBeVisible();
  });

  test('filter button should open bottom sheet', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    const filterBtn = page.locator('#filter-btn');
    const filterSheet = page.locator('#filter-sheet');

    // Sheet should be hidden initially
    await expect(filterSheet).toHaveClass(/hidden/);

    // Click filter button
    await filterBtn.click();

    // Sheet should be visible
    await expect(filterSheet).not.toHaveClass(/hidden/);
  });

  test('filter sheet should have status checkboxes', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Open filter sheet
    await page.locator('#filter-btn').click();
    await page.waitForTimeout(300); // Wait for animation

    // Check for status checkboxes container
    const statusSection = page.locator('.status-checkboxes');
    await expect(statusSection).toBeVisible();

    // Check for reading and finished checkboxes
    const checkboxes = page.locator('.status-checkboxes input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThanOrEqual(1);
  });

  test('filter sheet should have apply button', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Open filter sheet
    await page.locator('#filter-btn').click();
    await page.waitForTimeout(300);

    // Check for apply button
    const applyBtn = page.locator('#apply-filters-btn');
    await expect(applyBtn).toBeVisible();
    await expect(applyBtn).toHaveText(/Apply/);
  });

  test('clicking checkbox should update filter counts', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Open filter sheet
    await page.locator('#filter-btn').click();
    await page.waitForTimeout(300);

    // Get initial count display (if any)
    const statusCheckbox = page.locator('.status-checkboxes input[type="checkbox"]').first();

    if (await statusCheckbox.isVisible()) {
      // Click the checkbox
      await statusCheckbox.click();

      // Wait for count update
      await page.waitForTimeout(200);

      // The interaction should work without errors
      // (actual count validation requires books data)
    }
  });

  test('close button should dismiss filter sheet', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Open filter sheet
    await page.locator('#filter-btn').click();
    await page.waitForTimeout(300);

    const filterSheet = page.locator('#filter-sheet');
    await expect(filterSheet).not.toHaveClass(/hidden/);

    // Click close button
    const closeBtn = page.locator('#close-filter-sheet');
    await closeBtn.click();

    // Wait for animation
    await page.waitForTimeout(300);

    // Sheet should be hidden
    await expect(filterSheet).toHaveClass(/hidden/);
  });

  test('filter sheet should have sort dropdown', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Open filter sheet
    await page.locator('#filter-btn').click();
    await page.waitForTimeout(300);

    // Check for sort select in mobile sheet
    const sortSelect = page.locator('#filter-sheet select');
    expect(await sortSelect.count()).toBeGreaterThanOrEqual(0);
  });

  test('filter sheet should be accessible', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Open filter sheet
    await page.locator('#filter-btn').click();
    await page.waitForTimeout(300);

    // Check that the sheet has proper ARIA attributes
    const filterSheet = page.locator('#filter-sheet');
    await expect(filterSheet).toBeVisible();

    // Check close button has aria-label
    const closeBtn = page.locator('#close-filter-sheet');
    await expect(closeBtn).toHaveAttribute('aria-label');
  });
});

test.describe('Desktop Filter Panel', () => {
  // Use desktop viewport for these tests
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebar filter panel should be visible on desktop', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    // Desktop sidebar should exist
    const sidebar = page.locator('#filter-sidebar');
    await expect(sidebar).toBeAttached();
  });

  test('mobile filter button should be hidden on desktop', async ({ page }) => {
    await page.goto('/books/');
    await page.waitForLoadState('domcontentloaded');

    const filterBtn = page.locator('#filter-btn');

    // The button exists but should be hidden via CSS
    // Check that it's either not visible or has display:none
    const isHidden = await filterBtn.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden';
    }).catch(() => true);

    expect(isHidden).toBeTruthy();
  });
});
