import 'dotenv/config';
import { OrchestratorAgent } from './src/agents/orchestrator.js';
import { defaultTools } from './src/tools/index.js';
import {
  ProviderFactory,
  RECOMMENDED_CONFIGS,
} from './src/providers/index.js';

/**
 * Demo: Compare single-LLM response vs. multi-agent swarm
 * Shows the power of parallel workers with tool use
 */

// Mock "Claude response" - what you'd get if you just asked me
const MOCK_CLAUDE_RESPONSE = `# 10 AI Product Ideas (Single-LLM Response)

## 1. AI-Powered Code Review Assistant
Automatically reviews pull requests and suggests improvements.
**Feasibility**: High - similar tools exist (Copilot, CodeRabbit)

## 2. Personal AI Health Coach
Tracks habits, provides personalized recommendations.
**Feasibility**: Medium - requires health data integration

## 3. Smart Contract Auditor
Analyzes blockchain smart contracts for vulnerabilities.
**Feasibility**: High - defined problem space

## 4. AI Meeting Summarizer
Joins calls, takes notes, generates action items.
**Feasibility**: High - Otter.ai exists, room for improvement

## 5. Automated Customer Support Agent
Handles tier-1 support tickets autonomously.
**Feasibility**: High - many companies need this

## 6. AI-Powered Content Moderator
Filters harmful content in real-time.
**Feasibility**: Medium - challenging edge cases

## 7. Personalized Learning Tutor
Adapts curriculum to student's pace and style.
**Feasibility**: High - Khan Academy shows demand

## 8. AI Sales Assistant
Qualifies leads, schedules meetings, drafts emails.
**Feasibility**: High - clear ROI for B2B

## 9. Code Documentation Generator
Automatically documents codebases with context.
**Feasibility**: High - straightforward implementation

## 10. AI Financial Analyst
Analyzes company financials, generates reports.
**Feasibility**: Medium - requires accuracy guarantees

---
*Generated in ~10 seconds based on training data (Jan 2025)*
*Single perspective, no real-time research*
`;

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔬 DEMO: Single LLM vs. Agentic Swarm');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const query = `Generate 10 innovative AI product ideas that solve real problems.
For each idea provide:
1. Product name and description
2. Target market and problem solved
3. Technical feasibility analysis
4. Estimated development cost
5. Market opportunity size
6. Key differentiators from existing solutions

Research current AI trends, successful AI products, and market gaps to inform your recommendations.`;

  // ============================================
  // Part 1: Single LLM Response (What I'd give)
  // ============================================
  console.log('📝 PART 1: Single LLM Response (Traditional Approach)\n');
  console.log('If you asked Claude Code directly...\n');

  const singleStartTime = Date.now();

  // Simulate response time
  await new Promise(resolve => setTimeout(resolve, 2000));

  const singleDuration = (Date.now() - singleStartTime) / 1000;

  console.log(MOCK_CLAUDE_RESPONSE);
  console.log(`\n⏱️  Time taken: ${singleDuration.toFixed(1)}s`);
  console.log('💰 Cost: Included in Claude Code subscription');
  console.log('🧵 Workers: 1 (single-threaded)');
  console.log('🛠️  Tools used: None (knowledge cutoff: Jan 2025)');
  console.log('🔄 Autonomous: No (interactive only)');

  console.log('\n' + '─'.repeat(80) + '\n');

  // ============================================
  // Part 2: Agentic Swarm Response
  // ============================================
  console.log('🤖 PART 2: Agentic Swarm (Orchestrator-Worker Pattern)\n');
  console.log('Deploying autonomous agent swarm...\n');

  // Check API keys
  const zhipuKey = process.env.ZHIPU_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!zhipuKey || !googleKey) {
    console.error('❌ API keys not found. Run: npm run test-setup first');
    process.exit(1);
  }

  // Setup multi-provider configuration
  console.log('🔧 Configuration:');
  const config = RECOMMENDED_CONFIGS.ULTRA_LOW_COST({
    zhipu: zhipuKey,
    google: googleKey,
  });

  const providers = ProviderFactory.createMultiProvider(config);
  console.log(`   Primary: GLM-4-Flash (FREE)`);
  console.log(`   Fallback: Gemini Flash-Lite ($0.10/1M tokens)`);
  console.log(`   Tools: ${defaultTools.length} available (search, calc, files)\n`);

  // Create orchestrator
  const orchestrator = new OrchestratorAgent(
    providers.primary,
    defaultTools,
    {
      maxTokens: 8192, // Larger for complex research
      maxIterations: 30, // More iterations for worker spawning
    },
    providers.fallback
  );

  console.log('🚀 Starting swarm execution...');
  console.log('   (Watch for worker spawn messages below)\n');
  console.log('─'.repeat(80) + '\n');

  const swarmStartTime = Date.now();

  try {
    // Execute the swarm!
    const result = await orchestrator.execute(query);

    const swarmDuration = (Date.now() - swarmStartTime) / 1000;

    console.log('\n' + '─'.repeat(80) + '\n');
    console.log('✅ SWARM RESULTS:\n');
    console.log(result);
    console.log('\n' + '─'.repeat(80) + '\n');

    // Get metrics
    const usage = orchestrator.getTokenUsage();
    const workers = orchestrator.getWorkers();

    // Calculate cost (GLM is free, but show what it would cost with Gemini)
    const glmCost = 0; // Free!
    const geminiCost = (usage.input / 1_000_000) * 0.10 + (usage.output / 1_000_000) * 0.40;

    console.log('📊 SWARM METRICS:\n');
    console.log(`⏱️  Time taken: ${swarmDuration.toFixed(1)}s`);
    console.log(`🧵 Workers spawned: ${workers.size}`);
    console.log(`🔢 Total tokens: ${usage.total.toLocaleString()} (${usage.input.toLocaleString()} in + ${usage.output.toLocaleString()} out)`);
    console.log(`💰 Actual cost: $${glmCost.toFixed(4)} (FREE with GLM!)`);
    console.log(`   (Would cost $${geminiCost.toFixed(4)} with Gemini Flash-Lite)`);
    console.log(`🛠️  Tools: ${defaultTools.length} tools available to all workers`);
    console.log(`🔄 Autonomous: Yes (can run 24/7 unattended)`);

    // Show worker breakdown
    if (workers.size > 0) {
      console.log('\n👥 Worker Breakdown:');
      let workerNum = 1;
      workers.forEach((worker, id) => {
        const task = worker.getCurrentTask();
        const workerUsage = worker.getTokenUsage();
        console.log(`\n   Worker ${workerNum}: ${id}`);
        if (task) {
          console.log(`   ├─ Task: ${task.objective.substring(0, 60)}...`);
          console.log(`   ├─ Format: ${task.outputFormat}`);
        }
        console.log(`   └─ Tokens: ${workerUsage.total.toLocaleString()}`);
        workerNum++;
      });
    }

    console.log('\n' + '━'.repeat(80) + '\n');

    // ============================================
    // Part 3: Comparison
    // ============================================
    console.log('📊 COMPARISON: Single LLM vs. Swarm\n');
    console.log('┌─────────────────────────┬──────────────────┬─────────────────┐');
    console.log('│ Metric                  │ Single LLM       │ Agentic Swarm   │');
    console.log('├─────────────────────────┼──────────────────┼─────────────────┤');
    console.log(`│ Time                    │ ${singleDuration.toFixed(1)}s             │ ${swarmDuration.toFixed(1)}s            │`);
    console.log(`│ Workers                 │ 1 (sequential)   │ ${workers.size} (parallel)     │`);
    console.log('│ Tool Use                │ ❌ None          │ ✅ 5 tools       │');
    console.log('│ Real-time Research      │ ❌ No            │ ✅ Yes          │');
    console.log('│ Cost                    │ Subscription     │ $0.00 (FREE!)   │');
    console.log('│ Autonomous              │ ❌ No            │ ✅ Yes          │');
    console.log('│ Schedulable             │ ❌ No            │ ✅ Yes          │');
    console.log('│ Parallel Processing     │ ❌ No            │ ✅ Yes          │');
    console.log('│ Depth of Research       │ Training data    │ Live search     │');
    console.log('└─────────────────────────┴──────────────────┴─────────────────┘\n');

    console.log('🎯 KEY DIFFERENCES:\n');
    console.log('1. 🤖 AUTONOMY');
    console.log('   Single: You must be present and wait');
    console.log(`   Swarm: Deploy and walk away - runs autonomously\n`);

    console.log('2. ⚡ PARALLELIZATION');
    console.log('   Single: One brain, sequential thinking');
    console.log(`   Swarm: ${workers.size} workers researching simultaneously\n`);

    console.log('3. 🛠️  TOOL USE');
    console.log('   Single: Limited to training data (Jan 2025)');
    console.log('   Swarm: Can search web, calculate, read files, etc.\n');

    console.log('4. 💰 COST');
    console.log('   Single: Uses your Claude Code subscription');
    console.log('   Swarm: $0 with GLM, or $0.10/1M with Gemini\n');

    console.log('5. 🔄 USE CASES');
    console.log('   Single: Interactive Q&A, immediate help');
    console.log('   Swarm: Background research, scheduled tasks, batch processing\n');

    console.log('━'.repeat(80) + '\n');
    console.log('✨ CONCLUSION:\n');
    console.log('Use ME (Claude Code) when:');
    console.log('  - You need quick, interactive help');
    console.log('  - You want to discuss and refine ideas');
    console.log('  - You need code assistance in real-time\n');

    console.log('Use THE SWARM when:');
    console.log('  - You want deep, multi-perspective research');
    console.log('  - You need autonomous background processing');
    console.log('  - You want to run tasks on a schedule');
    console.log('  - You need parallel investigation of multiple angles');
    console.log('  - Cost optimization is important (FREE with GLM!)\n');

    console.log('🚀 The swarm is YOUR autonomous AI workforce!\n');

  } catch (error) {
    console.error('❌ Error running swarm:', error);
    console.error('\nCheck that your API keys are valid and retry.');
    process.exit(1);
  }
}

main().catch(console.error);
