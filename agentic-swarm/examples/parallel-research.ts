import { OrchestratorAgent } from '../src/agents/orchestrator.js';
import { defaultTools } from '../src/tools/index.js';

/**
 * Example: Parallel research using multiple workers
 * Demonstrates Anthropic's orchestrator-worker pattern with parallel execution
 */
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    process.exit(1);
  }

  const orchestrator = new OrchestratorAgent(apiKey, defaultTools, {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192, // Larger for complex research
    maxIterations: 30,
  });

  console.log('=== Agentic Swarm - Parallel Research Example ===\n');
  console.log('Task: Comprehensive research on building AI agent systems\n');

  const startTime = Date.now();

  // Complex multi-aspect research query
  const result = await orchestrator.execute(
    `Conduct comprehensive research on building production-ready AI agent systems.

Please investigate these aspects in parallel:

1. Architecture Patterns
   - Compare workflows vs agents
   - Orchestrator-worker patterns
   - Multi-agent coordination strategies

2. Tool Design Best Practices
   - Agent-Computer Interface principles
   - Tool documentation standards
   - Error handling approaches

3. Context Management
   - Handling long-running tasks
   - Memory and state persistence
   - Context window optimization

4. Production Considerations
   - Testing and evaluation strategies
   - Monitoring and observability
   - Cost optimization techniques

Synthesize findings into a comprehensive guide with specific recommendations.`
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=== Research Results ===\n');
  console.log(result);

  console.log('\n\n=== Execution Metrics ===');
  console.log(`Duration: ${duration}s`);
  console.log(`Workers spawned: ${orchestrator.getWorkers().size}`);

  // Show worker details
  console.log('\nWorker breakdown:');
  orchestrator.getWorkers().forEach((worker, id) => {
    const task = worker.getCurrentTask();
    if (task) {
      console.log(`\n  Worker: ${id}`);
      console.log(`  Objective: ${task.objective.substring(0, 80)}...`);
      console.log(`  Output format: ${task.outputFormat}`);
    }
  });

  // Show conversation history size
  const history = orchestrator.getConversationHistory();
  console.log(`\nTotal conversation messages: ${history.length}`);
}

main().catch(console.error);
