# Multi-Provider Guide

The agentic swarm supports multiple LLM providers with automatic fallback and cost optimization.

## Supported Providers

### 1. Zhipu AI (GLM) - Ultra Low Cost 💰

**Models:**
- `glm-4-flash` - **COMPLETELY FREE!** ✨
- `glm-4.5-air` - $0.20 input / $1.10 output per 1M tokens
- `glm-4.5` - $0.60 input / $2.20 output per 1M tokens
- `glm-4.6` - $0.50 input / $1.75 output per 1M tokens

**Get API Key:** https://open.bigmodel.cn/

**Best For:**
- Prototyping and testing
- High-volume applications
- Cost-conscious production
- Learning experiments

**Considerations:**
- Free tier sustainability unknown (government-subsidized)
- Geopolitical considerations for production use
- Based in China (data sovereignty)

### 2. Google (Gemini) - Balanced Quality/Cost ⚡

**Models:**
- `gemini-2.5-flash-lite` - $0.10 input / $0.40 output per 1M tokens
- `gemini-2.5-flash` - $0.30 input / $2.50 output per 1M tokens
- `gemini-2.5-pro` - Higher cost, better quality
- `gemini-2.0-flash` - Fast, efficient

**Get API Key:** https://aistudio.google.com/apikey

**Best For:**
- Production applications
- Reliable service quality
- Good cost/performance balance
- Long context windows (1M tokens)

**Considerations:**
- Solid enterprise support
- Global availability
- Predictable pricing

### 3. Anthropic (Claude) - Premium Quality 🏆

**Models:**
- `claude-sonnet-4-20250514` - $3.00 input / $15.00 output per 1M tokens
- `claude-3-5-sonnet-20241022` - Previous generation
- `claude-3-5-haiku-20241022` - Faster, cheaper

**Get API Key:** https://console.anthropic.com/

**Best For:**
- Complex reasoning tasks
- High-quality outputs
- Sensitive/critical applications
- Best-in-class performance

**Considerations:**
- 10-30x more expensive than alternatives
- Excellent for orchestrator role
- Strong at following complex instructions

## Quick Start

### Option 1: Single Provider (Simplest)

```typescript
import { OrchestratorAgent, ProviderFactory, GLM_MODELS } from 'agentic-swarm';

// Use GLM (free!)
const provider = ProviderFactory.createProvider('zhipu', {
  apiKey: process.env.ZHIPU_API_KEY,
  model: GLM_MODELS.FLASH,
});

const orchestrator = new OrchestratorAgent(provider, tools);
```

### Option 2: Multi-Provider with Fallback (Recommended)

```typescript
import {
  ProviderFactory,
  RECOMMENDED_CONFIGS,
  OrchestratorAgent
} from 'agentic-swarm';

// Ultra-low cost: GLM (free) + Gemini fallback
const config = RECOMMENDED_CONFIGS.ULTRA_LOW_COST({
  zhipu: process.env.ZHIPU_API_KEY,
  google: process.env.GOOGLE_API_KEY,
});

const providers = ProviderFactory.createMultiProvider(config);

const orchestrator = new OrchestratorAgent(
  providers.primary,    // GLM Flash (free)
  tools,
  {},
  providers.fallback,   // Gemini Flash-Lite
  providers.premium     // undefined
);
```

### Option 3: Custom Multi-Provider Setup

```typescript
import { ProviderFactory, OrchestratorAgent } from 'agentic-swarm';

// Primary: Gemini Flash-Lite (cheap)
const primary = ProviderFactory.createProvider('google', {
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.5-flash-lite',
});

// Fallback: GLM (free backup)
const fallback = ProviderFactory.createProvider('zhipu', {
  apiKey: process.env.ZHIPU_API_KEY,
  model: 'glm-4-flash',
});

// Premium: Claude Sonnet (complex reasoning)
const premium = ProviderFactory.createProvider('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
});

const orchestrator = new OrchestratorAgent(
  primary,
  tools,
  {},
  fallback,
  premium
);
```

## Recommended Configurations

### For Development/Testing
```typescript
RECOMMENDED_CONFIGS.ULTRA_LOW_COST({
  zhipu: ZHIPU_API_KEY,
  google: GOOGLE_API_KEY,
});
// Primary: GLM Flash (free)
// Fallback: Gemini Flash-Lite ($0.10 input)
// Cost: ~$0/month for moderate use
```

### For Production (Reliability)
```typescript
RECOMMENDED_CONFIGS.BALANCED({
  google: GOOGLE_API_KEY,
  zhipu: ZHIPU_API_KEY,
});
// Primary: Gemini Flash-Lite ($0.10 input)
// Fallback: GLM Air ($0.20 input)
// Premium: Gemini Flash 2.5 ($0.30 input)
// Cost: ~$2-10/month for moderate use
```

### For High-Quality Output
```typescript
RECOMMENDED_CONFIGS.HIGH_QUALITY({
  anthropic: ANTHROPIC_API_KEY,
  google: GOOGLE_API_KEY,
});
// Primary: Claude Sonnet 4 ($3.00 input)
// Fallback: Gemini Flash 2.5 ($0.30 input)
// Cost: ~$50-100/month for moderate use
```

## Fallback Behavior

When the primary provider fails:
1. System catches the error
2. Automatically retries with fallback provider
3. Continues execution seamlessly
4. Logs warning about provider switch

```typescript
// Example: Automatic fallback
try {
  // Tries primary (GLM Flash)
  const response = await provider.sendMessage(...);
} catch (error) {
  // Automatically falls back to Gemini
  console.warn('Primary failed, using fallback...');
  const response = await fallbackProvider.sendMessage(...);
}
```

## Cost Optimization Strategies

### Strategy 1: Hybrid Provider Usage
```typescript
// Workers use free GLM, orchestrator uses quality Gemini
const workerProvider = ProviderFactory.createProvider('zhipu', {
  apiKey: ZHIPU_API_KEY,
  model: 'glm-4-flash', // FREE for workers
});

const orchestratorProvider = ProviderFactory.createProvider('google', {
  apiKey: GOOGLE_API_KEY,
  model: 'gemini-2.5-flash', // Quality for orchestration
});
```

### Strategy 2: Task-Based Provider Selection
```typescript
// Simple tasks: Use GLM (free)
// Complex tasks: Use premium (if available)
const result = await orchestrator.runLoop(query, isComplexTask);
```

### Strategy 3: Rate Limiting with Free Tier
```typescript
// Track usage and switch to paid when hitting limits
let requestCount = 0;
const DAILY_FREE_LIMIT = 1000;

const provider = requestCount < DAILY_FREE_LIMIT
  ? glmProvider      // Free
  : geminiProvider;  // Paid backup
```

## Monitoring & Debugging

### Track Token Usage
```typescript
const usage = orchestrator.getTokenUsage();
console.log(`Tokens: ${usage.total}`);
console.log(`Cost estimate: $${calculateCost(usage)}`);
```

### Provider Information
```typescript
const info = orchestrator.getProviderInfo();
console.log(`Using: ${info.primary}`);
console.log(`Fallback: ${info.fallback}`);
```

### Per-Worker Tracking
```typescript
const workers = orchestrator.getWorkers();
workers.forEach((worker, id) => {
  const usage = worker.getTokenUsage();
  console.log(`Worker ${id}: ${usage.total} tokens`);
});
```

## Cost Comparison Examples

### Light Usage (100 queries/month)

| Configuration | Monthly Cost |
|---------------|--------------|
| GLM Flash only | **$0** |
| Gemini Flash-Lite | ~$0.30 |
| Gemini Flash 2.5 | ~$1.50 |
| Claude Sonnet 4 | ~$15-30 |

### Moderate Usage (1,000 queries/month)

| Configuration | Monthly Cost |
|---------------|--------------|
| GLM Flash only | **$0** |
| GLM + Gemini fallback | ~$0-3 |
| Gemini only | ~$10-18 |
| Claude only | ~$100-150 |

### Heavy Usage (10,000 queries/month)

| Configuration | Monthly Cost |
|---------------|--------------|
| GLM Flash only | **$0** |
| GLM + Gemini fallback | ~$0-30 |
| Gemini only | ~$100-180 |
| Claude only | ~$1,000-1,500 |

## Environment Setup

Create `.env` file:

```bash
# Option 1: Ultra-low cost (GLM + Gemini)
ZHIPU_API_KEY=your_zhipu_key
GOOGLE_API_KEY=your_google_key

# Option 2: Add Claude for premium quality
ANTHROPIC_API_KEY=your_anthropic_key
```

## Examples

Run the provider-specific examples:

```bash
# GLM only (free!)
npm run dev examples/glm-only.ts

# Gemini only
npm run dev examples/gemini-only.ts

# Multi-provider with fallback
npm run dev examples/multi-provider.ts
```

## Best Practices

1. **Start Free**: Begin with GLM Flash to prototype
2. **Add Fallback**: Add Gemini for production reliability
3. **Monitor Costs**: Track token usage and adjust
4. **Test Providers**: Compare quality for your use case
5. **Plan for Scale**: Free tiers may have hidden limits
6. **Geographic Considerations**: GLM hosted in China, Gemini/Claude global
7. **Data Sensitivity**: Use appropriate provider for your data requirements

## Troubleshooting

### GLM API Errors
- Check API key is valid
- Verify network can reach Chinese servers
- Try fallback provider

### Gemini Rate Limits
- Free tier has 60 requests/minute
- Paid tier increases limits substantially
- Implement exponential backoff

### Provider Switching Issues
- Ensure fallback provider is configured
- Check error logs for specific failures
- Verify API keys for all providers

## Future Providers

The architecture supports easy addition of new providers:
- OpenAI (GPT-4, etc.)
- Mistral AI
- Cohere
- Local models (Ollama, LM Studio)

To add a provider, implement `BaseProvider` interface.
