/**
 * Default configuration for the Self-Healing Testing Framework
 */

import { TestConfig } from '../src/types/index.js';

export const defaultConfig: TestConfig = {
  // Framework settings
  framework: 'playwright',
  testTimeout: 30000, // 30 seconds per test
  retryCount: 1, // Retry failed tests once before healing

  // Healing settings
  enableHealing: true,
  autoApply: false, // Require human approval by default
  confidenceThreshold: 0.7, // 70% confidence minimum
  maxHealingAttempts: 3,

  // Gemini AI settings
  model: 'gemini-2.5-pro',
  // geminiApiKey: undefined, // Set via environment variable
  // vertexProject: undefined, // Set via environment variable
  // vertexLocation: 'us-central1',

  // Output settings
  screenshotOnFailure: true,
  outputDir: './test-results',
  verbose: false,
};

/**
 * Development configuration - more verbose, lower thresholds
 */
export const developmentConfig: TestConfig = {
  ...defaultConfig,
  verbose: true,
  confidenceThreshold: 0.6, // Lower threshold for development
  autoApply: false, // Always require approval in development
  screenshotOnFailure: true,
};

/**
 * Production configuration - conservative settings
 */
export const productionConfig: TestConfig = {
  ...defaultConfig,
  verbose: false,
  confidenceThreshold: 0.8, // Higher threshold for production
  autoApply: false, // Never auto-apply in production
  maxHealingAttempts: 2, // Fewer attempts to control costs
};

/**
 * CI/CD configuration - automated but safe
 */
export const ciConfig: TestConfig = {
  ...defaultConfig,
  verbose: true, // Verbose for debugging CI issues
  confidenceThreshold: 0.9, // Very high threshold
  autoApply: true, // Can auto-apply with high confidence
  maxHealingAttempts: 1, // Single attempt to control CI time
  screenshotOnFailure: true,
};

/**
 * Get configuration based on environment
 */
export function getConfigForEnvironment(env: string = process.env.NODE_ENV || 'development'): TestConfig {
  switch (env.toLowerCase()) {
    case 'production':
    case 'prod':
      return productionConfig;

    case 'ci':
    case 'continuous-integration':
      return ciConfig;

    case 'development':
    case 'dev':
    default:
      return developmentConfig;
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: TestConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required settings
  if (!config.geminiApiKey && !config.vertexProject) {
    errors.push('Either geminiApiKey or vertexProject must be provided');
  }

  // Check confidence threshold
  if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
    errors.push('confidenceThreshold must be between 0 and 1');
  }

  // Check timeout
  if (config.testTimeout <= 0) {
    errors.push('testTimeout must be positive');
  }

  // Check max attempts
  if (config.maxHealingAttempts < 1) {
    errors.push('maxHealingAttempts must be at least 1');
  }

  // Check framework
  const supportedFrameworks = ['playwright'];
  if (!supportedFrameworks.includes(config.framework)) {
    errors.push(`Unsupported framework: ${config.framework}. Supported: ${supportedFrameworks.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}