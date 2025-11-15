import {
  BaseProvider,
  ProviderMessage,
  ProviderTool,
  ProviderResponse,
  ProviderConfig,
} from './base-provider.js';

/**
 * Zhipu AI GLM provider implementation
 * Uses OpenAI-compatible API format
 */
export class GLMProvider extends BaseProvider {
  private baseURL: string = 'https://open.bigmodel.cn/api/paas/v4';

  constructor(config: ProviderConfig) {
    super(config);
  }

  async sendMessage(
    messages: ProviderMessage[],
    tools: ProviderTool[],
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    // Build messages array
    const glmMessages: any[] = [];

    // Add system message if provided
    if (systemPrompt) {
      glmMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Convert messages to GLM format (OpenAI-compatible)
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        glmMessages.push({
          role: msg.role,
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        // Handle tool use/results
        const textParts: string[] = [];
        const toolCalls: any[] = [];
        const toolResults: any[] = [];

        for (const block of msg.content) {
          if (block.type === 'text') {
            textParts.push(block.text);
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          } else if (block.type === 'tool_result') {
            toolResults.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content),
            });
          }
        }

        if (textParts.length > 0) {
          glmMessages.push({
            role: msg.role,
            content: textParts.join('\n'),
          });
        }

        if (toolCalls.length > 0) {
          glmMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCalls,
          });
        }

        if (toolResults.length > 0) {
          glmMessages.push(...toolResults);
        }
      }
    }

    // Convert tools to GLM format (OpenAI-compatible)
    const glmTools = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    // Make API request
    const requestBody: any = {
      model: this.config.model,
      messages: glmMessages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    if (glmTools.length > 0) {
      requestBody.tools = glmTools;
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No response from GLM API');
    }

    // Parse response content
    const content: any[] = [];
    let stopReason: ProviderResponse['stopReason'] = 'end_turn';

    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    if (choice.message.tool_calls) {
      stopReason = 'tool_use';
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
    }

    // Map finish reason
    if (choice.finish_reason === 'length') {
      stopReason = 'max_tokens';
    } else if (choice.finish_reason === 'tool_calls') {
      stopReason = 'tool_use';
    }

    return {
      content,
      stopReason,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }

  getProviderName(): string {
    return 'zhipu';
  }
}

/**
 * Default GLM models
 */
export const GLM_MODELS = {
  FLASH: 'glm-4-flash',      // Free!
  AIR: 'glm-4.5-air',        // Budget
  STANDARD: 'glm-4.5',       // Standard
  V6: 'glm-4.6',             // Latest
} as const;
