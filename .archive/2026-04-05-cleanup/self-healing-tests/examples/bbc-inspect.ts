/**
 * BBC Sport Page Inspector
 *
 * Let's see what's actually on the page and find the right selectors!
 */

import { chromium } from '@playwright/test';

async function main() {
  console.log('🔍 BBC SPORT PAGE INSPECTOR\n');
  console.log('Let\'s see what\'s actually on the page...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const page = await browser.newPage();

  try {
    console.log('⚽ Navigating to BBC Sport Football...');
    await page.goto('https://www.bbc.com/sport/football', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    // Handle cookies
    try {
      const cookieButton = page.locator('button:has-text("Accept"), button:has-text("agree")').first();
      if (await cookieButton.isVisible({ timeout: 3000 })) {
        console.log('🍪 Accepting cookies...');
        await cookieButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('ℹ️  No cookie banner');
    }

    console.log('\n' + '='.repeat(70));
    console.log('INSPECTING PAGE FOR ARTICLE LINKS');
    console.log('='.repeat(70));

    // Try various common selectors for article links
    const selectorsToTry = [
      'a[href*="/sport/football/articles/"]',
      'a[href*="/sport/football"][href*="live"]',
      'article a',
      '.qa-story-link',
      '[data-testid*="article"]',
      '[data-testid*="card"] a',
      'a[href*="/sport/"][href*="/football/"]',
      'h2 a[href*="football"]',
      'h3 a[href*="football"]',
      '.ssrcss-1mrs5ns-StyledLink',
      '.gel-layout__item a[href*="football"]',
    ];

    console.log('\n🔎 Trying different selectors...\n');

    for (const selector of selectorsToTry) {
      try {
        const elements = await page.locator(selector).all();

        if (elements.length > 0) {
          console.log(`✅ FOUND: "${selector}"`);
          console.log(`   Count: ${elements.length} elements\n`);

          if (elements.length >= 3) {
            console.log(`   📋 First 3 links:\n`);
            for (let i = 0; i < Math.min(3, elements.length); i++) {
              try {
                const text = await elements[i].textContent();
                const href = await elements[i].getAttribute('href');
                if (text && href) {
                  console.log(`   ${i + 1}. ${text.trim().slice(0, 70)}`);
                  console.log(`      → ${href.slice(0, 80)}\n`);
                }
              } catch (e) {
                // Skip if element is stale
              }
            }
          }
        } else {
          console.log(`❌ "${selector}" - 0 results`);
        }
      } catch (error) {
        console.log(`❌ "${selector}" - Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('EXTRACTING ALL LINKS');
    console.log('='.repeat(70));

    // Get ALL links and filter for football
    const allLinks = await page.$$eval('a[href*="football"]', (links) => {
      return links.slice(0, 20).map((link) => ({
        text: link.textContent?.trim().slice(0, 60) || '',
        href: link.getAttribute('href') || '',
        tagName: link.tagName,
        classes: link.className,
        id: link.id || 'no-id',
        parent: link.parentElement?.tagName || 'unknown',
        parentClasses: link.parentElement?.className || 'no-class'
      }));
    });

    console.log(`\n📊 Found ${allLinks.length} links containing "football"\n`);

    allLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text}`);
      console.log(`   href: ${link.href.slice(0, 80)}`);
      console.log(`   tag: ${link.tagName}`);
      console.log(`   classes: ${link.classes.slice(0, 50)}`);
      console.log(`   parent: ${link.parent} (${link.parentClasses.slice(0, 50)})\n`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('PAGE STRUCTURE ANALYSIS');
    console.log('='.repeat(70));

    const structure = {
      title: await page.title(),
      articleTags: await page.locator('article').count(),
      h2Tags: await page.locator('h2').count(),
      h3Tags: await page.locator('h3').count(),
      dataTestIds: await page.locator('[data-testid]').count(),
      commonClasses: await page.locator('[class*="promo"]').count(),
    };

    console.log('\n📝 Page Structure:');
    console.log(`   Title: ${structure.title}`);
    console.log(`   <article> tags: ${structure.articleTags}`);
    console.log(`   <h2> tags: ${structure.h2Tags}`);
    console.log(`   <h3> tags: ${structure.h3Tags}`);
    console.log(`   [data-testid] elements: ${structure.dataTestIds}`);
    console.log(`   Elements with "promo" class: ${structure.commonClasses}`);

    console.log('\n⏱️  Keeping browser open for 30 seconds...');
    console.log('    (Use browser DevTools to inspect further!)');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Error:', error);
    await page.waitForTimeout(5000);
  } finally {
    console.log('\n👋 Closing browser...');
    await browser.close();
  }
}

main().catch(console.error);
