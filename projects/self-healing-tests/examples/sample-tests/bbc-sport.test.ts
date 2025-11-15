/**
 * BBC Sport Football Test - With Self-Healing
 *
 * This test will use the self-healing framework to automatically fix
 * selector issues when BBC Sport's HTML changes.
 */

import { test, expect } from '@playwright/test';

test.describe('BBC Sport Football Articles', () => {
  test('should find and open 5 recent football articles', async ({ page }) => {
    console.log('⚽ Navigating to BBC Sport Football...');

    // Navigate to BBC Sport
    await page.goto('https://www.bbc.com/sport/football', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    await page.waitForTimeout(1500);

    // Handle cookie banner if present
    try {
      const cookieButton = page.locator('button:has-text("Accept"), button:has-text("agree")').first();
      await cookieButton.click({ timeout: 3000 });
      console.log('✅ Accepted cookies');
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('ℹ️  No cookie banner');
    }

    await page.waitForTimeout(2000);

    // This selector WILL FAIL - perfect for self-healing demo!
    console.log('📰 Looking for article links with OLD selector...');

    // Use an INTENTIONALLY WRONG selector to trigger healing
    const articleLinks = page.locator('.old-article-class-that-does-not-exist a[href*="/sport/football"]');

    // Wait for articles to load
    await expect(articleLinks.first()).toBeVisible({ timeout: 10000 });

    // Get count of articles found
    const count = await articleLinks.count();
    console.log(`✅ Found ${count} articles`);

    // Verify we found at least 5 articles
    expect(count).toBeGreaterThanOrEqual(5);

    // Get first 5 article URLs and titles
    const articles = [];
    for (let i = 0; i < Math.min(5, count); i++) {
      const article = articleLinks.nth(i);
      const href = await article.getAttribute('href');
      const text = await article.textContent();

      articles.push({
        url: href,
        title: text?.trim().slice(0, 50)
      });
    }

    console.log('\n📋 Found articles:');
    articles.forEach((a, i) => {
      console.log(`${i + 1}. ${a.title}`);
    });

    // Verify all articles have valid URLs
    for (const article of articles) {
      expect(article.url).toBeTruthy();
      expect(article.url).toContain('sport');
    }

    console.log('\n✅ Test passed - Found 5 football articles');

    // Keep browser open for 5 seconds so you can see the result
    console.log('\n⏱️  Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
  });
});
