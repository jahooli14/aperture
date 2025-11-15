/**
 * Sample e-commerce test demonstrating various UI interaction patterns
 * that commonly break and need healing
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Shopping Cart Functionality', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('https://demo-store.example.com');
  });

  test('should add items to cart', async () => {
    // Navigate to product page
    await page.click('.product-card:first-child');

    // Select size (dropdown that might change to radio buttons)
    await page.selectOption('#size-select', 'M');

    // Select color (might change from dropdown to color swatches)
    await page.selectOption('#color-select', 'blue');

    // Add to cart button (text/selector might change)
    await page.click('button:has-text("Add to Cart")');

    // Wait for cart update (animation timing might change)
    await page.waitForSelector('.cart-count[data-count="1"]');

    // Verify cart counter
    await expect(page.locator('.cart-count')).toContainText('1');
  });

  test('should update item quantities in cart', async () => {
    // Assume we have items in cart from previous test or setup
    await page.goto('/cart');

    // Wait for cart to load
    await page.waitForSelector('.cart-item');

    // Find quantity input (might change from input to +/- buttons)
    const quantityInput = page.locator('.cart-item:first-child .quantity-input');
    await quantityInput.fill('3');

    // Trigger update (might be automatic or require button click)
    await page.click('.update-cart-btn');

    // Wait for price update
    await page.waitForTimeout(1000);

    // Verify quantity updated
    await expect(quantityInput).toHaveValue('3');

    // Verify total price updated (text format might change)
    await expect(page.locator('.cart-total')).toContainText('$');
  });

  test('should remove items from cart', async () => {
    await page.goto('/cart');

    // Count initial items
    const initialCount = await page.locator('.cart-item').count();
    expect(initialCount).toBeGreaterThan(0);

    // Remove first item (button design might change)
    await page.click('.cart-item:first-child .remove-btn');

    // Handle confirmation modal (might be added/removed)
    try {
      await page.click('.confirm-remove', { timeout: 2000 });
    } catch {
      // No confirmation modal
    }

    // Wait for item to be removed
    await page.waitForTimeout(500);

    // Verify item count decreased
    const newCount = await page.locator('.cart-item').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should calculate shipping costs', async () => {
    await page.goto('/cart');

    // Enter shipping zip code
    await page.fill('#shipping-zip', '12345');

    // Click calculate shipping
    await page.click('#calculate-shipping');

    // Wait for shipping options to load
    await page.waitForSelector('.shipping-options');

    // Select standard shipping
    await page.click('input[value="standard"]');

    // Verify shipping cost is displayed
    await expect(page.locator('.shipping-cost')).toContainText('$');

    // Verify total includes shipping
    await expect(page.locator('.order-total')).toContainText('$');
  });

  test('should proceed to checkout', async () => {
    await page.goto('/cart');

    // Click checkout button (might change design/text)
    await page.click('.checkout-btn:has-text("Checkout")');

    // Should navigate to checkout page
    await page.waitForURL('**/checkout');

    // Verify checkout form is displayed
    await expect(page.locator('#checkout-form')).toBeVisible();

    // Check required fields are present
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#shipping-address')).toBeVisible();
    await expect(page.locator('#payment-info')).toBeVisible();
  });
});

/*
Healing scenarios this test covers:

1. Selector Evolution:
   - .product-card -> .item-card
   - #size-select -> .size-options (dropdown to radio)
   - button:has-text("Add to Cart") -> .add-to-cart-btn

2. UI Pattern Changes:
   - Dropdown selects -> Button groups
   - Input fields -> Stepper controls
   - Modal confirmations added/removed

3. Flow Modifications:
   - New validation steps
   - Additional form fields
   - Changed navigation patterns

4. Content Changes:
   - Button text variations
   - Price format changes
   - Error message updates

5. Timing Issues:
   - Slower API responses
   - New animations
   - Async loading patterns

The healing engine will analyze screenshots to understand:
- What elements look like now vs. expected
- Where similar functionality moved
- How user flows changed
- What new patterns to adopt
*/