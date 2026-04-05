import { OrchestratorAgent } from '../src/agents/orchestrator.js';
import { defaultTools } from '../src/tools/index.js';

/**
 * Basic usage example: Using the orchestrator to coordinate multiple workers
 */
async function main() {
  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    process.exit(1);
  }

  // Create orchestrator with default tools
  const orchestrator = new OrchestratorAgent(apiKey, defaultTools, {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 1.0,
    maxIterations: 20,
  });

  console.log('=== Agentic Swarm - Basic Usage Example ===\n');

  // Example 1: Simple query (orchestrator handles without delegation)
  console.log('Example 1: Simple calculation');
  const result1 = await orchestrator.execute(
    'Calculate the square root of 144 and multiply it by 5'
  );
  console.log('Result:', result1);
  console.log('\n---\n');

  // Example 2: Complex query requiring multiple workers
  console.log('Example 2: Complex research task');
  const result2 = await orchestrator.execute(
    `Research the topic of "autonomous AI agents" by:
    1. Finding key concepts and definitions
    2. Identifying current best practices
    3. Summarizing challenges and solutions

    Provide a comprehensive summary with your findings.`
  );
  console.log('Result:', result2);
  console.log('\n---\n');

  // Show worker details
  const workers = orchestrator.getWorkers();
  console.log(`\nTotal workers spawned: ${workers.size}`);
  workers.forEach((worker, id) => {
    console.log(`  - Worker ${id}: ${worker.getCurrentTask()?.objective || 'Unknown'}`);
  });
}

// Run example
main().catch(console.error);
