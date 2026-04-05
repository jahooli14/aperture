# Agentic Swarm

An autonomous multi-agent system with **multi-provider support** (GLM, Gemini, Claude) and built-in cost optimization.

## Features

✨ **Multi-Provider Support**
- GLM (Zhipu AI) - **FREE** tier available
- Google Gemini - Ultra-low cost ($0.10/1M tokens)
- Anthropic Claude - Premium quality
- Automatic fallback between providers

🏗️ **Orchestrator-Worker Pattern**
- Lead agent coordinates strategy and task decomposition
- Specialized worker agents execute focused subtasks in parallel
- Workers return condensed results for context efficiency

💰 **Cost Optimized**
- Run for **$0/month** with GLM Flash (free tier)
- Or **$2-10/month** with Gemini Flash-Lite
- Hybrid strategies: Free workers + quality orchestrator

⚡ **Production Ready**
- Automatic provider fallback on errors
- Token usage tracking
- Parallel tool execution (3+ simultaneous)
- Context management and compaction

## Quick Start

Choose your provider and get started in < 5 minutes:

### Option 1: Free Tier (GLM)
```bash
# Get free API key: https://open.bigmodel.cn/
export ZHIPU_API_KEY=your_key
npm run dev examples/glm-only.ts
```

### Option 2: Ultra-Low Cost (Gemini)
```bash
# Get API key: https://aistudio.google.com/apikey
export GOOGLE_API_KEY=your_key
npm run dev examples/gemini-only.ts
```

### Option 3: Multi-Provider (Recommended)
```bash
# Use both for automatic fallback
export ZHIPU_API_KEY=your_zhipu_key
export GOOGLE_API_KEY=your_google_key
npm run dev examples/multi-provider.ts
```

## Key Principles

- **Start Simple**: Avoid unnecessary complexity
- **Multi-Provider**: Hedge against pricing changes and outages
- **Clear Tool Design**: Self-contained, robust tools with explicit purposes
- **Context Management**: Just-in-time retrieval and compaction
- **Parallel Execution**: Multiple simultaneous operations for speed
- **Observability**: Track agent decisions, failures, and costs

## Project Structure

```
agentic-swarm/
├── src/
│   ├── agents/          # Orchestrator and worker agents
│   ├── tools/           # Tool definitions and implementations
│   ├── utils/           # Context management, memory, helpers
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main entry point
├── examples/            # Usage examples
└── tests/              # Test suites
```

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Basic usage and examples
- **[MULTI_PROVIDER.md](./MULTI_PROVIDER.md)** - Provider setup, costs, and strategies
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and patterns
- **[SETUP.md](./SETUP.md)** - Installation and configuration

## Cost Comparison

| Provider | Input Cost | Output Cost | Free Tier? |
|----------|-----------|-------------|------------|
| **GLM Flash** | $0 | $0 | ✅ Yes! |
| Gemini Flash-Lite | $0.10/1M | $0.40/1M | Limited |
| Gemini Flash 2.5 | $0.30/1M | $2.50/1M | Limited |
| Claude Sonnet 4 | $3.00/1M | $15.00/1M | No |

**Example Monthly Costs (1,000 queries):**
- GLM Flash: **$0** (free)
- Gemini Flash-Lite: **~$2-5**
- Claude Sonnet 4: **~$50-100**

See [MULTI_PROVIDER.md](./MULTI_PROVIDER.md) for detailed cost analysis.
