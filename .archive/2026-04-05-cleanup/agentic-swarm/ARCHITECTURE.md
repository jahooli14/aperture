# Agentic Swarm Architecture

This document explains the architecture of the agentic swarm system, based on Anthropic's best practices for building effective agents.

## Overview

The system implements an **orchestrator-worker pattern** where:
- **Orchestrator Agent**: Coordinates strategy, decomposes tasks, and synthesizes results
- **Worker Agents**: Execute focused subtasks in parallel and return condensed summaries
- **Tools**: Self-contained capabilities that agents use to interact with the world
- **Memory**: Persistent state management for long-running tasks

## Core Principles

### 1. Start Simple
Avoid unnecessary complexity. Build the simplest thing that works, then optimize.

### 2. Workflows vs Agents
- **Workflows**: Predefined code paths for well-defined tasks
- **Agents**: Dynamic, autonomous decision-making for open-ended problems

### 3. The Feedback Loop
Every agent follows: **Gather Context → Take Action → Verify Work → Repeat**

## Architecture Components

### BaseAgent
Abstract base class providing core agent functionality:
- API client management
- Tool execution with parallel support
- Conversation history tracking
- Core feedback loop implementation

Key methods:
- `runLoop()`: Execute agent feedback loop
- `processToolCalls()`: Handle tool execution in parallel
- `addTool()`: Register new tools
- `getConversationHistory()`: Access conversation for debugging

### OrchestratorAgent
Coordinates multiple worker agents:
- Analyzes queries and develops strategy
- Decomposes tasks into focused subtasks
- Delegates to specialized workers
- Synthesizes results into final output

Special features:
- `delegate_task` tool: Spawns worker agents
- Worker management and tracking
- Task description validation

Scaling rules (embedded in system prompt):
- Simple queries: 1-2 workers
- Moderate: 3-5 workers
- Complex: 10+ workers

### WorkerAgent
Executes focused subtasks:
- Receives detailed task descriptions
- Uses tools efficiently (parallel when possible)
- Returns condensed summaries (1,000-2,000 tokens)
- Stays within task boundaries

Task description structure:
- **Objective**: Clear, specific goal
- **Output Format**: Expected structure
- **Tool Guidance**: How to use available tools
- **Boundaries**: Scope limits
- **Context**: Additional information needed

### Tool System

Tools follow the Agent-Computer Interface (ACI) principles:

**Design Guidelines:**
- Self-contained and robust to errors
- Extremely clear purpose and usage
- Natural formatting matching training data
- Comprehensive examples and edge cases
- Minimal overlap between tools

**Built-in Tools:**
- `web_search`: Search for information (simulated)
- `calculator`: Mathematical operations
- `read_file`: Read file contents
- `write_file`: Write to files
- `list_directory`: List directory contents

**Custom Tools:**
Create by implementing the `Tool` interface:
```typescript
{
  name: string;
  description: string; // Clear, with examples
  input_schema: object; // JSON schema
  execute: async (input) => Promise<any>;
}
```

### Context Management

**Memory System:**
- `FileMemory`: Persistent storage for long-running tasks
- `InMemoryMemory`: Ephemeral state during execution

**Compaction:**
When approaching context limits (180k+ tokens):
1. Keep first message (context)
2. Keep recent messages (current focus)
3. Summarize middle messages
4. Maintain critical architectural decisions

**Token Estimation:**
Rough approximation: 4 characters ≈ 1 token

## Communication Flow

```
User Query
    ↓
Orchestrator Agent
    ├─ Analyze query
    ├─ Develop strategy
    ├─ Decompose into tasks
    ↓
Spawn Workers (Parallel)
    ├─ Worker 1: Task A
    ├─ Worker 2: Task B
    └─ Worker 3: Task C
    ↓
Workers Execute
    ├─ Gather context (tools)
    ├─ Take action (tools)
    └─ Verify work
    ↓
Return Condensed Summaries
    ↓
Orchestrator Synthesizes
    ↓
Final Response
```

## Best Practices

### Task Decomposition
- Provide detailed, specific descriptions
- Include objective, format, guidance, boundaries
- Prevents duplicate work and gaps

### Parallel Execution
- Use 3+ simultaneous tool calls per agent
- Can reduce research time by up to 90%
- Workers operate independently

### Error Handling
- Maximum iteration limits (prevent runaway)
- Graceful tool error handling
- Clear error messages

### Observability
- Track conversation history
- Monitor worker spawning
- Log task completions and failures

### Testing
- Sandbox testing before production
- Build representative test sets
- Iterate based on observed failures

## Production Considerations

### Safeguards
- Max iterations to maintain control
- Tool input validation
- Resource usage limits
- Human checkpoints for critical decisions

### Cost Management
- Agents incur higher costs than single calls
- Monitor token usage per agent
- Optimize tool calls
- Use appropriate models (Haiku for simple tasks)

### Monitoring
- Decision pattern tracking
- Interaction structure analysis
- Failure mode identification
- Performance metrics

### State Management
- Checkpoints for long-running tasks
- Resume capability
- External memory for persistence
- Context window management

## Extension Points

### Custom Agents
Extend `BaseAgent` and implement:
- `getDefaultSystemPrompt()`: Define agent behavior
- Custom methods for specialized functionality

### Custom Tools
Implement `Tool` interface:
- Clear description with examples
- JSON schema for validation
- Robust error handling
- Token-efficient outputs

### Custom Memory
Implement `Memory` interface:
- `save()`, `load()`, `clear()`
- Support any storage backend
- Handle serialization

## References

Based on Anthropic's documentation:
- [Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents)
- [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
