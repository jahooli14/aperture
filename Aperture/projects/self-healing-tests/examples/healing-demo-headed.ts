/**
 * Self-Healing Demo with Headed Browser
 *
 * Watch the self-healing framework in action!
 * This will run a test against a real website with browser visible.
 */

import { createFramework } from '../src/index.js';

async function main() {
  console.log('🎭 Self-Healing Testing Framework - HEADED MODE DEMO\n');
  console.log('🌐 This will open a visible browser window');
  console.log('👀 Watch as the test runs and healing happens!\n');

  // Create framework with headed browser configuration
  const framework = createFramework({
    framework: 'playwright',
    enableHealing: true,
    autoApply: false,
    confidenceThreshold: 0.7,
    screenshotOnFailure: true,
    outputDir: './test-results',
    verbose: true,
    headless: false,        // Show browser
    slowMo: 1000,          // Slow down by 1 second per action
  });

  try {
    console.log('🚀 Starting test with headed browser...\n');

    // Create a simple inline test
    const testPath = './examples/sample-tests/login.test.ts';

    console.log(`📝 Running test: ${testPath}`);
    console.log('   The browser will open shortly...\n');

    const result = await framework.runTest(testPath);

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Attempts: ${result.attempts}`);

    if (result.healingResult) {
      console.log('\n🔧 HEALING APPLIED:');
      console.log(`   Actions: ${result.healingResult.actions.length}`);
      console.log(`   Confidence: ${(result.healingResult.confidence * 100).toFixed(1)}%`);
      if (result.healingResult.cost) {
        console.log(`   Cost: ~$${result.healingResult.cost.usd.toFixed(4)}`);
      }

      result.healingResult.actions.forEach((action, i) => {
        console.log(`\n   ${i + 1}. ${action.type.toUpperCase()}`);
        console.log(`      ${action.description}`);
        console.log(`      Old: ${action.oldValue}`);
        console.log(`      New: ${action.newValue}`);
        console.log(`      Confidence: ${(action.confidence * 100).toFixed(1)}%`);
      });
    }

    console.log('\n✅ Demo completed!');

  } catch (error) {
    console.error('\n❌ Demo encountered an error:', error);
    console.log('\n💡 TIP: Make sure you have:');
    console.log('   1. Set GEMINI_API_KEY in your .env file');
    console.log('   2. Installed Playwright browsers: npx playwright install chromium');
    console.log('   3. Built the project: npm run build');
  }
}

main().catch(console.error);
