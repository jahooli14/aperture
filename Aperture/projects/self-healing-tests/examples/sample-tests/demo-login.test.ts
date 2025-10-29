/**
 * Real working demo test - Uses the-internet.herokuapp.com
 * This test WILL actually run and you can watch it in headed mode!
 */

import { test, expect } from '@playwright/test';

test.describe('The Internet - Login Demo', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to the login page
    await page.goto('https://the-internet.herokuapp.com/login');

    // Fill in username
    await page.fill('#username', 'tomsmith');

    // Fill in password
    await page.fill('#password', 'SuperSecretPassword!');

    // Click the login button
    await page.click('button[type="submit"]');

    // Wait for success message
    await page.waitForSelector('.flash.success');

    // Verify we're logged in
    await expect(page.locator('.flash.success')).toContainText('You logged into a secure area');

    // Verify logout button is visible
    await expect(page.locator('.button.secondary')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');

    // Use invalid credentials
    await page.fill('#username', 'wronguser');
    await page.fill('#password', 'wrongpass');

    await page.click('button[type="submit"]');

    // Expect error message
    await expect(page.locator('.flash.error')).toContainText('Your username is invalid');
  });
});

/*
 * To run this test in HEADED mode (watch it happen):
 *
 * node dist/examples/demo-headed.js
 *
 * Or to run with the self-healing framework:
 *
 * node dist/examples/healing-demo-headed.js
 */
