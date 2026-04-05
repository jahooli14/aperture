import { BaseProvider, ProviderConfig } from './base-provider.js';
import { AnthropicProvider, ANTHROPIC_MODELS } from './anthropic-provider.js';
import { GeminiProvider, GEMINI_MODELS } from './gemini-provider.js';
import { GLMProvider, GLM_MODELS } from './glm-provider.js';

export type ProviderType = 'anthropic' | 'google' | 'zhipu';

export interface MultiProviderConfig {
  primary: {
    type: ProviderType;
    apiKey: string;
    model: string;
  };
  fallback?: {
    type: ProviderType;
    apiKey: string;
    model: string;
  };
  premium?: {
    type: ProviderType;
    apiKey: string;
    model: string;
  };
  maxTokens?: number;
  temperature?: number;
}

/**
 * Factory for creating provider instances
 */
export class ProviderFactory {
  static createProvider(
    type: ProviderType,
    config: ProviderConfig
  ): BaseProvider {
    switch (type) {
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'google':
        return new GeminiProvider(config);
      case 'zhipu':
        return new GLMProvider(config);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Create a multi-provider setup with primary, fallback, and premium options
   */
  static createMultiProvider(config: MultiProviderConfig): {
    primary: BaseProvider;
    fallback?: BaseProvider;
    premium?: BaseProvider;
  } {
    const providers: any = {
      primary: ProviderFactory.createProvider(config.primary.type, {
        apiKey: config.primary.apiKey,
        model: config.primary.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      }),
    };

    if (config.fallback) {
      providers.fallback = ProviderFactory.createProvider(config.fallback.type, {
        apiKey: config.fallback.apiKey,
        model: config.fallback.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });
    }

    if (config.premium) {
      providers.premium = ProviderFactory.createProvider(config.premium.type, {
        apiKey: config.premium.apiKey,
        model: config.premium.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });
    }

    return providers;
  }
}

/**
 * Recommended provider configurations
 */
export const RECOMMENDED_CONFIGS = {
  /**
   * Ultra-low cost: GLM Flash (free) with Gemini fallback
   */
  ULTRA_LOW_COST: (apiKeys: { zhipu: string; google: string }): MultiProviderConfig => ({
    primary: {
      type: 'zhipu',
      apiKey: apiKeys.zhipu,
      model: GLM_MODELS.FLASH, // Free!
    },
    fallback: {
      type: 'google',
      apiKey: apiKeys.google,
      model: GEMINI_MODELS.FLASH_LITE, // $0.10 input
    },
  }),

  /**
   * Balanced: Gemini Flash-Lite with GLM fallback
   */
  BALANCED: (apiKeys: { google: string; zhipu: string }): MultiProviderConfig => ({
    primary: {
      type: 'google',
      apiKey: apiKeys.google,
      model: GEMINI_MODELS.FLASH_LITE,
    },
    fallback: {
      type: 'zhipu',
      apiKey: apiKeys.zhipu,
      model: GLM_MODELS.AIR,
    },
    premium: {
      type: 'google',
      apiKey: apiKeys.google,
      model: GEMINI_MODELS.FLASH_2_5,
    },
  }),

  /**
   * High quality: Claude with Gemini fallback
   */
  HIGH_QUALITY: (apiKeys: { anthropic: string; google: string }): MultiProviderConfig => ({
    primary: {
      type: 'anthropic',
      apiKey: apiKeys.anthropic,
      model: ANTHROPIC_MODELS.SONNET_4,
    },
    fallback: {
      type: 'google',
      apiKey: apiKeys.google,
      model: GEMINI_MODELS.FLASH_2_5,
    },
  }),
};

/**
 * Export model constants for convenience
 */
export { ANTHROPIC_MODELS, GEMINI_MODELS, GLM_MODELS };
