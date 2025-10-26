import { test, expect } from '@playwright/test'
import { createSelfHealingDriver } from '../src/lib/self-healing-driver'
import { config } from '../self-healing.config'

test.describe('Admin Login - Self-Healing Example', () => {
  test('should login successfully with self-healing', async ({ page }) => {
    // Navigate to login page
    await page.goto('https://admin.example.com/login')

    // Create self-healing driver
    const driver = createSelfHealingDriver(
      page,
      config,
      'examples/basic-test.spec.ts',
      'should login successfully with self-healing'
    )

    // Traditional selectors with AI fallback
    // If selector breaks, Gemini will find element visually
    await driver.click('#login-button', 'login button')
    await driver.fill('[name="email"]', 'admin@example.com', 'email input')
    await driver.fill('[name="password"]', 'secret123', 'password input')
    await driver.click('button[type="submit"]', 'submit button')

    // Wait for navigation
    await expect(page).toHaveURL(/dashboard/)

    // Generate repair report
    await driver.generateRepairReport()

    // If any repairs were made, they're now in Supabase
    // Review at: http://localhost:5173/repairs
  })
})
