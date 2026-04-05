/**
 * Basic example showing how to use the Self-Healing Testing Framework
 */

import { createFramework } from '../src/index.js';

async function main() {
  console.log('🚀 Self-Healing Testing Framework - Basic Example\n');

  // Create framework instance with configuration
  const framework = createFramework({
    framework: 'playwright',
    enableHealing: true,
    autoApply: false, // Require human approval for healing
    confidenceThreshold: 0.7,
    screenshotOnFailure: true,
    outputDir: './test-results',
    verbose: true,
    // API key should be set via environment variable GEMINI_API_KEY
  });

  try {
    // Example 1: Run a single test
    console.log('Example 1: Running single test...');
    const singleResult = await framework.runTest('./examples/sample-tests/login.test.ts');

    console.log('\nSingle Test Result:');
    console.log(`- Status: ${singleResult.status}`);
    console.log(`- Duration: ${singleResult.duration}ms`);
    console.log(`- Attempts: ${singleResult.attempts}`);

    if (singleResult.healingResult) {
      console.log(`- Healing applied: ${singleResult.healingResult.actions.length} actions`);
    }

    // Example 2: Run a test suite
    console.log('\n\nExample 2: Running test suite...');
    const suiteResult = await framework.runTestSuite('./examples/sample-tests');

    console.log('\nTest Suite Results:');
    console.log(`- Total tests: ${suiteResult.totalTests}`);
    console.log(`- Passed: ${suiteResult.passedTests}`);
    console.log(`- Healed: ${suiteResult.healedTests}`);
    console.log(`- Failed: ${suiteResult.failedTests}`);
    console.log(`- Duration: ${suiteResult.duration}ms`);

    // Example 3: Get healing statistics
    console.log('\n\nExample 3: Healing statistics...');
    const stats = await framework.getHealingStats();

    console.log('Healing Statistics:');
    console.log(`- Total attempts: ${stats.totalAttempts}`);
    console.log(`- Successful heals: ${stats.successfulHeals}`);
    console.log(`- Success rate: ${stats.totalAttempts > 0 ? (stats.successfulHeals / stats.totalAttempts * 100).toFixed(1) : 0}%`);
    console.log(`- Total cost: ~$${stats.totalCost.usd.toFixed(4)}`);

  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }

  console.log('\n✅ Example completed successfully!');
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}