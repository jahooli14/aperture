import 'dotenv/config';
import { ProviderFactory, GEMINI_MODELS } from './src/providers/index.js';
import { CostGuard, COST_CONFIGS } from './src/utils/cost-guard.js';
import { BuilderOrchestrator } from './src/builders/builder-orchestrator.js';
import type { BuildRequest } from './src/builders/builder-types.js';

/**
 * BUILDER SWARM TEST
 *
 * Demonstrates the evolution from research to building:
 * - Takes a build request
 * - Creates a plan
 * - Generates working code
 * - Writes files to disk
 *
 * Test: Build a CLI weather tool
 */

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       BUILDER SWARM - From Research to Reality            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize systems
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!googleKey) {
    console.error('❌ GOOGLE_API_KEY required');
    process.exit(1);
  }

  console.log('⚙️  Initializing Builder Systems...\n');

  // 1. Cost Guard
  const costGuard = new CostGuard({
    maxCostUSD: 1.0,
    providers: COST_CONFIGS.BUDGET_3.providers,
  });
  console.log('   ✅ Cost Guard ($1.00 limit)');

  // 2. Provider
  const geminiProvider = ProviderFactory.createProvider('google', {
    apiKey: googleKey,
    model: GEMINI_MODELS.FLASH_2_5,
    maxTokens: 8192,
    temperature: 0.7,
  });
  console.log('   ✅ Gemini 2.5 Flash Provider');

  // 3. Builder Orchestrator
  const orchestrator = new BuilderOrchestrator(
    geminiProvider,
    costGuard,
    './builder-output'
  );
  console.log('   ✅ Builder Orchestrator\n');

  // Define build request
  const buildRequest: BuildRequest = {
    type: 'cli',
    description: 'Weather CLI Tool - fetch current weather for any city',
    language: 'typescript',
    requirements: [
      'Fetch weather data from OpenWeatherMap API',
      'Display temperature, conditions, humidity, wind speed',
      'Support multiple cities as command-line arguments',
      'Use colored output for better readability',
      'Handle errors gracefully (invalid city, API errors)',
      'Include --help flag with usage instructions',
    ],
    features: [
      'TypeScript with proper types',
      'Commander.js for CLI parsing',
      'Axios for HTTP requests',
      'Chalk for colored output',
      'Dotenv for API key management',
    ],
  };

  console.log('📝 Build Request:');
  console.log(`   Type: ${buildRequest.type}`);
  console.log(`   Description: ${buildRequest.description}`);
  console.log(`   Language: ${buildRequest.language}`);
  console.log(`   Requirements: ${buildRequest.requirements.length}`);
  console.log(`   Features: ${buildRequest.features?.length || 0}\n`);

  // Execute build
  try {
    const results = await orchestrator.buildProject(buildRequest);

    console.log('\n✨ BUILD COMPLETE!\n');
    console.log('Next steps:');
    console.log('   1. cd builder-output/weather-cli-tool-fetch-current-weather-for-any-city');
    console.log('   2. npm install');
    console.log('   3. Add OPENWEATHER_API_KEY to .env');
    console.log('   4. npm start -- London\n');

    console.log('💰 Final Cost:', `$${costGuard.getStatus().currentCost.toFixed(3)}`);
    console.log('');

  } catch (error) {
    console.error('\n💥 BUILD FAILED:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 FATAL ERROR:', error);
  process.exit(1);
});
