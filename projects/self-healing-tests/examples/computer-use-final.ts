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
    let iteration = 0;
    const visitedUrls: string[] = []; // Track what we've already clicked
    const clickedCoordinates: Array<{ x: number; y: number; url: string }> = []; // Track WHERE we clicked

    const initialTask = `BROWSER IS ALREADY OPEN - Do NOT try to open a browser!

You are viewing the BBC Sport Football page at https://www.bbc.com/sport/football.

YOUR SIMPLE TASK: Click on 5 different football article headlines, one at a time.

WORKFLOW:
1. Look at the screenshot - find a clickable article headline about football
2. Use click_at to click on it (articles open in the same tab)
3. I'll go back to the main page
4. Repeat for the next article

IMPORTANT:
- Use ONLY click_at with coordinates (0-999 scale)
- Look for article headlines (usually prominent text with blue/underlined links)
- Just click the article - I'll handle going back
- Don't use open_web_browser or navigate

Look at the screenshot now and click on the FIRST article headline you can see.`;

    console.log('📋 Task:', initialTask.substring(0, 100) + '...\n');

    for (iteration = 1; iteration <= maxIterations; iteration++) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`ITERATION ${iteration}`);
      console.log('─'.repeat(70));

      // Capture screenshot
      console.log('📸 Capturing screenshot...');
      const screenshot = await page.screenshot({ fullPage: false });

      // Build request with context about what we've already done
      let promptText = '';
      if (iteration === 1) {
        promptText = initialTask;
      } else {
        promptText = `Current state: ${articlesOpened}/5 articles opened.

YOU ALREADY CLICKED AT THESE LOCATIONS (avoid these areas!):
${clickedCoordinates.map((coord, i) => `${i + 1}. Position (${coord.x}, ${coord.y}) - already visited`).join('\n')}

CRITICAL: You must click on a DIFFERENT article in a DIFFERENT position!
- Look at the screenshot
- Find an article headline you HAVEN'T clicked yet
- It should be in a visually different position from the coordinates above
- Try scrolling down if needed to find more articles`;
      }

      const parts: Part[] = [
        { text: promptText },
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

            const beforeUrl = page.url();
            await page.mouse.click(pixelX, pixelY);
            await page.waitForTimeout(2000);

            // Check if URL changed (article loaded)
            const afterUrl = page.url();
            if (afterUrl !== beforeUrl && !afterUrl.endsWith('/football')) {
              // Check if we've already visited this article
              if (visitedUrls.includes(afterUrl)) {
                console.log(`   ⚠️  Already visited this article before!`);
                console.log(`      URL: ${afterUrl.substring(0, 60)}...`);
                console.log(`      Not counting as a new article - AI will be told to avoid this position.`);
              } else {
                // New article!
                articlesOpened++;
                visitedUrls.push(afterUrl);
                clickedCoordinates.push({ x, y, url: afterUrl }); // Remember this position!
                console.log(`   ✅ Article ${articlesOpened} opened!`);
                console.log(`      URL: ${afterUrl.substring(0, 60)}...`);
                console.log(`      AI will remember to avoid coordinates (${x}, ${y})`);
              }

              // Go back to main page
              console.log(`   ⬅️  Going back to football page...`);
              await page.goBack();
              await page.waitForTimeout(1500);
            } else {
              console.log(`   ⚠️  URL didn't change - might have missed the link`);
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
    console.log(`   Unique Articles Opened: ${articlesOpened}/5`);
    console.log(`   Total Iterations: ${iteration}`);

    if (visitedUrls.length > 0) {
      console.log(`\n📰 Articles Visited:`);
      visitedUrls.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
    }

    if (articlesOpened >= 5) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Gemini Computer Use visually identified and clicked 5 DIFFERENT articles!`);
      console.log(`   Pure visual understanding - no CSS selectors! 🚀`);
    } else if (articlesOpened > 0) {
      console.log(`\n⚠️  PARTIAL SUCCESS - ${articlesOpened} articles opened`);
      console.log(`   This demonstrates Computer Use capabilities!`);
    } else {
      console.log(`\n❌ No articles opened`);
      console.log(`   Model may need different prompting`);
    }

    console.log(`\n🎬 Check your browser - it navigated through articles!`);
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
