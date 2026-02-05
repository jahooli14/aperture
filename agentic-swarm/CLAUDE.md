# Agentic Swarm

Multi-agent task orchestration. Active. TypeScript, Node.js, multi-provider AI.

## Key Context
- Supports Claude (Anthropic), Gemini (Google), GLM (Zhipu) providers
- Orchestrator-worker pattern with parallel execution
- Cost-optimized: GLM free tier, Gemini ultra-low, Claude for quality
- CLI tool, not a web app — no Vercel deployment

## Provider Cost Model (per 1,000 queries)
- GLM Flash: $0 (free)
- Gemini Flash-Lite: ~$2-5
- Claude Sonnet: ~$50-100

## Before You Push
```bash
npm run build    # TypeScript compilation
npm run test     # Vitest tests
```

## Useful Commands
```bash
npm run demo             # Swarm vs single agent comparison
npm run overnight        # Generic research run
npm run overnight-pro    # Gemini-based research
npm run overnight-ultra  # Deep research
npm run overnight-free   # Free GLM tier only
```

## Don't Do This
- Don't hard-code API keys — use environment variables
- Don't add web framework dependencies — this is a CLI/library
- Don't skip error handling for provider API calls — they fail often
- Don't assume all providers support the same features
