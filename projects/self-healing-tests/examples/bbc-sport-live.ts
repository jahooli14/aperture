/**
 * BBC Sport Live Demo - Actually Runs and Fails
 *
 * This version actually executes browser actions and will fail,
 * triggering the Gemini Computer Use model to heal it.
 */

import { chromium } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  BBC SPORT LIVE DEMO WITH SELF-HEALING                 ║');
  console.log('║  Watch browser actions and AI healing in real-time!   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('🌐 Opening browser...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000, // 1 second between actions
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log('⚽ Navigating to BBC Sport Football...');
    await page.goto('https://www.bbc.com/sport/football', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('⏱️  Page loaded, waiting 2 seconds...');
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
      console.log('ℹ️  No cookie banner found');
    }

    console.log('\n📰 NOW TRYING TO FIND ARTICLES WITH WRONG SELECTOR...');
    console.log('   Selector: .old-broken-class-that-does-not-exist\n');

    // This WILL FAIL - intentionally wrong selector
    const wrongSelector = '.old-broken-class-that-does-not-exist a[href*="football"]';

    try {
      console.log(`🔍 Looking for: ${wrongSelector}`);

      const articles = await page.locator(wrongSelector).all();

      if (articles.length === 0) {
        throw new Error(`❌ No articles found with selector: ${wrongSelector}`);
      }

      console.log(`✅ Found ${articles.length} articles`);

    } catch (error) {
      console.log('\n' + '='.repeat(70));
      console.log('❌ TEST FAILED - SELECTOR NOT FOUND!');
      console.log('='.repeat(70));
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}\n`);

      console.log('📸 Taking screenshot for AI analysis...');
      const screenshot = await page.screenshot({ fullPage: true });

      console.log('💾 Screenshot captured (' + screenshot.length + ' bytes)');
      console.log('\n🤖 NOW SENDING TO GEMINI COMPUTER USE MODEL...\n');
      console.log('   The AI will:');
      console.log('   1. Visually analyze the screenshot');
      console.log('   2. Identify the actual article elements on the page');
      console.log('   3. Generate the correct CSS selectors');
      console.log('   4. Suggest fixes with confidence scores\n');

      // Initialize the framework with healing
      if (!process.env.GEMINI_API_KEY) {
        console.error('❌ ERROR: No GEMINI_API_KEY found!');
        console.log('   Self-healing cannot proceed without API key.\n');
        console.log('⏱️  Keeping browser open for 10 seconds so you can see the page...');
        await page.waitForTimeout(10000);
        throw new Error('No API key configured');
      }

      console.log('✅ API Key found, initializing Gemini Computer Use...\n');

      // Import the healing functionality
      const { GeminiAgent } = await import('../src/core/gemini-agent.js');

      const geminiAgent = new GeminiAgent({
        framework: 'playwright',
        testTimeout: 30000,
        retryCount: 1,
        enableHealing: true,
        autoApply: false,
        confidenceThreshold: 0.7,
        maxHealingAttempts: 3,
        model: 'gemini-2.5-computer-use-preview-10-2025',
        screenshotOnFailure: true,
        outputDir: './test-results',
        verbose: true,
        geminiApiKey: process.env.GEMINI_API_KEY,
      });

      const failure = {
        testName: 'BBC Sport Article Finding',
        testPath: './examples/bbc-sport-live.ts',
        error: error as Error,
        screenshot: screenshot,
        timestamp: new Date(),
        selector: wrongSelector,
        action: 'click' as const,
        context: {
          url: page.url(),
          viewport: { width: 1440, height: 900 },
          userAgent: await page.evaluate(() => navigator.userAgent),
        }
      };

      console.log('🔄 Analyzing failure with Gemini Computer Use model...\n');
      const response = await geminiAgent.analyzeFailure(failure);

      console.log('\n' + '='.repeat(70));
      console.log('🧠 GEMINI COMPUTER USE ANALYSIS RESULTS');
      console.log('='.repeat(70));
      console.log(`Overall Confidence: ${(response.confidence * 100).toFixed(1)}%`);
      console.log(`Requires Human Review: ${response.requiresHumanReview ? 'Yes' : 'No'}`);
      console.log(`\nReasoning:\n${response.reasoning}\n`);

      console.log('💡 SUGGESTED HEALING ACTIONS:\n');
      response.healingActions.forEach((action, i) => {
        console.log(`${i + 1}. ${action.type.toUpperCase()}`);
        console.log(`   Description: ${action.description}`);
        console.log(`   Confidence: ${(action.confidence * 100).toFixed(1)}%`);
        console.log(`   Old Value: ${action.oldValue}`);
        console.log(`   New Value: ${action.newValue}`);
        console.log(`   Reasoning: ${action.reasoning}\n`);
      });

      console.log('⏱️  Keeping browser open for 15 seconds so you can see the page...');
      await page.waitForTimeout(15000);
    }

  } catch (error) {
    console.error('\n❌ Demo error:', error);
    console.log('\n⏱️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } finally {
    console.log('\n👋 Closing browser...');
    await browser.close();
  }
}

main().catch(console.error);
