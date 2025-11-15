# Quick Start Guide

Get up and running with Agentic Swarm in under 5 minutes.

## Prerequisites

- Node.js 20+ installed
- Anthropic API key ([get one here](https://console.anthropic.com/))

## Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your API key to .env
# ANTHROPIC_API_KEY=your_key_here
```

## Basic Usage

### Example 1: Simple Query

```typescript
import { OrchestratorAgent } from './src/agents/orchestrator.js';
import { defaultTools } from './src/tools/index.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const orchestrator = new OrchestratorAgent(apiKey, defaultTools);

const result = await orchestrator.execute(
  'Calculate the square root of 144 and explain the result'
);

console.log(result);
```

Run it:
```bash
npm run dev examples/basic-usage.ts
```

### Example 2: Complex Multi-Agent Research

```typescript
const result = await orchestrator.execute(
  `Research autonomous AI agents by investigating:
  1. Key architecture patterns
  2. Best practices for tool design
  3. Context management strategies

  Provide a comprehensive summary.`
);
```

The orchestrator will:
1. Analyze the query
2. Spawn 3+ worker agents in parallel
3. Each worker focuses on one aspect
4. Synthesize results into coherent output

Run it:
```bash
npm run dev examples/parallel-research.ts
```

### Example 3: Custom Tools

Create a custom tool:

```typescript
import type { Tool } from './src/types/index.js';

const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something useful',
  input_schema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' }
    },
    required: ['input']
  },
  execute: async (input) => {
    // Your logic here
    return { result: 'success' };
  }
};

// Add to orchestrator
const orchestrator = new OrchestratorAgent(apiKey, [myTool, ...defaultTools]);
```

Run it:
```bash
npm run dev examples/custom-tools.ts
```

## Project Structure

```
agentic-swarm/
├── src/
│   ├── agents/          # Orchestrator and worker agents
│   │   ├── base-agent.ts
│   │   ├── orchestrator.ts
│   │   └── worker-agent.ts
│   ├── tools/           # Built-in tools
│   │   ├── web-search.ts
│   │   ├── calculator.ts
│   │   ├── file-operations.ts
│   │   └── index.ts
│   ├── utils/           # Context management and memory
│   │   ├── memory.ts
│   │   ├── context-compaction.ts
│   │   └── index.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   └── index.ts         # Main exports
├── examples/            # Usage examples
│   ├── basic-usage.ts
│   ├── custom-tools.ts
│   └── parallel-research.ts
└── tests/              # Test suites
```

## Key Concepts

### Orchestrator-Worker Pattern

**Orchestrator**: Coordinates strategy and delegates tasks
- Analyzes queries
- Decomposes into subtasks
- Spawns worker agents
- Synthesizes results

**Workers**: Execute focused subtasks
- Independent context windows
- Parallel execution
- Return condensed summaries (1-2k tokens)

### Tool Design

Tools should be:
- Self-contained and robust
- Clear purpose with examples
- Minimal overlap
- Token-efficient outputs

### Context Management

For long-running tasks:
- Use `FileMemory` for persistence
- Compact conversation history
- Keep workers focused
- Return summaries, not raw data

## Configuration

Customize agent behavior:

```typescript
const config = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 1.0,
  maxIterations: 20,
};

const orchestrator = new OrchestratorAgent(apiKey, tools, config);
```

## Monitoring

Track agent activity:

```typescript
// Get conversation history
const history = orchestrator.getConversationHistory();
console.log(`Messages: ${history.length}`);

// Get spawned workers
const workers = orchestrator.getWorkers();
console.log(`Workers: ${workers.size}`);

// Inspect worker tasks
workers.forEach((worker, id) => {
  const task = worker.getCurrentTask();
  console.log(`${id}: ${task?.objective}`);
});
```

## Best Practices

1. **Start Simple**: Use single LLM calls before adding agents
2. **Clear Task Descriptions**: Specify objective, format, boundaries
3. **Parallel Execution**: Use multiple workers for speed
4. **Error Handling**: Set max iterations, validate inputs
5. **Test Thoroughly**: Sandbox testing before production

## Common Patterns

### Research Task
```typescript
// Spawns multiple workers to explore different aspects
await orchestrator.execute('Research [topic] covering [aspects]');
```

### Data Processing
```typescript
// Worker agents process different data segments
await orchestrator.execute('Analyze dataset and find patterns');
```

### Multi-Step Workflow
```typescript
// Orchestrator coordinates sequential and parallel steps
await orchestrator.execute('Gather data, analyze, and generate report');
```

## Troubleshooting

**Issue**: Agent hits max iterations
- **Solution**: Increase `maxIterations` in config or simplify task

**Issue**: Workers return too much data
- **Solution**: Specify "condensed summary" in task description

**Issue**: Duplicate work between workers
- **Solution**: Provide clearer task boundaries and objectives

**Issue**: High API costs
- **Solution**: Use simpler models for workers, reduce parallel workers

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for deep dive
- Explore [examples/](./examples/) for more patterns
- Create custom tools for your use case
- Implement persistent memory for long tasks

## Resources

- [Anthropic Documentation](https://docs.anthropic.com/)
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Claude API Reference](https://docs.anthropic.com/claude/reference)

## Support

Questions or issues? Check the architecture docs or review the example code.
