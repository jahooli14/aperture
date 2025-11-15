/**
 * GEMINI COMPUTER USE - Proper Implementation
 *
 * Computer Use works in a LOOP:
 * 1. Send screenshot + task
 * 2. Model returns ONE action (function call)
 * 3. Execute that action
 * 4. Send new screenshot
 * 5. Repeat until task complete
 *
 * This is how it's designed to work!
 */

import { chromium } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenvConfig();

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  GEMINI 2.5 COMPUTER USE - PROPER LOOP IMPLEMENTATION ║');
  console.log('║  AI sees → decides → acts → sees result → repeats     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not found!');
    return;
  }

  console.log('🤖 Initializing Gemini 2.5 Computer Use Model...\n');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-computer-use-preview-10-2025',
    tools: [{
      // @ts-ignore - computer_use is preview
      computer_use: {
        environment: 'ENVIRONMENT_BROWSER',
      },
    }],
  });

  const browser = await chromium.launch({
    headless: false,
    slowMo: 800,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to BBC Sport Football...');
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
    console.log('COMPUTER USE LOOP - TASK: Find and open 5 football articles');
    console.log('='.repeat(70));

    const task = 'Find 5 recent football article headlines and click on each one to open them in new tabs. After clicking each article, tell me you clicked it.';
    let articlesOpened = 0;
    const maxIterations = 10; // Safety limit
    let iteration = 0;

    // Start the conversation with the task
    const chat = model.startChat({
      history: [],
    });

    console.log(`\n📋 Task: ${task}\n`);

    while (articlesOpened < 5 && iteration < maxIterations) {
      iteration++;

      console.log(`\n${'─'.repeat(70)}`);
      console.log(`ITERATION ${iteration}`);
      console.log('─'.repeat(70));

      // Capture current state
      console.log('📸 Capturing screenshot...');
      const screenshot = await page.screenshot({ fullPage: false }); // Just visible area

      console.log('🧠 Sending to Computer Use model...');

      const prompt = iteration === 1
        ? `${task}\n\nI'm showing you a screenshot of https://www.bbc.com/sport/football. Please analyze what you see and take the next action to complete the task.`
        : `Here's the current state after the previous action. Continue the task - ${5 - articlesOpened} more articles to go.`;

      // Send screenshot and prompt
      const result = await chat.sendMessage([
        prompt,
        {
          inlineData: {
            data: screenshot.toString('base64'),
            mimeType: 'image/png'
          }
        }
      ]);

      const response = result.response;

      // Check for function calls (the proper Computer Use format)
      const functionCalls = response.functionCalls?.() || [];

      if (functionCalls.length > 0) {
        console.log(`\n🔧 Computer Use Model Action:`);

        for (const call of functionCalls) {
          console.log(`   Function: ${call.name}`);
          console.log(`   Args:`, JSON.stringify(call.args, null, 2));

          // Execute the action
          if (call.name === 'click_at') {
            const coords = call.args as { x: number; y: number };
            // Convert from normalized 1000x1000 to actual pixels
            const viewport = page.viewportSize() || { width: 1440, height: 900 };
            const x = (coords.x / 1000) * viewport.width;
            const y = (coords.y / 1000) * viewport.height;

            console.log(`\n   🖱️  Clicking at (${x.toFixed(0)}, ${y.toFixed(0)})...`);

            await page.mouse.click(x, y);
            await page.waitForTimeout(2000);

            // Check if new tab opened
            const tabs = context.pages();
            if (tabs.length > articlesOpened + 1) {
              articlesOpened++;
              console.log(`   ✅ Article ${articlesOpened} opened! (${tabs.length} total tabs)`);
            } else {
              console.log(`   ⚠️  Click executed but no new tab opened`);
            }

          } else if (call.name === 'scroll_document') {
            const scrollArgs = call.args as { distance?: number };
            console.log(`\n   📜 Scrolling...`);
            await page.mouse.wheel(0, scrollArgs.distance || 500);
            await page.waitForTimeout(1000);

          } else {
            console.log(`\n   ⚠️  Unknown action: ${call.name}`);
          }

          // Send confirmation back to the model
          const confirmation = {
            name: call.name,
            response: { success: true }
          };

          console.log(`   ✅ Action executed, sending confirmation...`);

          // Continue conversation with result
          await chat.sendMessage([
            JSON.stringify(confirmation)
          ]);
        }

      } else {
        // Model sent text instead of function call
        const text = response.text();
        console.log(`\n💬 Model response (text):`);
        console.log(`   ${text.substring(0, 200)}...`);

        if (text.toLowerCase().includes('complete') || text.toLowerCase().includes('done')) {
          console.log(`\n   ✅ Model says task is complete!`);
          break;
        }

        if (text.toLowerCase().includes('cannot') || text.toLowerCase().includes('unable')) {
          console.log(`\n   ❌ Model cannot proceed`);
          break;
        }

        console.log(`\n   ⚠️  Expected function call but got text. Continuing...`);
      }

      await page.waitForTimeout(1500);

      if (articlesOpened >= 5) {
        console.log(`\n🎉 TARGET REACHED: ${articlesOpened} articles opened!`);
        break;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('FINAL RESULTS');
    console.log('='.repeat(70));

    console.log(`\n📊 Statistics:`);
    console.log(`   Iterations: ${iteration}`);
    console.log(`   Articles Opened: ${articlesOpened}/5`);
    console.log(`   Browser Tabs: ${context.pages().length}`);

    if (articlesOpened >= 5) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Gemini Computer Use model visually identified and clicked articles!`);
      console.log(`   No CSS selectors - pure visual understanding! 🚀`);
    } else if (articlesOpened > 0) {
      console.log(`\n⚠️  PARTIAL SUCCESS`);
      console.log(`   Model managed to open ${articlesOpened} articles`);
      console.log(`   This demonstrates Computer Use capabilities!`);
    } else {
      console.log(`\n❌ TASK INCOMPLETE`);
      console.log(`   Model may need different prompting or the page structure is challenging`);
    }

    console.log(`\n🎬 Check your browser tabs!`);
    console.log(`⏱️  Keeping browser open for 30 seconds...\n`);
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\n⏱️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } finally {
    console.log('👋 Closing browser...');
    await browser.close();
  }
}

main().catch(console.error);
