/**
 * Self-Healing Testing Framework
 *
 * Main entry point for the self-healing testing framework powered by
 * Google's Gemini 2.5 Computer Use model.
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

import { TestRunner } from './core/test-runner.js';
import { HealingEngine } from './core/healing-engine.js';
import { PlaywrightAdapter } from './adapters/playwright.js';
import { TestConfig, TestResult, TestSuite } from './types/index.js';
import { logger } from './utils/logger.js';

export class SelfHealingTestFramework {
  private testRunner: TestRunner;
  private healingEngine: HealingEngine;
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
    this.testRunner = new TestRunner(config);

    // Create adapter and healing engine
    const adapter = new PlaywrightAdapter(config);
    this.healingEngine = new HealingEngine(adapter, config);
  }

  /**
   * Run a single test with self-healing capabilities
   */
  async runTest(testPath: string): Promise<TestResult> {
    logger.startGroup(`Self-Healing Test: ${testPath}`);

    try {
      // First attempt
      const result = await this.testRunner.runSingleTest(testPath);

      if (result.status === 'failed' && result.failure && this.config.enableHealing) {
        logger.info('Test failed, attempting self-healing...');

        // Attempt healing
        const healedResult = await this.healingEngine.runHealingWorkflow(result.failure);

        logger.endGroup();
        return healedResult;
      }

      logger.endGroup();
      return result;

    } catch (error) {
      logger.error('Framework error:', error);
      logger.endGroup();

      return {
        testName: testPath.split('/').pop() || 'unknown',
        status: 'failed',
        duration: 0,
        attempts: 1,
        failure: {
          testName: testPath.split('/').pop() || 'unknown',
          testPath,
          error: error as Error,
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Run a test suite with self-healing capabilities
   */
  async runTestSuite(testDir: string): Promise<TestSuite> {
    logger.startGroup(`Self-Healing Test Suite: ${testDir}`);

    try {
      const suite = await this.testRunner.runTestSuite(testDir);

      // Process any failed tests with healing
      if (this.config.enableHealing) {
        const failedTests = suite.tests.filter(test => test.status === 'failed' && test.failure);

        if (failedTests.length > 0) {
          logger.info(`Processing ${failedTests.length} failed tests for healing...`);

          for (const failedTest of failedTests) {
            if (failedTest.failure) {
              logger.info(`Attempting to heal: ${failedTest.testName}`);
              const healedResult = await this.healingEngine.runHealingWorkflow(failedTest.failure);

              // Update the test result in the suite
              const testIndex = suite.tests.findIndex(t => t.testName === failedTest.testName);
              if (testIndex !== -1) {
                suite.tests[testIndex] = healedResult;
              }
            }
          }

          // Recalculate suite statistics
          suite.passedTests = suite.tests.filter(t => t.status === 'passed').length;
          suite.failedTests = suite.tests.filter(t => t.status === 'failed' || t.status === 'healing_failed').length;
          suite.healedTests = suite.tests.filter(t => t.status === 'healed').length;
        }
      }

      logger.endGroup();
      return suite;

    } catch (error) {
      logger.error('Test suite execution failed:', error);
      logger.endGroup();
      throw error;
    }
  }

  /**
   * Get healing statistics
   */
  async getHealingStats() {
    return this.healingEngine.getHealingStats();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TestConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate components with new config
    this.testRunner = new TestRunner(this.config);
    const adapter = new PlaywrightAdapter(this.config);
    this.healingEngine = new HealingEngine(adapter, this.config);
  }
}

// Export types and utilities for external use
export * from './types/index.js';
export { logger } from './utils/logger.js';
export { ScreenshotManager } from './utils/screenshot.js';
export { ComputerUseAgent } from './core/computer-use-agent.js';

// Default configuration
export const defaultConfig: TestConfig = {
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
  verbose: false
};

/**
 * Create a new self-healing test framework instance with default configuration
 */
export function createFramework(config: Partial<TestConfig> = {}): SelfHealingTestFramework {
  // Load configuration from environment variables
  const envConfig: Partial<TestConfig> = {
    geminiApiKey: process.env.GEMINI_API_KEY,
    vertexProject: process.env.VERTEX_PROJECT_ID,
    vertexLocation: process.env.VERTEX_LOCATION,
    model: process.env.GEMINI_MODEL || defaultConfig.model,
    enableHealing: process.env.ENABLE_HEALING === 'true' || defaultConfig.enableHealing,
    autoApply: process.env.AUTO_APPLY === 'true' || defaultConfig.autoApply,
    confidenceThreshold: process.env.CONFIDENCE_THRESHOLD
      ? parseFloat(process.env.CONFIDENCE_THRESHOLD)
      : defaultConfig.confidenceThreshold,
    maxHealingAttempts: process.env.MAX_HEALING_ATTEMPTS
      ? parseInt(process.env.MAX_HEALING_ATTEMPTS)
      : defaultConfig.maxHealingAttempts,
    outputDir: process.env.OUTPUT_DIR || defaultConfig.outputDir,
    verbose: process.env.VERBOSE === 'true' || defaultConfig.verbose,
    testTimeout: process.env.TEST_TIMEOUT
      ? parseInt(process.env.TEST_TIMEOUT)
      : defaultConfig.testTimeout,
  };

  // Merge: defaults < env vars < provided config
  const fullConfig = { ...defaultConfig, ...envConfig, ...config };

  return new SelfHealingTestFramework(fullConfig);
}