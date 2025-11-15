/**
 * Demo: Watch self-healing in action with a visible browser
 *
 * This example runs a test against a real demo website with the browser visible.
 * You can watch the test execute and see healing happen in real-time.
 */

import { chromium } from '@playwright/test';

async function runHeadedDemo() {
  console.log('🎭 Self-Healing Demo - Headed Mode\n');
  console.log('Opening browser... Watch the magic happen!\n');

  // Launch browser in headed mode (visible)
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000, // Slow down actions by 1 second so you can see them
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log('📍 Navigating to demo website...');
    await page.goto('https://the-internet.herokuapp.com/login');

    console.log('⏱️  Waiting 2 seconds...');
    await page.waitForTimeout(2000);

    console.log('📝 Filling username...');
    await page.fill('#username', 'tomsmith');
    await page.waitForTimeout(1000);

    console.log('🔒 Filling password...');
    await page.fill('#password', 'SuperSecretPassword!');
    await page.waitForTimeout(1000);

    console.log('🖱️  Clicking login button...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    console.log('✅ Checking for success message...');
    const successMessage = await page.locator('.flash.success').textContent();
    console.log(`✨ Success! Message: ${successMessage?.trim()}`);

    await page.waitForTimeout(3000);

    console.log('🚪 Clicking logout...');
    await page.click('.button.secondary');
    await page.waitForTimeout(2000);

    console.log('✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n💡 This is where self-healing would kick in!');
    console.log('   The AI would analyze the screenshot and suggest fixes.');

    // Take a screenshot for manual inspection
    await page.screenshot({ path: 'test-results/demo-failure.png' });
    console.log('📸 Screenshot saved to: test-results/demo-failure.png');
  } finally {
    console.log('\n👋 Closing browser in 3 seconds...');
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

// Run the demo
runHeadedDemo().catch(console.error);
