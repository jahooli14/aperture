import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { promises as fs } from 'fs';
import { FrameworkAdapter, TestConfig, TestResult, TestContext, HealingAction, TestFailure } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class PlaywrightAdapter implements FrameworkAdapter {
  name = 'playwright';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
  }

  async runTest(testPath: string, _config: TestConfig): Promise<TestResult> {
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = this.config.maxHealingAttempts || 3;

    logger.info(`Running test: ${testPath}`);

    while (attempts < maxAttempts) {
      attempts++;

      try {
        await this.setupBrowser();

        // Execute the test
        await this.executeTest(testPath);

        await this.cleanup();

        return {
          testName: this.extractTestName(testPath),
          status: 'passed',
          duration: Date.now() - startTime,
          attempts
        };

      } catch (error) {
        logger.warn(`Test attempt ${attempts} failed:`, error instanceof Error ? error.message : String(error));

        if (attempts >= maxAttempts) {
          const failure = await this.createTestFailure(testPath, error as Error);

          return {
            testName: this.extractTestName(testPath),
            status: 'failed',
            duration: Date.now() - startTime,
            failure,
            attempts
          };
        }

        // Continue to next attempt
        await this.cleanup();
      }
    }

    // This shouldn't be reached, but TypeScript needs it
    throw new Error('Unexpected end of test execution');
  }

  async captureScreenshot(): Promise<Buffer> {
    if (!this.page) {
      throw new Error('No active page for screenshot capture');
    }

    try {
      return await this.page.screenshot({
        fullPage: true,
        type: 'png'
      });
    } catch (error) {
      logger.error('Failed to capture screenshot:', error);
      throw error;
    }
  }

  async getTestContext(): Promise<TestContext> {
    if (!this.page) {
      throw new Error('No active page for context capture');
    }

    try {
      const url = this.page.url();
      const viewport = this.page.viewportSize() || { width: 1280, height: 720 };

      // Get console logs (would need to be collected during test execution)
      const console = this.getConsoleMessages();

      // Get HTML content
      const html = await this.page.content();

      // Get user agent
      const userAgent = await this.page.evaluate(() => navigator.userAgent);

      return {
        url,
        html: html.substring(0, 10000), // Limit HTML size
        console,
        viewport,
        userAgent,
        network: [] // Would need to implement network request tracking
      };
    } catch (error) {
      logger.error('Failed to capture test context:', error);
      throw error;
    }
  }

  async applyHealing(testPath: string, actions: HealingAction[]): Promise<boolean> {
    logger.info(`Applying ${actions.length} healing actions to ${testPath}`);

    try {
      // Read the test file
      const testContent = await fs.readFile(testPath, 'utf-8');
      let healedContent = testContent;

      // Apply each healing action
      for (const action of actions) {
        switch (action.type) {
          case 'selector_fix':
            healedContent = this.applySelectorFix(healedContent, action);
            break;
          case 'wait_adjustment':
            healedContent = this.applyWaitAdjustment(healedContent, action);
            break;
          case 'assertion_update':
            healedContent = this.applyAssertionUpdate(healedContent, action);
            break;
          case 'timing_fix':
            healedContent = this.applyTimingFix(healedContent, action);
            break;
          default:
            logger.warn(`Unknown healing action type: ${action.type}`);
        }

        action.applied = true;
        logger.debug(`Applied ${action.type}: ${action.description}`);
      }

      // Create backup of original file
      const backupPath = `${testPath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, testContent);
      logger.debug(`Created backup: ${backupPath}`);

      // Write healed content
      await fs.writeFile(testPath, healedContent);
      logger.success(`Successfully applied healing to ${testPath}`);

      return true;
    } catch (error) {
      logger.error('Failed to apply healing actions:', error);
      return false;
    }
  }

  private async setupBrowser(): Promise<void> {
    if (this.browser) {
      return; // Already set up
    }

    try {
      this.browser = await chromium.launch({
        headless: !process.env.DEBUG_BROWSER,
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        // Record console messages - video recording disabled by default
      });

      this.page = await this.context.newPage();

      // Set up console message collection
      this.setupConsoleLogging();

      logger.debug('Playwright browser initialized');
    } catch (error) {
      logger.error('Failed to setup Playwright browser:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.debug('Playwright browser cleaned up');
    } catch (error) {
      logger.warn('Error during Playwright cleanup:', error);
    }
  }

  private async executeTest(testPath: string): Promise<void> {
    // This is a simplified test execution
    // In a real implementation, you would:
    // 1. Parse the test file
    // 2. Execute the test steps
    // 3. Handle assertions

    // For now, we'll simulate by requiring the test file
    // This assumes tests export a function or have some standard format

    try {
      // Read and execute test content
      await fs.readFile(testPath, 'utf-8');

      // This is a placeholder - in reality you'd need to:
      // - Parse test syntax (Jest, Mocha, custom format)
      // - Execute each step with proper error handling
      // - Track which step failed

      logger.debug(`Test content loaded from ${testPath}`);

      // Simulate test execution delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      throw new Error(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createTestFailure(testPath: string, error: Error): Promise<TestFailure> {
    let screenshot: Buffer | undefined;
    let context: TestContext | undefined;

    try {
      screenshot = await this.captureScreenshot();
    } catch {
      screenshot = undefined;
    }

    try {
      context = await this.getTestContext();
    } catch {
      context = undefined;
    }

    return {
      testName: this.extractTestName(testPath),
      testPath,
      error,
      screenshot,
      timestamp: new Date(),
      stackTrace: error.stack,
      context
    };
  }

  private extractTestName(testPath: string): string {
    return testPath.split('/').pop()?.replace(/\.(ts|js|spec\.ts|spec\.js|test\.ts|test\.js)$/, '') || 'unknown';
  }

  private consoleMessages: string[] = [];

  private setupConsoleLogging(): void {
    if (!this.page) return;

    this.page.on('console', (msg) => {
      const logLevel = msg.type();
      const text = msg.text();
      this.consoleMessages.push(`[${logLevel}] ${text}`);
    });
  }

  private getConsoleMessages(): string[] {
    return [...this.consoleMessages];
  }

  // Healing action implementations
  private applySelectorFix(content: string, action: HealingAction): string {
    // Replace old selector with new selector
    const oldSelector = action.oldValue;
    const newSelector = action.newValue;

    // Simple string replacement - in reality you'd need more sophisticated parsing
    return content.replace(new RegExp(escapeRegex(oldSelector), 'g'), newSelector);
  }

  private applyWaitAdjustment(content: string, action: HealingAction): string {
    // Find wait statements and adjust timeouts
    const oldWait = action.oldValue;
    const newWait = action.newValue;

    return content.replace(new RegExp(escapeRegex(oldWait), 'g'), newWait);
  }

  private applyAssertionUpdate(content: string, action: HealingAction): string {
    // Update assertion values
    const oldAssertion = action.oldValue;
    const newAssertion = action.newValue;

    return content.replace(new RegExp(escapeRegex(oldAssertion), 'g'), newAssertion);
  }

  private applyTimingFix(content: string, action: HealingAction): string {
    // Add or modify timing/wait statements
    const insertPoint = action.oldValue; // Line or pattern to insert after
    const timingCode = action.newValue; // Code to insert

    return content.replace(new RegExp(escapeRegex(insertPoint), 'g'), `${insertPoint}\n${timingCode}`);
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}