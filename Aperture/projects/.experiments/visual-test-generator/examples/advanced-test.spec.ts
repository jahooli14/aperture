import { test, expect } from '@playwright/test'
import { createSelfHealingDriver } from '../src/lib/self-healing-driver'
import { config } from '../self-healing.config'

test.describe('E-commerce Checkout - Self-Healing', () => {
  test('should complete checkout with dynamic UI', async ({ page }) => {
    await page.goto('https://shop.example.com')

    const driver = createSelfHealingDriver(
      page,
      config,
      'examples/advanced-test.spec.ts',
      'should complete checkout with dynamic UI'
    )

    // Search for product
    await driver.fill('[data-testid="search"]', 'laptop', 'search input')
    await driver.click('button[type="submit"]', 'search button')

    // Add to cart (handles A/B test variants)
    await driver.click('.product-card:first-child .add-to-cart', 'add to cart button')

    // Open cart
    await driver.click('[aria-label="Shopping cart"]', 'cart icon')

    // Proceed to checkout
    await driver.click('.checkout-button', 'checkout button')

    // Fill shipping form
    await driver.fill('#shipping-name', 'John Doe', 'name input')
    await driver.fill('#shipping-address', '123 Main St', 'address input')
    await driver.fill('#shipping-city', 'New York', 'city input')
    await driver.fill('#shipping-zip', '10001', 'zip code input')

    // Continue to payment
    await driver.click('.continue-to-payment', 'continue button')

    // Fill payment details
    await driver.fill('[name="cardNumber"]', '4242424242424242', 'card number input')
    await driver.fill('[name="expiry"]', '12/25', 'expiry date input')
    await driver.fill('[name="cvc"]', '123', 'CVC input')

    // Complete order
    await driver.click('.place-order-button', 'place order button')

    // Verify success
    await expect(page.locator('.order-confirmation')).toBeVisible()

    // Report any repairs
    await driver.generateRepairReport()
  })
})
