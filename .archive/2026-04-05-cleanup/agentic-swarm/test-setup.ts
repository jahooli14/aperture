import 'dotenv/config';
import { ProviderFactory, RECOMMENDED_CONFIGS } from './src/providers/index.js';
import { OrchestratorAgent } from './src/agents/orchestrator.js';
import { calculatorTool } from './src/tools/index.js';

/**
 * Quick test to verify multi-provider setup works
 */
async function main() {
  console.log('🧪 Testing Multi-Provider Setup\n');

  // Check environment variables
  const zhipuKey = process.env.ZHIPU_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!zhipuKey || !googleKey) {
    console.error('❌ Error: API keys not found in environment');
    console.error('   Make sure .env file exists with ZHIPU_API_KEY and GOOGLE_API_KEY');
    process.exit(1);
  }

  console.log('✅ API keys loaded from .env');
  console.log(`   GLM Key: ${zhipuKey.substring(0, 20)}...`);
  console.log(`   Gemini Key: ${googleKey.substring(0, 20)}...\n`);

  // Create multi-provider configuration
  console.log('🔧 Setting up ULTRA_LOW_COST configuration...');
  console.log('   Primary: GLM-4-Flash (FREE)');
  console.log('   Fallback: Gemini Flash-Lite ($0.10/1M input)\n');

  const config = RECOMMENDED_CONFIGS.ULTRA_LOW_COST({
    zhipu: zhipuKey,
    google: googleKey,
  });

  const providers = ProviderFactory.createMultiProvider(config);

  // Create orchestrator
  const orchestrator = new OrchestratorAgent(
    providers.primary,
    [calculatorTool], // Just calculator for quick test
    {
      maxTokens: 1024,
      maxIterations: 5,
    },
    providers.fallback
  );

  // Show provider info
  const providerInfo = orchestrator.getProviderInfo();
  console.log('📋 Active Providers:');
  console.log(`   Primary: ${providerInfo.primary}`);
  console.log(`   Fallback: ${providerInfo.fallback}\n`);

  // Test with simple query
  console.log('🚀 Running test query...\n');
  console.log('Query: "Calculate 15 * 23 and explain the result"\n');

  try {
    const result = await orchestrator.execute(
      'Calculate 15 * 23 and explain the result'
    );

    console.log('✅ Success! Result:\n');
    console.log(result);
    console.log('\n---\n');

    // Show token usage
    const usage = orchestrator.getTokenUsage();
    console.log('📊 Token Usage:');
    console.log(`   Input: ${usage.input}`);
    console.log(`   Output: ${usage.output}`);
    console.log(`   Total: ${usage.total}`);
    console.log(`   Cost: $0.00 (FREE with GLM Flash!) 💰\n`);

    console.log('✨ Setup complete! Your multi-provider swarm is ready.\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run dev examples/glm-only.ts');
    console.log('  2. Run: npm run dev examples/multi-provider.ts');
    console.log('  3. Build your own agents with custom tools!\n');

  } catch (error) {
    console.error('❌ Error during test:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify API keys are valid');
    console.error('  2. Check network connectivity');
    console.error('  3. Try running: npm install');
    console.error('  4. See MULTI_PROVIDER.md for help\n');
    process.exit(1);
  }
}

main().catch(console.error);
