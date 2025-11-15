import type { Tool, AgentConfig, TaskDescription, AgentResult } from '../types/index.js';
import type { BaseProvider } from '../providers/index.js';
import { BaseAgent } from './base-agent.js';

export class WorkerAgent extends BaseAgent {
  private currentTask?: TaskDescription;
  private tokensUsed: number = 0;
  private iterations: number = 0;

  constructor(
    provider: BaseProvider,
    tools: Tool[] = [],
    config: AgentConfig = {},
    fallbackProvider?: BaseProvider,
    premiumProvider?: BaseProvider
  ) {
    super(provider, tools, config, fallbackProvider, premiumProvider);
  }

  protected getDefaultSystemPrompt(): string {
    return `You are a specialized worker agent focused on executing a specific subtask.

Your responsibilities:
1. Execute your assigned task with focus and precision
2. Use available tools efficiently (prefer parallel tool calls when possible)
3. Return a condensed summary (1,000-2,000 tokens) of findings
4. Stay within your task boundaries

## Core Feedback Loop

1. **Gather Context** - Use tools to fetch relevant information
2. **Take Action** - Execute your task using available tools
3. **Verify Work** - Check your outputs for accuracy
4. **Repeat** - Iterate until task is complete

## Best Practices

- Use 3+ simultaneous tool calls when possible for speed
- Focus on your specific objective - don't expand scope
- Return structured output matching the requested format
- Be thorough but concise in your findings

Your task details will be provided in the initial prompt.`;
  }

  /**
   * Execute a specific task
   */
  async executeTask(task: TaskDescription): Promise<AgentResult> {
    this.currentTask = task;
    this.tokensUsed = 0;
    this.iterations = 0;

    // Build task prompt with clear structure
    const taskPrompt = this.buildTaskPrompt(task);

    try {
      const output = await this.runLoop(taskPrompt);

      return {
        taskId: task.id,
        success: true,
        output,
        tokensUsed: this.tokensUsed,
        iterations: this.iterations,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        output: '',
        tokensUsed: this.tokensUsed,
        iterations: this.iterations,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build a well-structured task prompt following Anthropic's guidelines
   */
  private buildTaskPrompt(task: TaskDescription): string {
    let prompt = `# Task Assignment\n\n`;

    prompt += `## Objective\n${task.objective}\n\n`;

    prompt += `## Output Format\n${task.outputFormat}\n\n`;

    if (task.toolGuidance) {
      prompt += `## Tool Guidance\n${task.toolGuidance}\n\n`;
    }

    if (task.boundaries) {
      prompt += `## Boundaries\n${task.boundaries}\n\n`;
    }

    if (task.context) {
      prompt += `## Context\n${task.context}\n\n`;
    }

    prompt += `## Instructions\n`;
    prompt += `Execute this task following the core feedback loop:\n`;
    prompt += `1. Gather relevant context using available tools\n`;
    prompt += `2. Take action to complete the objective\n`;
    prompt += `3. Verify your work meets requirements\n`;
    prompt += `4. Return output in the specified format\n\n`;
    prompt += `Remember: Keep your response condensed (1,000-2,000 tokens) while being thorough.`;

    return prompt;
  }

  /**
   * Override runLoop to track metrics
   */
  protected async runLoop(initialPrompt: string): Promise<string> {
    const result = await super.runLoop(initialPrompt);

    // Track iterations (approximate based on conversation history)
    this.iterations = Math.ceil(this.conversationHistory.length / 2);

    // Note: We can't easily track tokens without parsing the API response
    // In production, you'd want to capture this from the API response
    this.tokensUsed = 0; // Placeholder

    return result;
  }

  /**
   * Get current task details
   */
  getCurrentTask(): TaskDescription | undefined {
    return this.currentTask;
  }
}
