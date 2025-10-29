/**
 * Cost Guard - Prevents runaway costs in long-running swarms
 *
 * Tracks token usage across all providers and enforces budget limits
 */

export interface CostConfig {
  maxCostUSD: number;
  warningThresholdPercent?: number; // Default 80%
  providers: {
    [providerName: string]: {
      inputCostPer1M: number;
      outputCostPer1M: number;
    };
  };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  provider: string;
}

export class CostGuard {
  private maxCostUSD: number;
  private currentCostUSD: number = 0;
  private warningThreshold: number;
  private providers: CostConfig['providers'];
  private usageLog: TokenUsage[] = [];
  private warningIssued: boolean = false;

  constructor(config: CostConfig) {
    this.maxCostUSD = config.maxCostUSD;
    this.providers = config.providers;
    this.warningThreshold = (config.warningThresholdPercent || 80) / 100;
  }

  /**
   * Check if a proposed API call would exceed budget
   * Call this BEFORE making the API call
   */
  async checkBeforeCall(
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    provider: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const estimatedCost = this.calculateCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      provider
    );

    const projectedTotal = this.currentCostUSD + estimatedCost;

    if (projectedTotal > this.maxCostUSD) {
      return {
        allowed: false,
        reason: `Cost limit would be exceeded. Current: $${this.currentCostUSD.toFixed(3)}, ` +
                `Estimated: $${estimatedCost.toFixed(3)}, ` +
                `Projected: $${projectedTotal.toFixed(3)}, ` +
                `Limit: $${this.maxCostUSD.toFixed(2)}`
      };
    }

    if (projectedTotal > this.maxCostUSD * this.warningThreshold && !this.warningIssued) {
      this.warningIssued = true;
      console.warn(
        `⚠️  Cost Warning: Approaching budget limit ` +
        `($${projectedTotal.toFixed(3)} / $${this.maxCostUSD.toFixed(2)})`
      );
    }

    return { allowed: true };
  }

  /**
   * Record actual token usage after API call
   * Call this AFTER the API call completes
   */
  recordUsage(usage: TokenUsage): void {
    const cost = this.calculateCost(
      usage.inputTokens,
      usage.outputTokens,
      usage.provider
    );

    this.currentCostUSD += cost;
    this.usageLog.push(usage);

    // Check if we've exceeded (shouldn't happen if checkBeforeCall was used)
    if (this.currentCostUSD > this.maxCostUSD) {
      console.error(
        `🚨 BUDGET EXCEEDED! Current: $${this.currentCostUSD.toFixed(3)}, ` +
        `Limit: $${this.maxCostUSD.toFixed(2)}`
      );
    }
  }

  /**
   * Calculate cost for given token usage
   */
  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    provider: string
  ): number {
    const providerPricing = this.providers[provider];

    if (!providerPricing) {
      console.warn(`⚠️  Unknown provider: ${provider}. Assuming $0 cost.`);
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * providerPricing.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * providerPricing.outputCostPer1M;

    return inputCost + outputCost;
  }

  /**
   * Get current cost status
   */
  getStatus(): {
    currentCost: number;
    maxCost: number;
    remainingBudget: number;
    percentUsed: number;
    totalTokens: number;
  } {
    const totalTokens = this.usageLog.reduce(
      (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
      0
    );

    return {
      currentCost: this.currentCostUSD,
      maxCost: this.maxCostUSD,
      remainingBudget: this.maxCostUSD - this.currentCostUSD,
      percentUsed: (this.currentCostUSD / this.maxCostUSD) * 100,
      totalTokens,
    };
  }

  /**
   * Get detailed usage breakdown by provider
   */
  getUsageByProvider(): {
    [provider: string]: {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    };
  } {
    const breakdown: any = {};

    for (const usage of this.usageLog) {
      if (!breakdown[usage.provider]) {
        breakdown[usage.provider] = {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }

      breakdown[usage.provider].calls++;
      breakdown[usage.provider].inputTokens += usage.inputTokens;
      breakdown[usage.provider].outputTokens += usage.outputTokens;
      breakdown[usage.provider].cost += this.calculateCost(
        usage.inputTokens,
        usage.outputTokens,
        usage.provider
      );
    }

    return breakdown;
  }

  /**
   * Format status as a readable string
   */
  formatStatus(): string {
    const status = this.getStatus();
    const breakdown = this.getUsageByProvider();

    let output = `\n💰 Cost Status:\n`;
    output += `   Current: $${status.currentCost.toFixed(3)}\n`;
    output += `   Limit: $${status.maxCost.toFixed(2)}\n`;
    output += `   Remaining: $${status.remainingBudget.toFixed(3)}\n`;
    output += `   Used: ${status.percentUsed.toFixed(1)}%\n`;
    output += `   Total Tokens: ${status.totalTokens.toLocaleString()}\n`;

    output += `\n📊 Breakdown by Provider:\n`;
    for (const [provider, stats] of Object.entries(breakdown)) {
      output += `   ${provider}:\n`;
      output += `     Calls: ${stats.calls}\n`;
      output += `     Tokens: ${(stats.inputTokens + stats.outputTokens).toLocaleString()}\n`;
      output += `     Cost: $${stats.cost.toFixed(3)}\n`;
    }

    return output;
  }

  /**
   * Check if budget is exhausted
   */
  isBudgetExhausted(): boolean {
    return this.currentCostUSD >= this.maxCostUSD;
  }

  /**
   * Get remaining budget as percentage
   */
  getRemainingBudgetPercent(): number {
    return ((this.maxCostUSD - this.currentCostUSD) / this.maxCostUSD) * 100;
  }
}

// Predefined cost configurations for common scenarios

export const COST_CONFIGS = {
  FREE: {
    maxCostUSD: 0,
    providers: {
      glm: { inputCostPer1M: 0, outputCostPer1M: 0 },
    },
  },

  BUDGET_3: {
    maxCostUSD: 3.0,
    providers: {
      gemini: { inputCostPer1M: 0.30, outputCostPer1M: 2.50 },
      glm: { inputCostPer1M: 0, outputCostPer1M: 0 },
    },
  },

  QUALITY_10: {
    maxCostUSD: 10.0,
    providers: {
      'claude-sonnet': { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
      'claude-haiku': { inputCostPer1M: 0.80, outputCostPer1M: 4.00 },
      gemini: { inputCostPer1M: 0.30, outputCostPer1M: 2.50 },
      glm: { inputCostPer1M: 0, outputCostPer1M: 0 },
    },
  },

  ENTERPRISE_20: {
    maxCostUSD: 20.0,
    providers: {
      'claude-sonnet': { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
      'claude-haiku': { inputCostPer1M: 0.80, outputCostPer1M: 4.00 },
      'gemini-pro': { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
      gemini: { inputCostPer1M: 0.30, outputCostPer1M: 2.50 },
      'gpt-4o': { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
      glm: { inputCostPer1M: 0, outputCostPer1M: 0 },
    },
  },
};
