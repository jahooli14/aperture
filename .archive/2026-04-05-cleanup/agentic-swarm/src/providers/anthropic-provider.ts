import Anthropic from '@anthropic-ai/sdk';
import {
  BaseProvider,
  ProviderMessage,
  ProviderTool,
  ProviderResponse,
  ProviderConfig,
} from './base-provider.js';

/**
 * Anthropic (Claude) provider implementation
 */
export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async sendMessage(
    messages: ProviderMessage[],
    tools: ProviderTool[],
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    // Convert to Anthropic format
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })) as Anthropic.MessageParam[];

    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    // Map stop reason
    let stopReason: ProviderResponse['stopReason'];
    switch (response.stop_reason) {
      case 'end_turn':
        stopReason = 'end_turn';
        break;
      case 'tool_use':
        stopReason = 'tool_use';
        break;
      case 'max_tokens':
        stopReason = 'max_tokens';
        break;
      default:
        stopReason = 'stop_sequence';
    }

    return {
      content: response.content,
      stopReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  getProviderName(): string {
    return 'anthropic';
  }
}

/**
 * Default Anthropic models
 */
export const ANTHROPIC_MODELS = {
  SONNET_4: 'claude-sonnet-4-20250514',
  SONNET_3_5: 'claude-3-5-sonnet-20241022',
  HAIKU: 'claude-3-5-haiku-20241022',
} as const;
