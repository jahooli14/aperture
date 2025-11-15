import 'dotenv/config';
import { ProviderFactory, GEMINI_MODELS } from './src/providers/index.js';
import { CostGuard, COST_CONFIGS } from './src/utils/cost-guard.js';
import { BuilderOrchestrator } from './src/builders/builder-orchestrator.js';
import type { BuildRequest } from './src/builders/builder-types.js';

/**
 * BUILD: Daily Insurance Digest Tool
 *
 * For: Your wife
 * Purpose: Daily digest of specialty insurance news (UK + global)
 * Features: Automated news aggregation, filtering, and delivery
 */

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     BUILDING: Daily Insurance Industry Digest Tool        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize systems
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!googleKey) {
    console.error('❌ GOOGLE_API_KEY required');
    process.exit(1);
  }

  console.log('⚙️  Initializing Builder Systems...\n');

  // Cost Guard - allow up to $1 for this build
  const costGuard = new CostGuard({
    maxCostUSD: 1.0,
    providers: COST_CONFIGS.BUDGET_3.providers,
  });
  console.log('   ✅ Cost Guard ($1.00 limit)');

  // Gemini Provider
  const geminiProvider = ProviderFactory.createProvider('google', {
    apiKey: googleKey,
    model: GEMINI_MODELS.FLASH_2_5,
    maxTokens: 8192,
    temperature: 0.7,
  });
  console.log('   ✅ Gemini 2.5 Flash Provider');

  // Builder Orchestrator
  const orchestrator = new BuilderOrchestrator(
    geminiProvider,
    costGuard,
    './builder-output'
  );
  console.log('   ✅ Builder Orchestrator\n');

  // Define the build request
  const buildRequest: BuildRequest = {
    type: 'cli',
    description: 'Daily Insurance Industry Digest - Specialty Insurance News Aggregator',
    language: 'typescript',
    requirements: [
      'Fetch insurance industry news from multiple sources',
      'Focus on specialty insurance (marine, aviation, cyber, professional indemnity, etc.)',
      'Include UK market news with global coverage of interesting developments',
      'Filter and rank articles by relevance to specialty insurance',
      'Generate daily digest in readable format (markdown)',
      'Support multiple output formats: email, file, console',
      'Include article summaries, links, and key takeaways',
      'Configurable sources and topics via config file',
      'Cache results to avoid duplicate articles',
      'Run as daily cron job or on-demand',
    ],
    features: [
      'News API integration (NewsAPI, Google News RSS)',
      'Web scraping for specialty insurance publications (Insurance Times, Commercial Risk, etc.)',
      'Keyword filtering for specialty insurance topics',
      'Relevance scoring using AI (Gemini API)',
      'Email delivery using Nodemailer',
      'Markdown and HTML output formats',
      'Configuration via YAML file',
      'Date-based caching (SQLite)',
      'Command-line interface with Commander.js',
      'Colored console output with Chalk',
      'Rate limiting and error handling',
      'Comprehensive logging',
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
    console.log('🏗️  Starting build process...\n');
    const results = await orchestrator.buildProject(buildRequest);

    console.log('\n✨ BUILD COMPLETE!\n');
    console.log('═'.repeat(60));
    console.log('📦 Your Daily Insurance Digest Tool is Ready!\n');

    console.log('📁 Location: builder-output/daily-insurance-industry-digest-specialty-insurance-news-aggregator/\n');

    console.log('🚀 Next Steps:\n');
    console.log('   1. Navigate to the project:');
    console.log('      cd builder-output/daily-insurance-industry-digest-*\n');

    console.log('   2. Install dependencies:');
    console.log('      npm install\n');

    console.log('   3. Configure API keys (.env file):');
    console.log('      NEWS_API_KEY=your_newsapi_key');
    console.log('      GOOGLE_API_KEY=your_gemini_key');
    console.log('      EMAIL_HOST=smtp.gmail.com');
    console.log('      EMAIL_USER=your_email@gmail.com');
    console.log('      EMAIL_PASS=your_app_password\n');

    console.log('   4. Run the digest:');
    console.log('      npm start\n');

    console.log('   5. Set up daily automation (cron):');
    console.log('      crontab -e');
    console.log('      Add: 0 8 * * * cd /path/to/project && npm start\n');

    console.log('═'.repeat(60));
    console.log(`💰 Build Cost: $${costGuard.getStatus().currentCost.toFixed(3)}`);
    console.log('═'.repeat(60));
    console.log('');

  } catch (error) {
    console.error('\n💥 BUILD FAILED:', error);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('💥 FATAL ERROR:', error);
  process.exit(1);
});
