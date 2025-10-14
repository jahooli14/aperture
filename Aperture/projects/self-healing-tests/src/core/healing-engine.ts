import { TestFailure, TestResult, TestConfig, HealingResult, HealingAction, FrameworkAdapter } from '../types/index.js';
import { GeminiAgent } from './gemini-agent.js';
import { logger } from '../utils/logger.js';
import { ScreenshotManager } from '../utils/screenshot.js';

export class HealingEngine {
  private geminiAgent: GeminiAgent;
  private adapter: FrameworkAdapter;
  private config: TestConfig;
  private screenshotManager: ScreenshotManager;

  constructor(adapter: FrameworkAdapter, config: TestConfig) {
    this.adapter = adapter;
    this.config = config;
    this.geminiAgent = new GeminiAgent(config);
    this.screenshotManager = new ScreenshotManager(config.outputDir);
  }

  async healTest(failure: TestFailure): Promise<HealingResult> {
    if (!this.config.enableHealing) {
      logger.info('Healing disabled in configuration');
      return this.createFailedResult('Healing disabled');
    }

    logger.healing(`Starting healing process for: ${failure.testName}`);

    try {
      // Capture screenshot if not already available
      if (!failure.screenshot && this.config.screenshotOnFailure) {
        try {
          failure.screenshot = await this.adapter.captureScreenshot();
          logger.debug('Screenshot captured for healing analysis');
        } catch (error) {
          logger.warn('Failed to capture screenshot for healing:', error);
        }
      }

      // Save screenshot for debugging
      if (failure.screenshot) {
        try {
          await this.screenshotManager.saveScreenshot(
            failure.screenshot,
            failure.testName,
            failure.timestamp
          );
        } catch (error) {
          logger.warn('Failed to save screenshot:', error);
        }
      }

      // Analyze failure with Gemini
      const geminiResponse = await this.geminiAgent.analyzeFailure(failure);

      // Estimate cost
      const cost = await this.geminiAgent.estimateCost(failure);

      logger.info(`Gemini analysis complete. Confidence: ${(geminiResponse.confidence * 100).toFixed(1)}%`);
      logger.debug(`Analysis cost: ${cost.tokens} tokens (~$${cost.usd.toFixed(4)})`);

      if (geminiResponse.healingActions.length === 0) {
        logger.warn('No healing actions suggested');
        return this.createFailedResult('No healing actions suggested', geminiResponse.healingActions, cost);
      }

      // Filter actions by confidence threshold
      const viableActions = geminiResponse.healingActions.filter(
        action => action.confidence >= this.config.confidenceThreshold
      );

      if (viableActions.length === 0) {
        logger.warn(`No actions meet confidence threshold (${this.config.confidenceThreshold})`);
        return this.createFailedResult('No actions meet confidence threshold', geminiResponse.healingActions, cost);
      }

      // Determine if human approval is needed
      const requiresApproval = geminiResponse.requiresHumanReview ||
                              !this.config.autoApply ||
                              geminiResponse.confidence < 0.8;

      if (requiresApproval && !await this.requestHumanApproval(geminiResponse)) {
        logger.info('Healing rejected by user or requires manual intervention');
        return this.createFailedResult('User rejected healing', viableActions, cost);
      }

      // Apply healing actions
      const applySuccess = await this.adapter.applyHealing(failure.testPath, viableActions);

      if (!applySuccess) {
        logger.error('Failed to apply healing actions to test file');
        return this.createFailedResult('Failed to apply healing', viableActions, cost);
      }

      // Mark actions as applied
      viableActions.forEach(action => action.applied = true);

      logger.success(`Successfully applied ${viableActions.length} healing actions`);

      return {
        success: true,
        actions: viableActions,
        testCode: 'Updated', // Would contain actual updated test code
        confidence: geminiResponse.confidence,
        requiresApproval: requiresApproval,
        cost
      };

    } catch (error) {
      logger.error('Healing process failed:', error);
      return this.createFailedResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async runHealingWorkflow(failure: TestFailure): Promise<TestResult> {
    const startTime = Date.now();

    // Attempt healing
    const healingResult = await this.healTest(failure);

    if (!healingResult.success) {
      return {
        testName: failure.testName,
        status: 'healing_failed',
        duration: Date.now() - startTime,
        failure,
        healingResult,
        attempts: 1
      };
    }

    // Re-run the test to verify the fix
    logger.info(`Re-running test to verify healing: ${failure.testName}`);

    try {
      const retestResult = await this.adapter.runTest(failure.testPath, this.config);

      if (retestResult.status === 'passed') {
        logger.success(`Test healing successful! Test now passes.`);
        return {
          testName: failure.testName,
          status: 'healed',
          duration: Date.now() - startTime,
          healingResult,
          attempts: 2 // Original fail + successful retry
        };
      } else {
        logger.warn('Test still fails after healing attempt');
        return {
          testName: failure.testName,
          status: 'healing_failed',
          duration: Date.now() - startTime,
          failure: retestResult.failure || failure,
          healingResult,
          attempts: 2
        };
      }

    } catch (error) {
      logger.error('Failed to re-run test after healing:', error);
      return {
        testName: failure.testName,
        status: 'healing_failed',
        duration: Date.now() - startTime,
        failure,
        healingResult,
        attempts: 2
      };
    }
  }

  private createFailedResult(
    _reason: string,
    actions: HealingAction[] = [],
    cost?: { tokens: number; usd: number }
  ): HealingResult {
    return {
      success: false,
      actions,
      testCode: '',
      confidence: 0,
      requiresApproval: true,
      cost: cost || undefined
    };
  }

  private async requestHumanApproval(geminiResponse: any): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' || !process.stdin.isTTY) {
      // In non-interactive environments, default to auto-apply if confidence is high
      return geminiResponse.confidence >= 0.9;
    }

    // Interactive approval
    logger.startGroup('Healing Actions Review');
    logger.info(`Confidence: ${(geminiResponse.confidence * 100).toFixed(1)}%`);
    logger.info(`Reasoning: ${geminiResponse.reasoning}`);

    geminiResponse.healingActions.forEach((action: HealingAction, index: number) => {
      logger.info(`\nAction ${index + 1}: ${action.description}`);
      logger.info(`  Type: ${action.type}`);
      logger.info(`  Confidence: ${(action.confidence * 100).toFixed(1)}%`);
      logger.info(`  Change: "${action.oldValue}" → "${action.newValue}"`);
      logger.info(`  Reasoning: ${action.reasoning}`);
    });

    logger.endGroup();

    // For now, return true for auto-apply in development
    // In a real implementation, you'd prompt the user for input
    const shouldApply = geminiResponse.confidence >= 0.7;

    if (shouldApply) {
      logger.healing('Auto-applying healing actions (confidence >= 70%)');
    } else {
      logger.warn('Skipping healing actions (confidence < 70%)');
    }

    return shouldApply;
  }

  async getHealingStats(): Promise<{
    totalAttempts: number;
    successfulHeals: number;
    failedHeals: number;
    averageConfidence: number;
    totalCost: { tokens: number; usd: number };
  }> {
    // This would typically read from a persistent store
    // For now, return placeholder stats
    return {
      totalAttempts: 0,
      successfulHeals: 0,
      failedHeals: 0,
      averageConfidence: 0,
      totalCost: { tokens: 0, usd: 0 }
    };
  }
}