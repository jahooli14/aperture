import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  BaseProvider,
  ProviderMessage,
  ProviderTool,
  ProviderResponse,
  ProviderConfig,
} from './base-provider.js';

/**
 * Google Gemini provider implementation
 */
export class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({
      model: config.model,
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    });
  }

  async sendMessage(
    messages: ProviderMessage[],
    tools: ProviderTool[],
    systemPrompt?: string
  ): Promise<ProviderResponse> {
    // Convert messages to Gemini format
    const geminiMessages = messages.map((msg) => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        };
      }

      // Handle complex content (tool use, etc.)
      const parts: any[] = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
              },
            });
          } else if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: block.tool_use_id,
                response: {
                  content: block.content,
                },
              },
            });
          }
        }
      }

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: parts.length > 0 ? parts : [{ text: '' }],
      };
    });

    // Convert tools to Gemini function declarations
    const geminiTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.convertSchemaToGemini(tool.input_schema),
    }));

    // Build system instruction
    const systemInstruction = systemPrompt || undefined;

    // Create chat with history
    const chat = this.model.startChat({
      history: geminiMessages.slice(0, -1),
      systemInstruction,
      tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
    });

    // Get last message
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const lastMessageText = lastMessage.parts.map((p: any) => p.text || '').join('');

    // Send message
    const result = await chat.sendMessage(lastMessageText);
    const response = result.response;

    // Parse response
    const content: any[] = [];
    let stopReason: ProviderResponse['stopReason'] = 'end_turn';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        content.push({ type: 'text', text: part.text });
      } else if (part.functionCall) {
        stopReason = 'tool_use';
        content.push({
          type: 'tool_use',
          id: `tool_${Date.now()}_${Math.random()}`,
          name: part.functionCall.name,
          input: part.functionCall.args,
        });
      }
    }

    // Extract usage metadata
    const usage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    };

    return {
      content,
      stopReason,
      usage,
    };
  }

  /**
   * Convert JSON schema to Gemini parameter format
   */
  private convertSchemaToGemini(schema: any): any {
    const converted: any = {
      type: 'OBJECT',
      properties: {},
      required: schema.required || [],
    };

    for (const [key, value] of Object.entries(schema.properties || {})) {
      const prop: any = value;
      converted.properties[key] = {
        type: this.mapTypeToGemini(prop.type),
        description: prop.description,
      };

      if (prop.items) {
        converted.properties[key].items = {
          type: this.mapTypeToGemini(prop.items.type),
        };
      }
    }

    return converted;
  }

  /**
   * Map JSON schema types to Gemini types
   */
  private mapTypeToGemini(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'STRING',
      number: 'NUMBER',
      integer: 'INTEGER',
      boolean: 'BOOLEAN',
      array: 'ARRAY',
      object: 'OBJECT',
    };

    return typeMap[type.toLowerCase()] || 'STRING';
  }

  getProviderName(): string {
    return 'google';
  }
}

/**
 * Default Gemini models
 */
export const GEMINI_MODELS = {
  FLASH_2_5: 'gemini-2.5-flash',
  FLASH_LITE: 'gemini-2.5-flash-lite',
  PRO_2_5: 'gemini-2.5-pro',
  FLASH_2_0: 'gemini-2.0-flash',
} as const;
