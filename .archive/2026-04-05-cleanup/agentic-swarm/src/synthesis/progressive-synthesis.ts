/**
 * Progressive Synthesis - Enables workers to build on each other's findings
 *
 * Key insight: Workers shouldn't operate in isolation. After every N workers complete,
 * synthesize their findings and feed that context to the next batch of workers.
 *
 * This prevents the "disconnected microtask" problem and creates coherent output.
 */

import type { BaseProvider } from '../providers/index.js';

export interface WorkerResult {
  taskId: string;
  topic: string;
  output: string;
  tokensUsed?: number;
}

export interface SynthesisOptions {
  batchSize: number; // Synthesize after every N workers (default: 5)
  maxSynthesisTokens: number; // Target size for synthesis (default: 2000)
  systemPrompt?: string;
}

export class ProgressiveSynthesizer {
  private provider: BaseProvider;
  private options: Required<SynthesisOptions>;
  private synthesisHistory: string[] = [];
  private allResults: WorkerResult[] = [];

  constructor(provider: BaseProvider, options: Partial<SynthesisOptions> = {}) {
    this.provider = provider;

    // Set options with defaults
    const maxSynthesisTokens = options.maxSynthesisTokens || 2000;
    const batchSize = options.batchSize || 5;

    this.options = {
      batchSize,
      maxSynthesisTokens,
      systemPrompt: options.systemPrompt || this.getDefaultSystemPrompt(maxSynthesisTokens),
    };
  }

  private getDefaultSystemPrompt(maxTokens: number = 2000): string {
    return `You are a synthesis agent responsible for connecting research findings.

Your role:
1. Identify common themes across research outputs
2. Note contradictions and propose resolutions
3. Highlight gaps that need further exploration
4. Create concise summaries (under ${maxTokens} tokens)

Output format:
## Key Themes
- [List 3-5 cross-cutting themes]

## Contradictions & Resolutions
- [Any conflicting findings and how to resolve them]

## Gaps to Explore
- [What questions remain unanswered]

## Synthesis
[2-3 paragraph coherent summary of all findings]`;
  }

  /**
   * Add worker result and potentially trigger synthesis
   */
  async addResult(result: WorkerResult): Promise<string | null> {
    this.allResults.push(result);

    // Check if we should synthesize (batch complete)
    if (this.allResults.length % this.options.batchSize === 0) {
      const batchNum = Math.floor(this.allResults.length / this.options.batchSize);
      return await this.synthesizeBatch(batchNum);
    }

    return null;
  }

  /**
   * Synthesize the last batch of results
   */
  private async synthesizeBatch(batchNum: number): Promise<string> {
    const startIdx = (batchNum - 1) * this.options.batchSize;
    const endIdx = batchNum * this.options.batchSize;
    const batchResults = this.allResults.slice(startIdx, endIdx);

    // Build synthesis prompt
    const prompt = this.buildSynthesisPrompt(batchResults, batchNum);

    try {
      const response = await this.provider.sendMessage(
        [{ role: 'user', content: prompt }],
        [],
        this.options.systemPrompt
      );

      const textBlock = response.content.find((block: any) => block.type === 'text');
      const synthesis = textBlock ? textBlock.text : '[No synthesis generated]';

      this.synthesisHistory.push(synthesis);
      return synthesis;
    } catch (error) {
      console.error(`Failed to synthesize batch ${batchNum}:`, error);
      return `[Synthesis failed for batch ${batchNum}]`;
    }
  }

  /**
   * Build prompt for synthesis
   */
  private buildSynthesisPrompt(results: WorkerResult[], batchNum: number): string {
    const resultsText = results
      .map((r, idx) => `### Worker ${idx + 1}: ${r.topic}\n\n${r.output}`)
      .join('\n\n---\n\n');

    let prompt = `# Batch ${batchNum} Synthesis\n\n`;

    // Include previous synthesis for context
    if (this.synthesisHistory.length > 0) {
      prompt += `## Previous Synthesis (for context)\n\n`;
      prompt += this.synthesisHistory[this.synthesisHistory.length - 1];
      prompt += `\n\n---\n\n`;
    }

    prompt += `## New Research Outputs to Synthesize\n\n${resultsText}\n\n`;
    prompt += `## Task\n\n`;
    prompt += `Synthesize the above ${results.length} research outputs. `;

    if (this.synthesisHistory.length > 0) {
      prompt += `Build upon the previous synthesis by identifying new themes, `;
      prompt += `resolving contradictions, and creating a coherent narrative.`;
    } else {
      prompt += `This is the first batch, so establish the foundational themes and structure.`;
    }

    return prompt;
  }

  /**
   * Get context for next batch of workers
   * Returns the latest synthesis to provide context
   */
  getCurrentContext(): string {
    if (this.synthesisHistory.length === 0) {
      return '';
    }

    // Return the last synthesis
    return this.synthesisHistory[this.synthesisHistory.length - 1];
  }

  /**
   * Get all synthesis history
   */
  getAllSyntheses(): string[] {
    return [...this.synthesisHistory];
  }

  /**
   * Force synthesis of remaining results (call at end if incomplete batch)
   */
  async finalizeSynthesis(): Promise<string | null> {
    const completedBatches = Math.floor(this.allResults.length / this.options.batchSize);
    const processedResults = completedBatches * this.options.batchSize;
    const remainingResults = this.allResults.slice(processedResults);

    if (remainingResults.length === 0) {
      return null;
    }

    // Synthesize the final partial batch
    const prompt = this.buildSynthesisPrompt(
      remainingResults,
      completedBatches + 1
    );

    try {
      const response = await this.provider.sendMessage(
        [{ role: 'user', content: prompt }],
        [],
        this.options.systemPrompt
      );

      const textBlock = response.content.find((block: any) => block.type === 'text');
      const synthesis = textBlock ? textBlock.text : '[No synthesis generated]';

      this.synthesisHistory.push(synthesis);
      return synthesis;
    } catch (error) {
      console.error(`Failed to finalize synthesis:`, error);
      return null;
    }
  }

  /**
   * Create final comprehensive synthesis of ALL work
   */
  async createFinalSynthesis(): Promise<string> {
    // Ensure all results are synthesized
    await this.finalizeSynthesis();

    if (this.synthesisHistory.length === 0) {
      return '[No synthesis history to finalize]';
    }

    // Create master synthesis from all batch syntheses
    const allSynthesesText = this.synthesisHistory
      .map((s, idx) => `## Batch ${idx + 1} Synthesis\n\n${s}`)
      .join('\n\n---\n\n');

    const prompt = `# Final Master Synthesis

You have ${this.allResults.length} total research outputs across ${this.synthesisHistory.length} synthesis batches.

## All Batch Syntheses

${allSynthesesText}

## Task

Create a comprehensive final synthesis that:
1. Integrates findings from all batches
2. Identifies overarching themes across the entire research
3. Resolves any contradictions
4. Provides clear, actionable recommendations
5. Notes any significant gaps in knowledge

Target length: 1500-2500 tokens

Output format:
## Executive Summary
[3-4 paragraphs covering the most important findings]

## Major Themes
[5-8 key themes that emerged across all research]

## Key Insights & Recommendations
[Specific, actionable insights organized by topic]

## Contradictions & Resolutions
[How conflicting findings were resolved]

## Knowledge Gaps & Future Research
[What remains to be explored]

## Conclusion
[Final thoughts and next steps]`;

    try {
      const response = await this.provider.sendMessage(
        [{ role: 'user', content: prompt }],
        [],
        this.options.systemPrompt
      );

      const textBlock = response.content.find((block: any) => block.type === 'text');
      return textBlock ? textBlock.text : '[No final synthesis generated]';
    } catch (error) {
      console.error(`Failed to create final synthesis:`, error);
      return '[Final synthesis failed]';
    }
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    totalResults: number;
    synthesisCount: number;
    batchesProcessed: number;
    resultsPerBatch: number;
  } {
    return {
      totalResults: this.allResults.length,
      synthesisCount: this.synthesisHistory.length,
      batchesProcessed: Math.floor(this.allResults.length / this.options.batchSize),
      resultsPerBatch: this.options.batchSize,
    };
  }
}

/**
 * Utility function to create a synthesis-aware worker context
 */
export function createWorkerContextWithSynthesis(
  baseContext: string,
  currentSynthesis: string
): string {
  if (!currentSynthesis) {
    return baseContext;
  }

  return `${baseContext}

## Context from Previous Research

The following synthesis summarizes what previous workers have discovered:

${currentSynthesis}

Use this context to:
- Avoid duplicating work already done
- Build upon existing findings
- Fill gaps identified in previous research
- Resolve or note any contradictions`;
}
