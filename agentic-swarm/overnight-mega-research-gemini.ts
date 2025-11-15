import 'dotenv/config';
import { writeFile, appendFile } from 'fs/promises';
import { OrchestratorAgent } from './src/agents/orchestrator.js';
import { defaultTools } from './src/tools/index.js';
import { ProviderFactory, GEMINI_MODELS, GLM_MODELS } from './src/providers/index.js';

/**
 * OVERNIGHT MEGA RESEARCH - GEMINI VERSION
 * Uses Gemini for orchestrator (better instruction following)
 * Uses GLM for workers (free execution)
 */

const OUTPUT_FILE = './overnight-research-output.md';
const PROGRESS_LOG = './overnight-progress.log';

async function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  await appendFile(PROGRESS_LOG, logLine).catch(() => {});
}

async function main() {
  await log('🚀 OVERNIGHT MEGA RESEARCH - GEMINI VERSION');
  await log('═══════════════════════════════════════════════════════════════');

  await writeFile(PROGRESS_LOG, `OVERNIGHT MEGA RESEARCH (Gemini Orchestrator) - Started at ${new Date().toISOString()}\n\n`);

  const zhipuKey = process.env.ZHIPU_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!googleKey) {
    await log('❌ GOOGLE_API_KEY not found');
    process.exit(1);
  }

  await log('✅ API keys loaded');
  await log('📋 Task: Complete Production-Ready AI Agent Platform Guide');
  await log('⏱️  Expected duration: 1-3 hours');
  await log('💰 Cost: ~$0.10-0.50 (Gemini orchestrator, GLM workers)');
  await log('');

  // Use Gemini for orchestrator (better at following complex instructions)
  const orchestratorProvider = ProviderFactory.createProvider('google', {
    apiKey: googleKey,
    model: GEMINI_MODELS.FLASH_2_5, // Better than Flash-Lite for complex reasoning
    maxTokens: 16384,
    temperature: 0.7,
  });

  // GLM fallback for cost savings
  const fallbackProvider = zhipuKey ? ProviderFactory.createProvider('zhipu', {
    apiKey: zhipuKey,
    model: GLM_MODELS.FLASH,
    maxTokens: 16384,
    temperature: 0.7,
  }) : undefined;

  await log('🔧 Provider Configuration:');
  await log('   Orchestrator: Gemini 2.5 Flash ($0.30 in / $2.50 out per 1M)');
  await log('   Workers: Use GLM Flash (FREE) via delegation');
  await log('   Max Iterations: 50');
  await log('');

  const orchestrator = new OrchestratorAgent(
    orchestratorProvider,
    defaultTools,
    {
      maxTokens: 16384,
      maxIterations: 50,
      temperature: 0.7,
    },
    fallbackProvider
  );

  // Enhanced query with VERY explicit delegation instructions
  const query = `You are the ORCHESTRATOR of a multi-agent research team. Your role is to DELEGATE, not to do the work yourself.

CRITICAL: You MUST use the "delegate_task" tool to spawn AT LEAST 10 specialized worker agents. DO NOT try to research everything yourself.

Your task is to create a comprehensive guide (100+ pages) for building a production-ready AI agent platform.

REQUIRED WORKER DELEGATIONS (you MUST delegate ALL of these):

1. delegate_task: "technical_architecture" - Research infrastructure, scaling, databases, caching
2. delegate_task: "security_compliance" - Research auth, encryption, GDPR, SOC2, HIPAA
3. delegate_task: "cost_modeling" - Research detailed costs across providers at different scales
4. delegate_task: "technology_stack" - Evaluate frameworks, databases, queues, orchestration
5. delegate_task: "deployment_strategies" - Research CI/CD, blue-green, canary, IaC
6. delegate_task: "monitoring_observability" - Research logging, tracing, alerting, SLOs
7. delegate_task: "api_design" - Research REST, GraphQL, WebSocket, versioning
8. delegate_task: "multi_tenancy" - Research isolation, quotas, billing, segregation
9. delegate_task: "performance_optimization" - Research caching, query optimization, rate limiting
10. delegate_task: "integration_patterns" - Research webhooks, MCP, OAuth, SSO
11. delegate_task: "testing_strategy" - Research unit, integration, e2e, load testing
12. delegate_task: "business_model" - Research pricing, CAC, LTV, monetization
13. delegate_task: "go_to_market" - Research positioning, competition, marketing
14. delegate_task: "legal_compliance" - Research ToS, privacy, IP, agreements
15. delegate_task: "operations_playbook" - Research incidents, on-call, postmortems, SLAs

For EACH delegation:
- Use task_id that matches the section name
- Provide DETAILED objective (what to research)
- Specify output_format: "Comprehensive markdown section with examples, code snippets, tables, and specific recommendations"
- Give tool_guidance: "Use web_search to find current best practices, read_file to examine examples, calculator for cost analysis"

After delegating ALL 15 tasks, SYNTHESIZE the results into a comprehensive markdown document with:
- Executive summary
- Detailed sections from each worker
- Architecture diagrams (ASCII art)
- Cost tables
- Decision matrices
- Code examples
- Timeline and milestones

DO NOT SKIP DELEGATION. USE THE delegate_task TOOL 15 TIMES.`;

  await log('📤 Deploying query to Gemini orchestrator...');
  await log('🤖 Gemini will delegate to 15+ workers...');
  await log('⏳ This will take 1-3 hours\n');
  await log('─'.repeat(80));

  const startTime = Date.now();

  try {
    const result = await orchestrator.execute(query);
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    await log('─'.repeat(80));
    await log('');
    await log('✅ RESEARCH COMPLETED!');
    await log(`⏱️  Total time: ${duration} minutes`);

    const usage = orchestrator.getTokenUsage();
    const workers = orchestrator.getWorkers();

    // Calculate cost (Gemini pricing)
    const cost = (usage.input / 1_000_000) * 0.30 + (usage.output / 1_000_000) * 2.50;

    await log(`🧵 Workers spawned: ${workers.size}`);
    await log(`🔢 Total tokens: ${usage.total.toLocaleString()}`);
    await log(`💰 Total cost: $${cost.toFixed(4)}`);
    await log('');

    await log('📝 Writing comprehensive report...');

    const outputContent = `# Complete Production-Ready AI Agent Platform Guide

**Generated by Agentic Swarm (Gemini Orchestrator)**
**Date:** ${new Date().toISOString()}
**Duration:** ${duration} minutes
**Workers:** ${workers.size}
**Tokens:** ${usage.total.toLocaleString()}
**Cost:** $${cost.toFixed(4)}

---

${result}

---

## Research Metadata

**Execution Details:**
- Orchestrator: Gemini 2.5 Flash
- Workers: ${workers.size} spawned
- Duration: ${duration} minutes
- Total Tokens: ${usage.total.toLocaleString()}
- Cost: $${cost.toFixed(4)}

**Worker Breakdown:**
${Array.from(workers.entries()).map(([id, worker], idx) => {
  const task = worker.getCurrentTask();
  const workerUsage = worker.getTokenUsage();
  return `
### Worker ${idx + 1}: ${id}
- Task: ${task?.objective || 'Unknown'}
- Tokens: ${workerUsage.total.toLocaleString()}
`;
}).join('\n')}

---

*Orchestrated by Gemini 2.5 Flash*
*Workers executed on GLM-4-Flash (FREE) where possible*
`;

    await writeFile(OUTPUT_FILE, outputContent);

    await log('✅ Report saved!');
    await log(`📊 File size: ${(Buffer.byteLength(outputContent) / 1024).toFixed(1)} KB`);
    await log('');
    await log('═══════════════════════════════════════════════════════════════');
    await log('🎉 RESEARCH COMPLETE!');
    await log('   cat overnight-research-output.md');
    await log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    await log('❌ ERROR: ' + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

main().catch(async (error) => {
  await log('💥 FATAL: ' + error);
  process.exit(1);
});
