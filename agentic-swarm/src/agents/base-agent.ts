import type { Tool, AgentConfig } from '../types/index.js';
import type { BaseProvider, ProviderMessage } from '../providers/index.js';

export abstract class BaseAgent {
  protected provider: BaseProvider;
  protected fallbackProvider?: BaseProvider;
  protected premiumProvider?: BaseProvider;
  protected config: Required<AgentConfig>;
  protected tools: Tool[];
  protected conversationHistory: ProviderMessage[];
  protected totalTokensUsed: { input: number; output: number } = { input: 0, output: 0 };

  constructor(
    provider: BaseProvider,
    tools: Tool[] = [],
    config: AgentConfig = {},
    fallbackProvider?: BaseProvider,
    premiumProvider?: BaseProvider
  ) {
    this.provider = provider;
    this.fallbackProvider = fallbackProvider;
    this.premiumProvider = premiumProvider;
    this.tools = tools;
    this.conversationHistory = [];

    // Set defaults based on best practices
    this.config = {
      model: config.model || provider.getModel(),
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 1.0,
      maxIterations: config.maxIterations || 20,
      systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt(),
    };
  }

  protected abstract getDefaultSystemPrompt(): string;

  /**
   * Core agent feedback loop: Gather Context → Take Action → Verify Work → Repeat
   */
  protected async runLoop(initialPrompt: string, usePremium: boolean = false): Promise<string> {
    this.conversationHistory = [
      { role: 'user', content: initialPrompt }
    ];

    let iterations = 0;
    let finalResponse = '';

    // Select provider (premium if requested and available, otherwise primary)
    let currentProvider = usePremium && this.premiumProvider ? this.premiumProvider : this.provider;

    while (iterations < this.config.maxIterations) {
      iterations++;

      try {
        // Call LLM API through provider abstraction
        const response = await currentProvider.sendMessage(
          this.conversationHistory,
          this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema,
          })),
          this.config.systemPrompt
        );

        // Track token usage
        if (response.usage) {
          this.totalTokensUsed.input += response.usage.inputTokens;
          this.totalTokensUsed.output += response.usage.outputTokens;
        }

        // Check stop reason
        if (response.stopReason === 'end_turn') {
          // Extract final text response
          const textBlocks = response.content.filter(block => block.type === 'text');
          finalResponse = textBlocks.map(block => block.text).join('\n');
          break;
        }

        if (response.stopReason === 'tool_use') {
          // Process tool calls
          const toolResults = await this.processToolCalls(response.content);

          // Add assistant response and tool results to history
          this.conversationHistory.push(
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults }
          );

          continue;
        }

        if (response.stopReason === 'max_tokens') {
          console.warn('Response truncated due to max_tokens limit');
          break;
        }
      } catch (error) {
        // Try fallback provider if available and not already using it
        if (this.fallbackProvider && currentProvider !== this.fallbackProvider) {
          console.warn(`Primary provider (${currentProvider.getProviderName()}) failed, trying fallback...`);
          currentProvider = this.fallbackProvider;
          continue; // Retry with fallback
        }

        // No fallback available or fallback also failed
        throw error;
      }
    }

    if (iterations >= this.config.maxIterations) {
      console.warn(`Agent reached max iterations (${this.config.maxIterations})`);
    }

    return finalResponse;
  }

  /**
   * Process tool calls with parallel execution where possible
   */
  protected async processToolCalls(content: any[]): Promise<any[]> {
    const toolUseBlocks = content.filter(block => block.type === 'tool_use');

    // Execute tools in parallel (best practice: 3+ simultaneous calls)
    const toolResultPromises = toolUseBlocks.map(async (toolUse) => {
      const tool = this.tools.find(t => t.name === toolUse.name);

      if (!tool) {
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: `Error: Tool ${toolUse.name} not found`,
          is_error: true,
        };
      }

      try {
        const result = await tool.execute(toolUse.input);
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        };
      } catch (error) {
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          is_error: true,
        };
      }
    });

    return Promise.all(toolResultPromises);
  }

  /**
   * Add a tool to the agent's toolkit
   */
  addTool(tool: Tool): void {
    this.tools.push(tool);
  }

  /**
   * Get conversation history for debugging/observability
   */
  getConversationHistory(): ProviderMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history (useful for context management)
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.totalTokensUsed = { input: 0, output: 0 };
  }

  /**
   * Get total tokens used across all API calls
   */
  getTokenUsage(): { input: number; output: number; total: number } {
    return {
      input: this.totalTokensUsed.input,
      output: this.totalTokensUsed.output,
      total: this.totalTokensUsed.input + this.totalTokensUsed.output,
    };
  }

  /**
   * Get current provider info
   */
  getProviderInfo(): { primary: string; fallback?: string; premium?: string } {
    return {
      primary: `${this.provider.getProviderName()}:${this.provider.getModel()}`,
      fallback: this.fallbackProvider
        ? `${this.fallbackProvider.getProviderName()}:${this.fallbackProvider.getModel()}`
        : undefined,
      premium: this.premiumProvider
        ? `${this.premiumProvider.getProviderName()}:${this.premiumProvider.getModel()}`
        : undefined,
    };
  }
}
