/**
 * BBC Sport Self-Healing Demo - COMPLETE CYCLE
 *
 * Browser stays open the entire time while:
 * 1. Test fails with wrong selector
 * 2. AI analyzes the actual page
 * 3. AI suggests correct selector
 * 4. Test is fixed and re-runs successfully
 * 5. Task completes (opens 5 articles)
 */

import { chromium, Page, BrowserContext } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { GeminiAgent } from '../src/core/gemini-agent.js';

dotenvConfig();

async function openArticlesWithSelector(page: Page, selector: string, context: BrowserContext): Promise<boolean> {
  console.log(`\n🔍 Attempting with selector: ${selector}`);

  try {
    // Find article links
    const articles = await page.locator(selector).all();
    console.log(`   Found ${articles.length} matching elements`);

    if (articles.length < 5) {
      console.log(`   ❌ Not enough articles (need 5, found ${articles.length})`);
      return false;
    }

    console.log(`   ✅ Found ${articles.length} articles!`);
    console.log(`\n📰 Opening first 5 articles in new tabs...\n`);

    // Get URLs and open in new tabs
    for (let i = 0; i < 5; i++) {
      try {
        const article = articles[i];
        const text = await article.textContent();
        const href = await article.getAttribute('href');

        if (!href) continue;

        const fullUrl = href.startsWith('http') ? href : `https://www.bbc.com${href}`;

        console.log(`   ${i + 1}. ${text?.trim().slice(0, 60)}`);
        console.log(`      → Opening: ${fullUrl.slice(0, 80)}...`);

        // Open in new tab
        const newPage = await context.newPage();
        await newPage.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

        console.log(`      ✅ Opened in tab ${i + 2}\n`);

        await page.waitForTimeout(800);
      } catch (e) {
        console.log(`      ⚠️  Failed to open article ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}\n`);
      }
    }

    console.log(`\n🎉 Successfully opened 5 football articles!\n`);
    return true;

  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  BBC SPORT SELF-HEALING DEMO - COMPLETE CYCLE          ║');
  console.log('║  Browser stays open - watch the full healing process! ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not found!');
    console.log('   Set your API key in .env file to enable self-healing.\n');
    return;
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Opening BBC Sport Football...');
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
        await page.waitForTimeout(1500);
      }
    } catch (e) {
      console.log('ℹ️  No cookie banner');
    }

    console.log('\n' + '='.repeat(70));
    console.log('STEP 1: ATTEMPT WITH BROKEN SELECTOR');
    console.log('='.repeat(70));

    const brokenSelector = '.old-broken-class-that-does-not-exist a[href*="football"]';
    const step1Success = await openArticlesWithSelector(page, brokenSelector, context);

    if (step1Success) {
      console.log('\n✅ Surprisingly, the "broken" selector worked! Demo complete.');
      console.log('⏱️  Keeping browser open for 15 seconds...');
      await page.waitForTimeout(15000);
      return;
    }

    console.log('\n⏱️  Waiting 2 seconds before healing...\n');
    await page.waitForTimeout(2000);

    console.log('='.repeat(70));
    console.log('STEP 2: AI ANALYZES PAGE (GEMINI VISION)');
    console.log('='.repeat(70));

    console.log('\n📸 Capturing screenshot of actual page...');
    const screenshot = await page.screenshot({ fullPage: true });
    console.log(`✅ Screenshot captured (${(screenshot.length / 1024).toFixed(0)} KB)`);

    console.log('\n🤖 Sending to Gemini 2.0 Flash for visual analysis...');
    console.log('   (AI is analyzing the actual BBC Sport page layout)\n');

    const geminiAgent = new GeminiAgent({
      framework: 'playwright',
      testTimeout: 30000,
      retryCount: 1,
      enableHealing: true,
      autoApply: false,
      confidenceThreshold: 0.7,
      maxHealingAttempts: 3,
      model: 'gemini-2.0-flash-exp',
      screenshotOnFailure: true,
      outputDir: './test-results',
      verbose: true,
      geminiApiKey: process.env.GEMINI_API_KEY,
    });

    const failure = {
      testName: 'BBC Sport - Find 5 Football Articles',
      testPath: './examples/bbc-self-healing-live.ts',
      error: new Error(`No articles found with selector: ${brokenSelector}`),
      screenshot: screenshot,
      timestamp: new Date(),
      selector: brokenSelector,
      action: 'click' as const,
      context: {
        url: page.url(),
        viewport: { width: 1440, height: 900 },
        userAgent: await page.evaluate(() => navigator.userAgent),
      }
    };

    console.log('⏳ Analyzing... (this takes 5-10 seconds)\n');
    const aiResponse = await geminiAgent.analyzeFailure(failure);

    console.log('✅ AI Analysis Complete!\n');
    console.log('='.repeat(70));
    console.log('🧠 GEMINI ANALYSIS RESULTS');
    console.log('='.repeat(70));
    console.log(`Confidence: ${(aiResponse.confidence * 100).toFixed(0)}%`);
    console.log(`Reasoning: ${aiResponse.reasoning}\n`);

    if (aiResponse.healingActions.length === 0) {
      console.log('❌ No healing actions suggested. Cannot proceed.');
      console.log('⏱️  Keeping browser open for 15 seconds...');
      await page.waitForTimeout(15000);
      return;
    }

    console.log('💡 SUGGESTED FIXES:\n');
    aiResponse.healingActions.forEach((action, i) => {
      console.log(`${i + 1}. ${action.type.toUpperCase()}`);
      console.log(`   Confidence: ${(action.confidence * 100).toFixed(0)}%`);
      console.log(`   Description: ${action.description}`);
      console.log(`   New Selector: ${action.newValue}\n`);
    });

    console.log('⏱️  Waiting 3 seconds before applying fix...\n');
    await page.waitForTimeout(3000);

    console.log('='.repeat(70));
    console.log('STEP 3: APPLY AI-SUGGESTED FIX');
    console.log('='.repeat(70));

    // Try each suggested healing action
    for (let i = 0; i < aiResponse.healingActions.length; i++) {
      const action = aiResponse.healingActions[i];

      console.log(`\n🔧 Trying AI suggestion #${i + 1}: ${action.newValue}`);
      console.log(`   (Confidence: ${(action.confidence * 100).toFixed(0)}%)\n`);

      const success = await openArticlesWithSelector(page, action.newValue, context);

      if (success) {
        console.log('='.repeat(70));
        console.log('✅ SELF-HEALING SUCCESSFUL!');
        console.log('='.repeat(70));
        console.log('\n📊 SUMMARY:');
        console.log('   1. ❌ Original selector failed');
        console.log('   2. 📸 Screenshot captured');
        console.log('   3. 🧠 Gemini analyzed the actual page');
        console.log(`   4. 💡 AI suggested: ${action.newValue}`);
        console.log('   5. ✅ New selector worked!');
        console.log('   6. 🎉 Successfully opened 5 articles!\n');
        console.log('🎬 Check your browser - 6 tabs open with BBC Sport articles!\n');
        console.log('⏱️  Keeping browser open for 30 seconds...');
        await page.waitForTimeout(30000);
        return;
      }

      console.log(`\n⚠️  Suggestion #${i + 1} didn't work, trying next...\n`);
      await page.waitForTimeout(2000);
    }

    console.log('='.repeat(70));
    console.log('❌ HEALING FAILED');
    console.log('='.repeat(70));
    console.log('\nNone of the AI suggestions worked.');
    console.log('This could mean:');
    console.log('  - BBC Sport structure is very different');
    console.log('  - Need more context/better prompts');
    console.log('  - Manual intervention required\n');

    console.log('⏱️  Keeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\n⏱️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } finally {
    console.log('\n👋 Closing browser...');
    await browser.close();
  }
}

main().catch(console.error);
