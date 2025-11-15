# Getting Started with Your Agentic Swarm

Your multi-provider setup is ready! Here's how to use it.

## ✅ What's Already Configured

1. **API Keys Set**: GLM (free) and Gemini (low-cost) are configured in `.env`
2. **Dependencies**: Ready to install
3. **Examples**: 3 working examples ready to run
4. **Multi-Provider**: Automatic fallback between GLM → Gemini

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
cd agentic-swarm
npm install
```

This may take a minute. If you hit permission errors, see `SETUP.md`.

### Step 2: Test Your Setup

```bash
npm run test-setup
```

This will:
- Verify your API keys work
- Test the multi-provider system
- Run a simple calculation
- Show you're running **for FREE** with GLM

Expected output:
```
✅ API keys loaded from .env
🔧 Setting up ULTRA_LOW_COST configuration...
✅ Success! Result: [calculation result]
📊 Token Usage: [your usage]
💰 Cost: $0.00 (FREE with GLM Flash!)
```

### Step 3: Run Examples

**Option A: Free GLM Only**
```bash
npm run dev examples/glm-only.ts
```

**Option B: Multi-Provider (Recommended)**
```bash
npm run dev examples/multi-provider.ts
```

**Option C: Gemini Only**
```bash
npm run dev examples/gemini-only.ts
```

## 🎯 Your Current Configuration

**Primary Provider**: GLM-4-Flash (Zhipu AI)
- Cost: **FREE** ✨
- Speed: Very fast
- Quality: Good for most tasks

**Fallback Provider**: Gemini 2.5 Flash-Lite (Google)
- Cost: $0.10 per 1M input tokens
- Speed: Fast
- Quality: Excellent
- Triggers: If GLM fails or has issues

**Monthly Cost Estimate**: **$0** for moderate use (GLM is free!)

## 📝 Example Usage

### Simple Query

```typescript
import 'dotenv/config';
import { OrchestratorAgent, ProviderFactory, GLM_MODELS } from 'agentic-swarm';

// Create GLM provider (free!)
const provider = ProviderFactory.createProvider('zhipu', {
  apiKey: process.env.ZHIPU_API_KEY,
  model: GLM_MODELS.FLASH,
});

// Create orchestrator
const orchestrator = new OrchestratorAgent(provider, []);

// Run query
const result = await orchestrator.execute('Explain quantum computing in simple terms');
console.log(result);
```

### Multi-Provider with Fallback

```typescript
import 'dotenv/config';
import {
  OrchestratorAgent,
  ProviderFactory,
  RECOMMENDED_CONFIGS
} from 'agentic-swarm';

// Use recommended ultra-low-cost config
const config = RECOMMENDED_CONFIGS.ULTRA_LOW_COST({
  zhipu: process.env.ZHIPU_API_KEY,
  google: process.env.GOOGLE_API_KEY,
});

const providers = ProviderFactory.createMultiProvider(config);

const orchestrator = new OrchestratorAgent(
  providers.primary,   // GLM (free)
  [],
  {},
  providers.fallback   // Gemini (if GLM fails)
);

// This will use GLM, fallback to Gemini if needed
const result = await orchestrator.execute('Complex research task...');
```

## 🛠️ Adding Tools

Tools give your agents capabilities:

```typescript
import { calculatorTool, webSearchTool } from 'agentic-swarm';

const tools = [calculatorTool, webSearchTool];

const orchestrator = new OrchestratorAgent(
  provider,
  tools,  // Add tools here
);

// Now agents can calculate and search!
```

## 📊 Monitoring Usage

Track your token usage and costs:

```typescript
const result = await orchestrator.execute('query...');

// Get usage stats
const usage = orchestrator.getTokenUsage();
console.log(`Tokens used: ${usage.total}`);
console.log(`Input: ${usage.input}, Output: ${usage.output}`);

// Calculate cost (GLM is free, but good to track)
const cost = (usage.input / 1_000_000) * 0.0 +  // GLM input (free)
             (usage.output / 1_000_000) * 0.0;  // GLM output (free)
console.log(`Cost: $${cost.toFixed(4)}`);
```

## 🔍 What to Try Next

1. **Simple Calculations**
   ```bash
   npm run dev examples/glm-only.ts
   ```
   Change the query to test different math problems.

2. **Complex Research**
   ```bash
   npm run dev examples/multi-provider.ts
   ```
   This spawns multiple workers in parallel.

3. **Build Your Own**
   - Copy an example file
   - Modify the query
   - Add custom tools (see `src/tools/` for examples)
   - Run it!

## 💡 Tips

**Cost Optimization:**
- GLM Flash is FREE - use it liberally for development
- Gemini is backup - only charged if GLM fails
- Track usage with `.getTokenUsage()` to monitor patterns

**Development Workflow:**
- Start with GLM Flash (free testing)
- Add Gemini fallback for production reliability
- Only add Claude if you need premium quality

**Common Patterns:**
- **Research**: Multi-provider with 5-10 workers
- **Simple tasks**: Single provider, no workers needed
- **Production**: Primary + fallback for reliability

## 🐛 Troubleshooting

**"API keys not found"**
- Check `.env` file exists in project root
- Verify `ZHIPU_API_KEY` and `GOOGLE_API_KEY` are set
- Run `cat .env` to verify

**"Connection failed"**
- Check internet connection
- GLM is hosted in China - may be slower from outside
- Gemini will auto-fallback if GLM fails

**"Module not found"**
- Run `npm install` again
- Check you're in `agentic-swarm/` directory
- Try `rm -rf node_modules && npm install`

## 🔒 Security Note

⚠️ **Important**: The API keys in your `.env` file were shared in our conversation.

**Recommended next steps:**
1. Test the system works (run the examples)
2. Rotate your API keys for production use:
   - GLM: https://open.bigmodel.cn/ → regenerate key
   - Gemini: https://aistudio.google.com/apikey → create new key
3. Never commit `.env` to git (already in `.gitignore`)

## 📚 Learn More

- **MULTI_PROVIDER.md** - Deep dive into provider costs and strategies
- **ARCHITECTURE.md** - How the orchestrator-worker pattern works
- **QUICKSTART.md** - More usage examples
- **examples/** folder - Working code samples

## 🎉 You're Ready!

Run this to get started:
```bash
npm install && npm run test-setup
```

Then explore the examples and build something cool! 🚀
