import 'dotenv/config';
import { OrchestratorAgent } from '../src/agents/orchestrator.js';
import { defaultTools } from '../src/tools/index.js';
import { ProviderFactory, GEMINI_MODELS } from '../src/providers/index.js';

/**
 * Gemini-only example: Using Google's Gemini models
 */
async function main() {
  const googleApiKey = process.env.GOOGLE_API_KEY;

  if (!googleApiKey) {
    console.error('Error: GOOGLE_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('=== Gemini-Only Agentic Swarm ===\n');

  // Create Gemini Flash-Lite as primary (ultra low cost)
  const primaryProvider = ProviderFactory.createProvider('google', {
    apiKey: googleApiKey,
    model: GEMINI_MODELS.FLASH_LITE,
    maxTokens: 4096,
    temperature: 1.0,
  });

  // Create Gemini Flash 2.5 as fallback (better quality)
  const fallbackProvider = ProviderFactory.createProvider('google', {
    apiKey: googleApiKey,
    model: GEMINI_MODELS.FLASH_2_5,
    maxTokens: 4096,
    temperature: 1.0,
  });

  const orchestrator = new OrchestratorAgent(
    primaryProvider,
    defaultTools,
    { maxTokens: 4096, maxIterations: 20 },
    fallbackProvider
  );

  console.log('Configuration:');
  console.log('  Primary: Gemini 2.5 Flash-Lite ($0.10 input, $0.40 output)');
  console.log('  Fallback: Gemini 2.5 Flash ($0.30 input, $2.50 output)\n');

  // Run query
  const result = await orchestrator.execute(
    'Explain how multi-agent AI systems work and provide 3 real-world use cases'
  );

  console.log('Result:');
  console.log(result);

  // Show cost breakdown
  const usage = orchestrator.getTokenUsage();
  const cost =
    (usage.input / 1_000_000) * 0.10 + // Flash-Lite input
    (usage.output / 1_000_000) * 0.40; // Flash-Lite output

  console.log(`\nTokens: ${usage.total} (${usage.input} input + ${usage.output} output)`);
  console.log(`Estimated cost: $${cost.toFixed(4)}`);
}

main().catch(console.error);
