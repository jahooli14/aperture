/**
 * BBC Sport Self-Healing Demo
 *
 * This runs the BBC Sport test through the self-healing framework.
 * When selectors fail, the Gemini Computer Use model will analyze
 * the screenshot and suggest fixes!
 */

import { createFramework } from '../src/index.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  BBC SPORT SELF-HEALING DEMO                           ║');
  console.log('║  Watch AI fix broken selectors in real-time!          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('🤖 Initializing Self-Healing Framework...');
  console.log('   - Gemini Computer Use Model: gemini-2.5-computer-use-preview-10-2025');
  console.log('   - Headed Mode: Browser will be visible');
  console.log('   - Healing: Enabled\n');

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in environment');
    console.log('\n💡 To enable self-healing:');
    console.log('   1. Copy .env.example to .env');
    console.log('   2. Add your Gemini API key from https://aistudio.google.com/app/apikey');
    console.log('   3. Run this demo again\n');
    console.log('🎬 Running without healing (will just show failure)...\n');
  }

  const framework = createFramework({
    framework: 'playwright',
    enableHealing: true,
    autoApply: false,          // Show healing suggestions for approval
    confidenceThreshold: 0.7,
    screenshotOnFailure: true,
    outputDir: './test-results',
    verbose: true,
    headless: false,           // Show browser!
    slowMo: 1500,              // Slow down by 1.5 seconds per action
  });

  try {
    console.log('🚀 Starting BBC Sport test with self-healing...\n');

    const testPath = './examples/sample-tests/bbc-sport.test.ts';
    const result = await framework.runTest(testPath);

    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Attempts: ${result.attempts}`);

    if (result.healingResult) {
      console.log('\n' + '='.repeat(70));
      console.log('🔧 SELF-HEALING APPLIED');
      console.log('='.repeat(70));
      console.log(`Actions: ${result.healingResult.actions.length}`);
      console.log(`Confidence: ${(result.healingResult.confidence * 100).toFixed(1)}%`);
      console.log(`Requires Approval: ${result.healingResult.requiresApproval ? 'Yes' : 'No'}`);

      if (result.healingResult.cost) {
        console.log(`Cost: ~$${result.healingResult.cost.usd.toFixed(4)}`);
      }

      console.log('\n📋 Healing Actions:');
      result.healingResult.actions.forEach((action, i) => {
        console.log(`\n${i + 1}. ${action.type.toUpperCase()}`);
        console.log(`   Description: ${action.description}`);
        console.log(`   Confidence: ${(action.confidence * 100).toFixed(1)}%`);
        console.log(`   Old: ${action.oldValue}`);
        console.log(`   New: ${action.newValue}`);
        console.log(`   Reasoning: ${action.reasoning}`);
      });
    }

    if (result.failure) {
      console.log('\n' + '='.repeat(70));
      console.log('❌ TEST FAILURE DETAILS');
      console.log('='.repeat(70));
      console.log(`Error: ${result.failure.error.message}`);
      console.log(`Selector: ${result.failure.selector || 'N/A'}`);
      console.log(`Action: ${result.failure.action || 'N/A'}`);

      if (result.failure.screenshot) {
        console.log('\n📸 Screenshot captured for AI analysis');
        console.log('   The Gemini Computer Use model analyzed this visually!');
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Demo completed!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Demo encountered an error:', error);
    console.log('\n💡 Common issues:');
    console.log('   - No GEMINI_API_KEY: Add to .env file');
    console.log('   - Network issues: Check internet connection');
    console.log('   - Playwright not installed: Run "npx playwright install chromium"');
  }
}

main().catch(console.error);
