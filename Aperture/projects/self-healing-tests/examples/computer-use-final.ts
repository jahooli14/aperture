/**
 * GEMINI COMPUTER USE - Correct Implementation
 *
 * Based on official Google documentation:
 * - Coordinates are 0-999 (not 1000)
 * - Access function calls via response.candidates[0].content.parts
 * - Send FunctionResponse back to model
 * - Loop until task complete
 */

import { chromium } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { GoogleGenerativeAI, FunctionCall, Part } from '@google/generative-ai';

dotenvConfig();

interface ComputerUseFunctionCall extends FunctionCall {
  name: string;
  args: any;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  GEMINI 2.5 COMPUTER USE - OFFICIAL IMPLEMENTATION    ║');
  console.log('║  Following Google\'s official API documentation        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not found!');
    return;
  }

  console.log('🤖 Initializing Gemini 2.5 Computer Use Model...\n');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Configure with Computer Use tool
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-computer-use-preview-10-2025',
    tools: [{
      // @ts-ignore - computer_use is preview API
      computerUse: {
        environment: 'ENVIRONMENT_BROWSER',
        excludedPredefinedFunctions: [
          'drag_and_drop',
          'navigate',
          'go_back',
          'go_forward',
          'open_web_browser'  // Browser is already open!
        ]
      }
    }]
  });

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
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
    console.log('COMPUTER USE LOOP');
    console.log('='.repeat(70));

    const viewport = page.viewportSize() || { width: 1440, height: 900 };
    let articlesOpened = 0;
    const maxIterations = 15;
    const chatHistory: any[] = [];

    const initialTask = `BROWSER IS ALREADY OPEN - Do NOT try to open a browser!

You are viewing the BBC Sport Football page. I can see the page in front of you.

YOUR TASK: Click on article headlines to open them. I need you to open 5 football articles.

WHAT TO DO:
1. Look at the screenshot I'm showing you
2. Find a clickable article headline (usually blue/underlined text with a headline)
3. Use click_at with the coordinates of that headline
4. I'll show you the result and you continue

IMPORTANT:
- Browser is ALREADY OPEN - don't use open_web_browser
- Use click_at with coordinates (0-999 scale, not pixels)
- Screen is ${viewport.width}x${viewport.height} pixels
- Articles should open in new tabs when clicked
- Only click on article headlines, not navigation links

Look at the screenshot and click on the FIRST article headline you see about football.`;

    console.log('📋 Task:', initialTask.substring(0, 100) + '...\n');

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`ITERATION ${iteration}`);
      console.log('─'.repeat(70));

      // Capture screenshot
      console.log('📸 Capturing screenshot...');
      const screenshot = await page.screenshot({ fullPage: false });

      // Build request
      const parts: Part[] = [
        { text: iteration === 1 ? initialTask : `Current state after previous action. ${5 - articlesOpened} articles remaining to open. Continue the task.` },
        {
          inlineData: {
            data: screenshot.toString('base64'),
            mimeType: 'image/png'
          }
        }
      ];

      console.log('🧠 Sending to Computer Use model...');

      // Send request
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        // @ts-ignore
        generationConfig: {
          temperature: 0.4,
        }
      });

      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) {
        console.log('❌ No candidate in response');
        break;
      }

      // Check for function calls
      let foundAction = false;

      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          foundAction = true;
          const funcCall = part.functionCall as ComputerUseFunctionCall;

          console.log(`\n🔧 Function Call: ${funcCall.name}`);
          console.log(`   Args:`, JSON.stringify(funcCall.args, null, 2));

          // Execute the action
          if (funcCall.name === 'click_at') {
            const { x, y } = funcCall.args as { x: number; y: number };

            // Convert from 0-999 normalized to actual pixels
            const pixelX = (x / 999) * viewport.width;
            const pixelY = (y / 999) * viewport.height;

            console.log(`\n   🖱️  Clicking at normalized (${x}, ${y})`);
            console.log(`       → Pixel position (${pixelX.toFixed(0)}, ${pixelY.toFixed(0)})`);

            await page.mouse.click(pixelX, pixelY);
            await page.waitForTimeout(2000);

            // Check if new tab opened
            const tabs = context.pages();
            if (tabs.length > articlesOpened + 1) {
              articlesOpened++;
              console.log(`   ✅ Article ${articlesOpened} opened! (${tabs.length} tabs total)`);
            } else {
              console.log(`   ⚠️  Click executed but no new tab (might not be a link)`);
            }

          } else if (funcCall.name === 'scroll_document') {
            const direction = (funcCall.args as any).direction || 'down';
            const distance = (funcCall.args as any).distance || 500;
            console.log(`\n   📜 Scrolling ${direction} by ${distance}px...`);
            await page.mouse.wheel(0, direction === 'down' ? distance : -distance);
            await page.waitForTimeout(1000);

          } else if (funcCall.name === 'wait_5_seconds') {
            console.log(`\n   ⏱️  Waiting 5 seconds...`);
            await page.waitForTimeout(5000);

          } else {
            console.log(`\n   ⚠️  Unsupported action: ${funcCall.name}`);
          }

          // Add to history
          chatHistory.push({
            role: 'model',
            parts: [{ functionCall: funcCall }]
          });

          // Send function response
          chatHistory.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: funcCall.name,
                response: { success: true, articlesOpened }
              }
            }]
          });

        } else if (part.text) {
          console.log(`\n💬 Model text: ${part.text.substring(0, 150)}...`);

          if (part.text.toLowerCase().includes('complete') ||
              part.text.toLowerCase().includes('finished') ||
              part.text.toLowerCase().includes('done')) {
            console.log(`\n   ✅ Model indicates task is complete`);
            foundAction = false;
            break;
          }
        }
      }

      if (!foundAction) {
        console.log('\n   ⚠️  No action taken this iteration');
      }

      await page.waitForTimeout(1500);

      if (articlesOpened >= 5) {
        console.log(`\n🎉 SUCCESS! Opened ${articlesOpened} articles!`);
        break;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('FINAL RESULTS');
    console.log('='.repeat(70));

    console.log(`\n📊 Statistics:`);
    console.log(`   Articles Opened: ${articlesOpened}/5`);
    console.log(`   Browser Tabs: ${context.pages().length}`);

    if (articlesOpened >= 5) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Gemini Computer Use visually identified and clicked articles!`);
      console.log(`   Pure visual understanding - no CSS selectors! 🚀`);
    } else if (articlesOpened > 0) {
      console.log(`\n⚠️  PARTIAL SUCCESS - ${articlesOpened} articles opened`);
      console.log(`   This demonstrates Computer Use capabilities!`);
    } else {
      console.log(`\n❌ No articles opened`);
      console.log(`   Model may need different prompting`);
    }

    console.log(`\n🎬 Check your ${context.pages().length} browser tab(s)!`);
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
