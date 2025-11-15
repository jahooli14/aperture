#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { SelfHealingTestFramework, defaultConfig, TestConfig } from './index.js';
import { logger, LogLevel } from './utils/logger.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('self-healing-tests')
  .description('Self-healing testing framework powered by Google Gemini Computer Use')
  .version('1.0.0');

// Global options
program
  .option('-v, --verbose', 'enable verbose logging')
  .option('-q, --quiet', 'reduce output to errors only')
  .option('--no-healing', 'disable self-healing capabilities')
  .option('--auto-apply', 'automatically apply healing actions without confirmation')
  .option('--confidence-threshold <number>', 'minimum confidence threshold for healing actions', parseFloat)
  .option('--framework <framework>', 'testing framework to use', 'playwright')
  .option('--output-dir <dir>', 'output directory for screenshots and reports', './test-results')
  .option('--gemini-api-key <key>', 'Gemini API key (or use GEMINI_API_KEY env var)')
  .option('--model <model>', 'Gemini model to use', 'gemini-2.5-pro');

// Run single test command
program
  .command('run <testPath>')
  .description('run a single test with self-healing capabilities')
  .action(async (testPath: string, options: any) => {
    const config = buildConfig(options);
    const framework = new SelfHealingTestFramework(config);

    try {
      const absolutePath = resolve(testPath);
      logger.info(`Running test: ${absolutePath}`);

      const result = await framework.runTest(absolutePath);

      // Display result
      displayTestResult(result);

      // Exit with appropriate code
      process.exit(result.status === 'passed' || result.status === 'healed' ? 0 : 1);

    } catch (error) {
      logger.error('Failed to run test:', error);
      process.exit(1);
    }
  });

// Run test suite command
program
  .command('suite <testDir>')
  .description('run a test suite with self-healing capabilities')
  .action(async (testDir: string, options: any) => {
    const config = buildConfig(options);
    const framework = new SelfHealingTestFramework(config);

    try {
      const absolutePath = resolve(testDir);
      logger.info(`Running test suite: ${absolutePath}`);

      const suite = await framework.runTestSuite(absolutePath);

      // Display results
      displaySuiteResults(suite);

      // Exit with appropriate code
      process.exit(suite.failedTests === 0 ? 0 : 1);

    } catch (error) {
      logger.error('Failed to run test suite:', error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('display healing statistics')
  .action(async (options: any) => {
    const config = buildConfig(options);
    const framework = new SelfHealingTestFramework(config);

    try {
      const stats = await framework.getHealingStats();

      logger.startGroup('Healing Statistics');
      logger.info(`Total healing attempts: ${stats.totalAttempts}`);
      logger.success(`Successful heals: ${stats.successfulHeals}`);
      logger.error(`Failed heals: ${stats.failedHeals}`);

      if (stats.totalAttempts > 0) {
        const successRate = (stats.successfulHeals / stats.totalAttempts * 100).toFixed(1);
        logger.info(`Success rate: ${successRate}%`);
        logger.info(`Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
      }

      logger.info(`Total cost: ${stats.totalCost.tokens} tokens (~$${stats.totalCost.usd.toFixed(4)})`);
      logger.endGroup();

    } catch (error) {
      logger.error('Failed to get statistics:', error);
      process.exit(1);
    }
  });

// Config validation command
program
  .command('validate-config')
  .description('validate configuration and API connectivity')
  .action(async (options: any) => {
    const config = buildConfig(options);

    logger.startGroup('Configuration Validation');

    // Check required API key
    if (!config.geminiApiKey && !config.vertexProject) {
      logger.error('❌ No API key or Vertex project configured');
      logger.info('Set GEMINI_API_KEY environment variable or use --gemini-api-key');
      process.exit(1);
    } else {
      logger.success('✅ API configuration found');
    }

    // Check framework
    if (config.framework === 'playwright') {
      logger.success('✅ Playwright framework configured');
    } else {
      logger.warn(`⚠️  Framework '${config.framework}' is not fully implemented yet`);
    }

    // Check output directory
    try {
      const { promises: fs } = await import('fs');
      await fs.mkdir(config.outputDir, { recursive: true });
      logger.success(`✅ Output directory accessible: ${config.outputDir}`);
    } catch (error) {
      logger.error(`❌ Cannot access output directory: ${config.outputDir}`);
    }

    // Test API connectivity (simplified)
    logger.info('API connectivity test would happen here in full implementation');

    logger.endGroup();
  });

// Helper function to build configuration from CLI options and environment
function buildConfig(options: any): TestConfig {
  const globalOpts = program.opts();
  const allOptions = { ...globalOpts, ...options };

  // Set logging level
  if (allOptions.verbose) {
    logger.setLevel(LogLevel.DEBUG);
  } else if (allOptions.quiet) {
    logger.setLevel(LogLevel.ERROR);
  }

  const config: TestConfig = {
    ...defaultConfig,
    framework: allOptions.framework || 'playwright',
    enableHealing: !allOptions.noHealing,
    autoApply: allOptions.autoApply || false,
    confidenceThreshold: allOptions.confidenceThreshold || defaultConfig.confidenceThreshold,
    outputDir: allOptions.outputDir || defaultConfig.outputDir,
    model: allOptions.model || defaultConfig.model,
    verbose: allOptions.verbose || false,

    // API configuration
    geminiApiKey: allOptions.geminiApiKey || process.env.GEMINI_API_KEY,
    vertexProject: process.env.VERTEX_PROJECT_ID || undefined,
    vertexLocation: process.env.VERTEX_LOCATION || 'us-central1',
  };

  return config;
}

function displayTestResult(result: any): void {
  logger.startGroup('Test Result');

  const statusSymbols: Record<string, string> = {
    passed: '✅',
    failed: '❌',
    healed: '⚕️ ',
    healing_failed: '⚕️❌'
  };
  const statusSymbol = statusSymbols[result.status] || '❓';

  logger.info(`${statusSymbol} ${result.testName}: ${result.status.toUpperCase()}`);
  logger.info(`Duration: ${result.duration}ms`);
  logger.info(`Attempts: ${result.attempts}`);

  if (result.failure) {
    logger.error(`Error: ${result.failure.error.message}`);
  }

  if (result.healingResult) {
    logger.healing(`Healing actions applied: ${result.healingResult.actions.length}`);
    logger.info(`Healing confidence: ${(result.healingResult.confidence * 100).toFixed(1)}%`);

    if (result.healingResult.cost) {
      logger.info(`Cost: ${result.healingResult.cost.tokens} tokens (~$${result.healingResult.cost.usd.toFixed(4)})`);
    }
  }

  logger.endGroup();
}

function displaySuiteResults(suite: any): void {
  logger.startGroup('Test Suite Results');

  logger.info(`Suite: ${suite.name}`);
  logger.info(`Total: ${suite.totalTests}`);
  logger.success(`Passed: ${suite.passedTests}`);

  if (suite.healedTests > 0) {
    logger.healing(`Healed: ${suite.healedTests}`);
  }

  if (suite.failedTests > 0) {
    logger.error(`Failed: ${suite.failedTests}`);
  }

  logger.info(`Duration: ${suite.duration}ms`);

  const successRate = suite.totalTests > 0
    ? ((suite.passedTests + suite.healedTests) / suite.totalTests * 100).toFixed(1)
    : '0';

  logger.info(`Success Rate: ${successRate}%`);

  logger.endGroup();
}

// Handle unhandled errors gracefully
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse();