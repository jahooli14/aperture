import type { Tool, AgentConfig, TaskDescription, AgentResult } from '../types/index.js';
import type { BaseProvider } from '../providers/index.js';
import { BaseAgent } from './base-agent.js';
import { WorkerAgent } from './worker-agent.js';

export class OrchestratorAgent extends BaseAgent {
  private workers: Map<string, WorkerAgent>;

  constructor(
    provider: BaseProvider,
    tools: Tool[] = [],
    config: AgentConfig = {},
    fallbackProvider?: BaseProvider,
    premiumProvider?: BaseProvider
  ) {
    super(provider, tools, config, fallbackProvider, premiumProvider);
    this.workers = new Map();
  }

  protected getDefaultSystemPrompt(): string {
    return `You are an orchestrator agent coordinating a swarm of specialized worker agents.

Your responsibilities:
1. Analyze user queries and break them into focused subtasks
2. Create detailed task descriptions for worker agents
3. Delegate tasks to specialized workers
4. Synthesize results from multiple workers into coherent final outputs

## Task Decomposition Guidelines

For each subtask, specify:
- **Objective**: Clear, specific goal
- **Output Format**: Exact structure expected (JSON, markdown, list, etc.)
- **Tool Guidance**: Which tools to prioritize and how to use them
- **Boundaries**: What NOT to do, scope limits

## Scaling Rules

- Simple queries: 1-2 workers with 3-10 tool calls each
- Moderate complexity: 3-5 workers with parallel execution
- Complex research: 10+ workers exploring different aspects

## Best Practices

- Provide detailed, specific task descriptions to prevent duplicate work
- Use parallel execution whenever possible (3+ simultaneous operations)
- Keep worker tasks focused and bounded
- Synthesize worker outputs into cohesive final response

When you need to delegate work, use the "delegate_task" tool to spawn worker agents.
Your output should be clear, concise, and well-structured.`;
  }

  /**
   * Execute a user query using the orchestrator-worker pattern
   */
  async execute(query: string): Promise<string> {
    // Add delegation tool to orchestrator
    this.addDelegationTool();

    // Run the orchestrator loop
    const result = await this.runLoop(query);

    return result;
  }

  /**
   * Add the special "delegate_task" tool that allows spawning workers
   */
  private addDelegationTool(): void {
    const delegateTool: Tool = {
      name: 'delegate_task',
      description: `Delegate a focused subtask to a specialized worker agent. Use this when you need to break down complex work into parallel subtasks. Each worker operates independently with its own context window and returns a condensed summary (1000-2000 tokens).`,
      input_schema: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Unique identifier for this task',
          },
          objective: {
            type: 'string',
            description: 'Clear, specific goal for the worker agent',
          },
          output_format: {
            type: 'string',
            description: 'Expected output structure (e.g., "JSON list of findings", "Markdown summary", "Bullet points")',
          },
          tool_guidance: {
            type: 'string',
            description: 'Optional guidance on which tools to use and how',
          },
          boundaries: {
            type: 'string',
            description: 'Optional scope limits - what NOT to do',
          },
          context: {
            type: 'string',
            description: 'Optional additional context the worker needs',
          },
        },
        required: ['task_id', 'objective', 'output_format'],
      },
      execute: async (input: TaskDescription) => {
        return this.delegateToWorker(input);
      },
    };

    this.addTool(delegateTool);
  }

  /**
   * Spawn a worker agent and execute the task
   */
  private async delegateToWorker(task: TaskDescription): Promise<string> {
    console.log(`\n[Orchestrator] Delegating task: ${task.task_id}`);
    console.log(`  Objective: ${task.objective}`);

    // Create worker agent with same provider and tools
    const worker = new WorkerAgent(
      this.provider, // Workers use same provider as orchestrator
      this.tools.filter(t => t.name !== 'delegate_task'), // Workers don't delegate
      {
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        maxIterations: Math.floor(this.config.maxIterations / 2), // Workers get fewer iterations
      },
      this.fallbackProvider, // Pass fallback to workers
      undefined // Workers don't get premium provider
    );

    this.workers.set(task.id, worker);

    // Execute task
    try {
      const result = await worker.executeTask(task);

      console.log(`[Orchestrator] Task ${task.task_id} completed`);
      console.log(`  Tokens used: ${result.tokensUsed}`);
      console.log(`  Iterations: ${result.iterations}`);

      return JSON.stringify({
        task_id: result.taskId,
        success: result.success,
        output: result.output,
        tokens_used: result.tokensUsed,
        iterations: result.iterations,
      }, null, 2);
    } catch (error) {
      console.error(`[Orchestrator] Task ${task.task_id} failed:`, error);
      return JSON.stringify({
        task_id: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2);
    }
  }

  /**
   * Get all worker agents (useful for debugging)
   */
  getWorkers(): Map<string, WorkerAgent> {
    return this.workers;
  }

  /**
   * Clear all workers
   */
  clearWorkers(): void {
    this.workers.clear();
  }
}
