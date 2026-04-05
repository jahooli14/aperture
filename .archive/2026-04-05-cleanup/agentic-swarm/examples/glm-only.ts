import 'dotenv/config';
import { OrchestratorAgent } from '../src/agents/orchestrator.js';
import { defaultTools } from '../src/tools/index.js';
import { ProviderFactory, GLM_MODELS } from '../src/providers/index.js';

/**
 * GLM-only example: Using Zhipu AI's GLM models (free!)
 */
async function main() {
  const zhipuApiKey = process.env.ZHIPU_API_KEY;

  if (!zhipuApiKey) {
    console.error('Error: ZHIPU_API_KEY environment variable not set');
    console.error('\nGet your API key from: https://open.bigmodel.cn/');
    process.exit(1);
  }

  console.log('=== GLM-Only Agentic Swarm (FREE!) ===\n');

  // Create GLM-4-Flash provider (completely free!)
  const provider = ProviderFactory.createProvider('zhipu', {
    apiKey: zhipuApiKey,
    model: GLM_MODELS.FLASH,
    maxTokens: 4096,
    temperature: 1.0,
  });

  // Optional: Create GLM-4.5-Air as fallback (still very cheap)
  const fallbackProvider = ProviderFactory.createProvider('zhipu', {
    apiKey: zhipuApiKey,
    model: GLM_MODELS.AIR,
    maxTokens: 4096,
    temperature: 1.0,
  });

  const orchestrator = new OrchestratorAgent(
    provider,
    defaultTools,
    { maxTokens: 4096, maxIterations: 20 },
    fallbackProvider
  );

  console.log('Configuration:');
  console.log('  Primary: GLM-4-Flash (FREE!)');
  console.log('  Fallback: GLM-4.5-Air ($0.20 input, $1.10 output)\n');

  // Run a complex research task
  const result = await orchestrator.execute(
    `Analyze the benefits and drawbacks of using AI agents for:
    1. Customer support automation
    2. Software development assistance
    3. Data analysis and research

    Provide specific examples for each category.`
  );

  console.log('Result:');
  console.log(result);

  // Show usage statistics
  const usage = orchestrator.getTokenUsage();
  const workers = orchestrator.getWorkers();

  console.log(`\nExecution Statistics:`);
  console.log(`  Total tokens: ${usage.total} (${usage.input} input + ${usage.output} output)`);
  console.log(`  Workers spawned: ${workers.size}`);
  console.log(`  Estimated cost: $0.00 (FREE with GLM-4-Flash!)`);

  console.log('\n💡 Tip: GLM-4-Flash is completely free, making it perfect for:');
  console.log('  - Prototyping and testing');
  console.log('  - High-volume applications');
  console.log('  - Learning and experimentation');
  console.log('  - Cost-conscious production use');
}

main().catch(console.error);
