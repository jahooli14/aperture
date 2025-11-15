import { promises as fs } from 'fs';
import { join } from 'path';
import { TestConfig, TestResult, TestSuite, FrameworkAdapter } from '../types/index.js';
import { PlaywrightAdapter } from '../adapters/playwright.js';
import { logger } from '../utils/logger.js';

export class TestRunner {
  private adapter: FrameworkAdapter;
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
    this.adapter = this.createAdapter(config);
  }

  private createAdapter(config: TestConfig): FrameworkAdapter {
    switch (config.framework) {
      case 'playwright':
        return new PlaywrightAdapter(config);
      case 'puppeteer':
        throw new Error('Puppeteer adapter not implemented yet');
      case 'cypress':
        throw new Error('Cypress adapter not implemented yet');
      default:
        throw new Error(`Unsupported framework: ${config.framework}`);
    }
  }

  async runTestSuite(testDir: string): Promise<TestSuite> {
    logger.startGroup(`Running Test Suite: ${testDir}`);

    const startTime = Date.now();
    const testFiles = await this.findTestFiles(testDir);

    logger.info(`Found ${testFiles.length} test files`);

    const results: TestResult[] = [];

    for (const testFile of testFiles) {
      try {
        const result = await this.adapter.runTest(testFile, this.config);
        results.push(result);

        this.logTestResult(result);
      } catch (error) {
        logger.error(`Failed to run test ${testFile}:`, error);

        results.push({
          testName: this.extractTestName(testFile),
          status: 'failed',
          duration: 0,
          attempts: 1,
          failure: {
            testName: this.extractTestName(testFile),
            testPath: testFile,
            error: error as Error,
            timestamp: new Date()
          }
        });
      }
    }

    const suite = this.createTestSuite(testDir, results, Date.now() - startTime);

    logger.endGroup();
    this.logSuiteSummary(suite);

    return suite;
  }

  async runSingleTest(testPath: string): Promise<TestResult> {
    logger.startGroup(`Running Single Test: ${testPath}`);

    try {
      const result = await this.adapter.runTest(testPath, this.config);
      this.logTestResult(result);

      logger.endGroup();
      return result;
    } catch (error) {
      logger.error(`Failed to run test ${testPath}:`, error);

      const result: TestResult = {
        testName: this.extractTestName(testPath),
        status: 'failed',
        duration: 0,
        attempts: 1,
        failure: {
          testName: this.extractTestName(testPath),
          testPath,
          error: error as Error,
          timestamp: new Date()
        }
      };

      logger.endGroup();
      return result;
    }
  }

  private async findTestFiles(testDir: string): Promise<string[]> {
    const testFiles: string[] = [];

    try {
      const entries = await fs.readdir(testDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(testDir, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findTestFiles(fullPath);
          testFiles.push(...subFiles);
        } else if (this.isTestFile(entry.name)) {
          testFiles.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Error reading test directory ${testDir}:`, error);
    }

    return testFiles.sort();
  }

  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\.(js|ts)$/,
      /\.spec\.(js|ts)$/,
      /_test\.(js|ts)$/,
      /_spec\.(js|ts)$/
    ];

    return testPatterns.some(pattern => pattern.test(filename));
  }

  private extractTestName(testPath: string): string {
    return testPath.split('/').pop()?.replace(/\.(ts|js|spec\.ts|spec\.js|test\.ts|test\.js)$/, '') || 'unknown';
  }

  private createTestSuite(name: string, results: TestResult[], duration: number): TestSuite {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'passed').length;
    const failedTests = results.filter(r => r.status === 'failed').length;
    const healedTests = results.filter(r => r.status === 'healed').length;

    return {
      name,
      tests: results,
      totalTests,
      passedTests,
      failedTests,
      healedTests,
      duration,
      timestamp: new Date()
    };
  }

  private logTestResult(result: TestResult): void {
    const duration = `${result.duration}ms`;
    const attempts = result.attempts > 1 ? ` (${result.attempts} attempts)` : '';

    switch (result.status) {
      case 'passed':
        logger.success(`✓ ${result.testName} ${duration}${attempts}`);
        break;
      case 'failed':
        logger.error(`✗ ${result.testName} ${duration}${attempts}`);
        if (result.failure) {
          logger.error(`  Error: ${result.failure.error.message}`);
        }
        break;
      case 'healed':
        logger.healing(`⚕ ${result.testName} ${duration}${attempts} - HEALED`);
        if (result.healingResult) {
          logger.info(`  Applied ${result.healingResult.actions.length} healing actions`);
        }
        break;
      case 'healing_failed':
        logger.error(`⚕✗ ${result.testName} ${duration}${attempts} - HEALING FAILED`);
        break;
    }
  }

  private logSuiteSummary(suite: TestSuite): void {
    const { totalTests, passedTests, failedTests, healedTests } = suite;
    const duration = `${suite.duration}ms`;

    logger.startGroup('Test Suite Summary');
    logger.info(`Total tests: ${totalTests}`);
    logger.success(`Passed: ${passedTests}`);
    if (healedTests > 0) {
      logger.healing(`Healed: ${healedTests}`);
    }
    if (failedTests > 0) {
      logger.error(`Failed: ${failedTests}`);
    }
    logger.info(`Duration: ${duration}`);

    const successRate = totalTests > 0 ? ((passedTests + healedTests) / totalTests * 100).toFixed(1) : '0';
    logger.info(`Success rate: ${successRate}%`);

    logger.endGroup();
  }
}