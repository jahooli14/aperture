import 'dotenv/config';
import { OrchestratorAgent } from '../src/agents/orchestrator.js';
import { defaultTools } from '../src/tools/index.js';
import {
  ProviderFactory,
  RECOMMENDED_CONFIGS,
  GLM_MODELS,
  GEMINI_MODELS,
} from '../src/providers/index.js';

/**
 * Multi-provider example: Ultra-low cost setup with GLM + Gemini
 */
async function main() {
  // Get API keys from environment
  const zhipuApiKey = process.env.ZHIPU_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;

  if (!zhipuApiKey || !googleApiKey) {
    console.error('Error: ZHIPU_API_KEY and GOOGLE_API_KEY environment variables required');
    console.error('\nSet them in your .env file:');
    console.error('  ZHIPU_API_KEY=your_zhipu_key');
    console.error('  GOOGLE_API_KEY=your_google_key');
    process.exit(1);
  }

  console.log('=== Multi-Provider Agentic Swarm ===\n');

  // Option 1: Use recommended configuration (ULTRA_LOW_COST)
  console.log('Configuration: ULTRA_LOW_COST');
  console.log('  Primary: GLM-4-Flash (FREE)');
  console.log('  Fallback: Gemini Flash-Lite ($0.10 input)\n');

  const config = RECOMMENDED_CONFIGS.ULTRA_LOW_COST({
    zhipu: zhipuApiKey,
    google: googleApiKey,
  });

  const providers = ProviderFactory.createMultiProvider(config);

  // Create orchestrator with multi-provider setup
  const orchestrator = new OrchestratorAgent(
    providers.primary,
    defaultTools,
    {
      maxTokens: 4096,
      maxIterations: 20,
    },
    providers.fallback,
    providers.premium
  );

  // Show provider info
  const providerInfo = orchestrator.getProviderInfo();
  console.log('Active providers:');
  console.log(`  Primary: ${providerInfo.primary}`);
  console.log(`  Fallback: ${providerInfo.fallback || 'none'}`);
  console.log(`  Premium: ${providerInfo.premium || 'none'}\n`);

  // Example 1: Simple query (will use free GLM-4-Flash)
  console.log('--- Example 1: Simple Query ---');
  const result1 = await orchestrator.execute(
    'Calculate the area of a circle with radius 5 and explain the formula'
  );

  console.log('\nResult:');
  console.log(result1);

  // Show token usage
  const usage1 = orchestrator.getTokenUsage();
  console.log(`\nTokens: ${usage1.total} (${usage1.input} input + ${usage1.output} output)`);
  console.log(`Estimated cost: $0.00 (FREE!)\n`);

  // Example 2: Complex query (may spawn multiple workers)
  console.log('\n--- Example 2: Complex Research Query ---');
  orchestrator.clearHistory(); // Clear for fresh start

  const result2 = await orchestrator.execute(
    `Research the concept of "agentic AI systems" by investigating:
    1. What makes an AI system "agentic"?
    2. Key architectural patterns used in production
    3. Common challenges and solutions

    Provide a comprehensive summary.`
  );

  console.log('\nResult:');
  console.log(result2);

  // Show token usage
  const usage2 = orchestrator.getTokenUsage();
  console.log(`\nTokens: ${usage2.total} (${usage2.input} input + ${usage2.output} output)`);

  // Calculate estimated cost (GLM Flash is free, fallback to Gemini Flash-Lite if needed)
  const estimatedCost =
    (usage2.input / 1_000_000) * 0.0 + // GLM Flash input (free)
    (usage2.output / 1_000_000) * 0.0; // GLM Flash output (free)

  console.log(`Estimated cost: $${estimatedCost.toFixed(4)} (assuming GLM Flash)\n`);

  // Show worker details
  const workers = orchestrator.getWorkers();
  console.log(`Workers spawned: ${workers.size}`);
  workers.forEach((worker, id) => {
    const task = worker.getCurrentTask();
    const workerUsage = worker.getTokenUsage();
    console.log(`\n  Worker: ${id}`);
    console.log(`    Task: ${task?.objective.substring(0, 60)}...`);
    console.log(`    Tokens: ${workerUsage.total}`);
  });
}

main().catch(console.error);
