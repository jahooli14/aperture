import 'dotenv/config';
import { ProviderFactory, GEMINI_MODELS } from './src/providers/index.js';
import { CostGuard, COST_CONFIGS } from './src/utils/cost-guard.js';
import { BuilderOrchestrator } from './src/builders/builder-orchestrator.js';
import type { BuildRequest } from './src/builders/builder-types.js';

async function main() {
  console.log('\n🧪 TESTING FUNCTION CALLING BUILDER\n');

  const googleKey = process.env.GOOGLE_API_KEY;
  if (!googleKey) {
    console.error('❌ GOOGLE_API_KEY required');
    process.exit(1);
  }

  const costGuard = new CostGuard({
    maxCostUSD: 0.5,
    providers: COST_CONFIGS.BUDGET_3.providers,
  });

  const geminiProvider = ProviderFactory.createProvider('google', {
    apiKey: googleKey,
    model: GEMINI_MODELS.FLASH_2_5,
    maxTokens: 8192,
    temperature: 0.7,
  });

  const orchestrator = new BuilderOrchestrator(
    geminiProvider,
    costGuard,
    './builder-output'
  );

  // Simple test: Hello World CLI
  const buildRequest: BuildRequest = {
    type: 'cli',
    description: 'Simple Hello World CLI - prints greeting messages',
    language: 'typescript',
    requirements: [
      'Accept a name as command-line argument',
      'Print "Hello, [name]!" to console',
      'Use TypeScript',
      'Include package.json with proper scripts',
    ],
    features: [
      'Commander.js for CLI',
      'TypeScript with types',
      'Chalk for colors',
    ],
  };

  console.log('📝 Test Build: Simple Hello World CLI\n');

  try {
    const results = await orchestrator.buildProject(buildRequest);

    console.log('\n✅ BUILD COMPLETE!');
    console.log(`💰 Cost: $${costGuard.getStatus().currentCost.toFixed(3)}`);

    // Check if files were actually generated
    const totalFiles = results.reduce((sum, r) => sum + r.files.length, 0);
    console.log(`📦 Total files generated: ${totalFiles}`);

    if (totalFiles === 0) {
      console.error('\n❌ PROBLEM: No files were generated!');
      console.log('Function calling may not be working correctly.');
      process.exit(1);
    } else {
      console.log('\n✅ Function calling is working! Files were generated.');
    }

  } catch (error) {
    console.error('\n💥 BUILD FAILED:', error);
    process.exit(1);
  }
}

main();
