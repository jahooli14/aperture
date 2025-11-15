/**
 * Sample test that demonstrates common failure scenarios
 * that the self-healing framework can fix
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Login Functionality', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('https://example.com/login');
  });

  test('should login with valid credentials', async () => {
    // These selectors might change, causing test failures
    // The self-healing framework can detect and fix them

    // Fill username field
    await page.fill('#username', 'testuser@example.com');

    // Fill password field
    await page.fill('#password', 'password123');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation or success indicator
    await page.waitForSelector('.dashboard-header');

    // Assert successful login
    await expect(page.locator('.user-name')).toContainText('Test User');
  });

  test('should show error for invalid credentials', async () => {
    // Fill with invalid credentials
    await page.fill('#username', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
  });

  test('should validate required fields', async () => {
    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('#username-error')).toContainText('Username is required');
    await expect(page.locator('#password-error')).toContainText('Password is required');
  });

  test('should handle forgot password flow', async () => {
    // Click forgot password link
    await page.click('a[href="/forgot-password"]');

    // Wait for navigation
    await page.waitForURL('**/forgot-password');

    // Fill email field
    await page.fill('#email', 'test@example.com');

    // Submit form
    await page.click('button[type="submit"]');

    // Check for success message
    await expect(page.locator('.success-message')).toContainText('Reset link sent');
  });
});

/*
Common failure scenarios this test might encounter:

1. Selector Changes:
   - #username -> #email-input
   - button[type="submit"] -> .login-btn
   - .dashboard-header -> #main-dashboard

2. Timing Issues:
   - Page loads slower, needs longer waits
   - Elements appear after animations

3. Text Changes:
   - "Invalid credentials" -> "Login failed"
   - "Test User" -> different user display format

4. Flow Changes:
   - Additional steps in login process
   - New validation requirements
   - Different success indicators

The self-healing framework will:
1. Detect these failures via screenshots and error analysis
2. Use Gemini to understand what changed
3. Suggest new selectors or flow modifications
4. Apply fixes automatically or with human approval
5. Re-run tests to verify fixes work
*/