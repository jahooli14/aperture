/**
 * Abstract base class for LLM providers
 * Supports: Anthropic (Claude), Google (Gemini), Zhipu AI (GLM)
 */

export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

export interface ProviderTool {
  name: string;
  description: string;
  input_schema: any;
}

export interface ProviderResponse {
  content: any[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export abstract class BaseProvider {
  protected config: Required<ProviderConfig>;

  constructor(config: ProviderConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 1.0,
    };
  }

  /**
   * Send a message to the LLM and get a response
   */
  abstract sendMessage(
    messages: ProviderMessage[],
    tools: ProviderTool[],
    systemPrompt?: string
  ): Promise<ProviderResponse>;

  /**
   * Get the provider name (e.g., 'anthropic', 'google', 'zhipu')
   */
  abstract getProviderName(): string;

  /**
   * Get the model being used
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
