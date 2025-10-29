/**
 * BBC Sport Football Demo - Opens 5 most recent football articles
 *
 * This demo navigates BBC Sport, finds the football section,
 * and opens the 5 most recent articles in new tabs.
 *
 * Perfect for testing self-healing when selectors change!
 */

import { chromium } from '@playwright/test';

async function bbcSportDemo() {
  console.log('⚽ BBC Sport Football Demo - Opening 5 Recent Articles\n');
  console.log('🎬 Launching browser...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 800, // Slow down to watch the action
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to BBC Sport...');
    await page.goto('https://www.bbc.com/sport', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('⚽ Looking for Football section...');

    // Try to find and click Football link in navigation
    try {
      // Accept cookies if present
      const cookiesButton = page.locator('button:has-text("Accept"), button:has-text("agree")').first();
      if (await cookiesButton.isVisible({ timeout: 3000 })) {
        console.log('🍪 Accepting cookies...');
        await cookiesButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('   No cookie banner or already accepted');
    }

    // Navigate to Football
    console.log('🔍 Finding Football link...');

    // Try multiple selectors (this is where self-healing would help!)
    const footballSelectors = [
      'a[href*="football"]',
      'a:has-text("Football")',
      '[data-testid*="football"]',
      'nav a:has-text("Football")',
    ];

    let footballClicked = false;
    for (const selector of footballSelectors) {
      try {
        const link = page.locator(selector).first();
        if (await link.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found Football link with selector: ${selector}`);
          await link.click();
          footballClicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!footballClicked) {
      // Try direct URL
      console.log('📍 Going directly to football section...');
      await page.goto('https://www.bbc.com/sport/football', { waitUntil: 'domcontentloaded' });
    }

    await page.waitForTimeout(2000);
    console.log('⚽ On Football section!\n');

    // Find article links
    console.log('📰 Finding recent football articles...');

    // Look for article links (BBC Sport uses various patterns)
    const articleSelectors = [
      'article a[href*="/sport/football"]',
      '.ssrcss-1mrs5ns-StyledLink',
      '[data-testid="card-headline"] a',
      'a.qa-story-link',
      'article h3 a',
    ];

    let articles: any[] = [];

    for (const selector of articleSelectors) {
      try {
        const links = await page.locator(selector).all();
        if (links.length > 0) {
          console.log(`✅ Found ${links.length} articles with selector: ${selector}`);
          articles = links.slice(0, 5); // Take first 5
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (articles.length === 0) {
      console.log('⚠️  Could not find article links with known selectors');
      console.log('   This is where self-healing AI would analyze the page!');

      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/bbc-sport-analysis.png' });
      console.log('📸 Screenshot saved to: test-results/bbc-sport-analysis.png');

      await page.waitForTimeout(3000);
      return;
    }

    console.log(`\n📰 Found ${articles.length} articles. Opening them...\n`);

    // Get article URLs and titles
    const articleData = await Promise.all(
      articles.map(async (article, index) => {
        const url = await article.getAttribute('href');
        const text = await article.textContent();
        return {
          index: index + 1,
          url: url?.startsWith('http') ? url : `https://www.bbc.com${url}`,
          title: text?.trim().slice(0, 60) || 'No title'
        };
      })
    );

    // Open each article in a new tab
    for (const article of articleData) {
      console.log(`${article.index}. Opening: ${article.title}...`);

      const newPage = await context.newPage();
      await newPage.goto(article.url, { waitUntil: 'domcontentloaded' });

      console.log(`   ✅ Opened in new tab`);
      await page.waitForTimeout(1500);
    }

    console.log('\n🎉 Successfully opened all 5 articles!');
    console.log('👀 Check the browser tabs to see them all.');

    console.log('\n⏱️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    console.log('\n💡 This is a perfect scenario for self-healing!');
    console.log('   The AI would:');
    console.log('   1. Analyze the page screenshot');
    console.log('   2. Find the actual selectors being used');
    console.log('   3. Update the test with correct selectors');
    console.log('   4. Re-run successfully');

    // Take screenshot
    await page.screenshot({ path: 'test-results/bbc-sport-failure.png', fullPage: true });
    console.log('\n📸 Screenshot saved for AI analysis');

    await page.waitForTimeout(5000);

  } finally {
    console.log('\n👋 Closing browser...');
    await browser.close();
  }
}

// Run the demo
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  BBC SPORT FOOTBALL DEMO                               ║');
console.log('║  Opens 5 most recent football articles                ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

bbcSportDemo().catch(console.error);
