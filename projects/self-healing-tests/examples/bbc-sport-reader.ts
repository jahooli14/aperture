/**
 * BBC Sport Article Reader - Computer Use Demo
 *
 * This demo shows the Computer Use agent reading 5 different articles
 * from BBC Sport using visual understanding and adaptive navigation.
 */

import { chromium } from 'playwright';
import { PlaywrightAdapter } from '../src/adapters/playwright.js';
import { ComputerUseAgent } from '../src/core/computer-use-agent.js';
import { TestConfig, TestFailure } from '../src/types/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 BBC SPORT ARTICLE READER - Computer Use Demo');
  console.log('='.repeat(80) + '\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in environment!');
    console.error('Please set your Gemini API key in .env file');
    return;
  }

  // Create configuration
  const config: TestConfig = {
    framework: 'playwright',
    testTimeout: 60000,
    retryCount: 1,
    headless: false, // Keep browser visible to see the agent work
    slowMo: 500,     // Slow down for visibility
    enableHealing: true,
    autoApply: true,
    confidenceThreshold: 0.7,
    maxHealingAttempts: 10, // Allow more steps for article reading
    model: 'gemini-2.0-flash-exp',
    screenshotOnFailure: true,
    outputDir: './test-results',
    verbose: true,
    geminiApiKey: process.env.GEMINI_API_KEY,
  };

  // Create adapter
  const adapter = new PlaywrightAdapter(config);

  // Launch browser manually for this demo
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to BBC Sport...\n');
    await page.goto('https://www.bbc.com/sport', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Handle cookie banner
    try {
      const cookieButton = page.locator('button:has-text("Accept"), button:has-text("agree"), button:has-text("Agree")').first();
      if (await cookieButton.isVisible({ timeout: 3000 })) {
        console.log('🍪 Accepting cookies...\n');
        await cookieButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('No cookie banner found, continuing...\n');
    }

    // Take initial screenshot
    const screenshot = await page.screenshot({ fullPage: false });

    // Create a simulated test failure to trigger Computer Use
    const testFailure: TestFailure = {
      testName: 'BBC Sport Article Reader',
      testPath: './examples/bbc-sport-reader.ts',
      error: new Error('Task: Read 5 different articles from BBC Sport'),
      screenshot,
      timestamp: new Date(),
      action: 'navigate',
      context: {
        url: page.url(),
        viewport: { width: 1440, height: 900 },
        userAgent: await page.evaluate(() => navigator.userAgent)
      }
    };

    // Override the adapter's page for Computer Use execution
    (adapter as any).page = page;
    (adapter as any).context = context;
    (adapter as any).browser = browser;

    // Create Computer Use agent
    const agent = new ComputerUseAgent(adapter, config);

    // Task prompt for reading 5 articles
    const taskPrompt = `
You are tasked with reading 5 different articles from BBC Sport.

MISSION:
1. Find and click on the FIRST article headline you see
2. Wait for it to load and read the headline + first paragraph
3. Go back to the main page
4. Find and click on a DIFFERENT article (not the same one)
5. Repeat until you have read 5 different articles

IMPORTANT RULES:
- Keep track of which articles you've read (remember their headlines)
- Don't click the same article twice
- After reading each article, you MUST go back to find the next one
- Look for article headlines visually - they are usually large, bold text with links
- Articles are typically in the main content area, not in sidebars
- When you've successfully read 5 DIFFERENT articles, respond with: "TASK_COMPLETE: Read 5 articles: [list the headlines]"

CURRENT STATE:
You are on the BBC Sport homepage. Start by finding the first article headline to click.

BEGIN: Find and click the first article.
`;

    console.log('🤖 Starting Computer Use Agent...\n');
    console.log('📋 Task: Read 5 different BBC Sport articles\n');
    console.log('⏱️  This may take 1-2 minutes. Watch the browser to see the agent work!\n');
    console.log('='.repeat(80) + '\n');

    // Execute the agentic control loop
    const result = await agent.executeHealingWorkflow(testFailure, taskPrompt);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`Steps Taken: ${result.steps}`);
    console.log(`Task Complete: ${result.finalState.taskComplete ? '✅ YES' : '⚠️  NO'}`);

    // Estimate cost
    const cost = await agent.estimateCost(result.steps);
    console.log(`\n💰 Cost Estimate:`);
    console.log(`   Tokens: ~${cost.tokens.toLocaleString()}`);
    console.log(`   USD: ~$${cost.usd.toFixed(4)}`);

    console.log('\n' + '='.repeat(80));

    if (result.success) {
      console.log('\n✅ SUCCESS! The Computer Use agent successfully read 5 articles!');
      console.log('📝 Check the console output above to see the article headlines.\n');
    } else {
      console.log('\n⚠️  Task did not complete within the step limit.');
      console.log('💡 Try increasing MAX_HEALING_ATTEMPTS or adjusting the task prompt.\n');
    }

    // Keep browser open for 10 seconds to see final state
    console.log('⏱️  Keeping browser open for 10 seconds...\n');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ Error during demo:', error);
  } finally {
    await context.close();
    await browser.close();
    console.log('🏁 Demo complete!\n');
  }
}

main().catch(console.error);
