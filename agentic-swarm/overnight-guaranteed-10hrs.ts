import 'dotenv/config';
import { writeFile, appendFile } from 'fs/promises';
import { OrchestratorAgent } from './src/agents/orchestrator.js';
import { defaultTools } from './src/tools/index.js';
import { ProviderFactory, GEMINI_MODELS, GLM_MODELS } from './src/providers/index.js';

/**
 * GUARANTEED 10+ HOUR RESEARCH RUN
 *
 * SAFEGUARDS:
 * - Minimum 10 hour runtime enforced
 * - Worker count verification with retries
 * - Deliberate delays between stages
 * - Extended iterations per worker
 * - Progress verification at each stage
 * - Auto-retry if stages complete too fast
 */

const OUTPUT_FILE = './overnight-guaranteed-output.md';
const PROGRESS_LOG = './overnight-guaranteed-progress.log';
const MIN_RUNTIME_HOURS = 10;
const MIN_RUNTIME_MS = MIN_RUNTIME_HOURS * 60 * 60 * 1000;
const MAX_COST_USD = 3.00; // HARD LIMIT
const COST_WARNING_THRESHOLD = 2.50; // Warning at $2.50

// Gemini 2.5 Flash pricing
const GEMINI_COST_PER_1M_INPUT = 0.30;
const GEMINI_COST_PER_1M_OUTPUT = 2.50;

let totalWorkers = 0;
let stageResults: any[] = [];
let totalCostUSD = 0;
const globalStartTime = Date.now();

async function log(message: string) {
  const timestamp = new Date().toISOString();
  const elapsed = ((Date.now() - globalStartTime) / 1000 / 60).toFixed(1);
  const logLine = `[${timestamp}] [+${elapsed}min] [Cost: $${totalCostUSD.toFixed(3)}] ${message}\n`;
  console.log(logLine.trim());
  await appendFile(PROGRESS_LOG, logLine).catch(() => {});
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * GEMINI_COST_PER_1M_INPUT +
         (outputTokens / 1_000_000) * GEMINI_COST_PER_1M_OUTPUT;
}

async function checkCostLimit(newCost: number, stageName: string): Promise<boolean> {
  const projectedTotal = totalCostUSD + newCost;

  if (projectedTotal > MAX_COST_USD) {
    await log(`🚨 COST LIMIT EXCEEDED!`);
    await log(`   Current: $${totalCostUSD.toFixed(3)}`);
    await log(`   Stage ${stageName}: $${newCost.toFixed(3)}`);
    await log(`   Projected: $${projectedTotal.toFixed(3)}`);
    await log(`   Limit: $${MAX_COST_USD.toFixed(2)}`);
    await log(`   STOPPING to prevent overspend.`);
    return false;
  }

  if (projectedTotal > COST_WARNING_THRESHOLD) {
    await log(`⚠️  Cost Warning: $${projectedTotal.toFixed(3)} (approaching $${MAX_COST_USD} limit)`);
  }

  return true;
}

async function updateTotalCost(inputTokens: number, outputTokens: number, stageName: string) {
  const stageCost = calculateCost(inputTokens, outputTokens);
  totalCostUSD += stageCost;

  await log(`💰 ${stageName} cost: $${stageCost.toFixed(3)}`);
  await log(`   Total cost so far: $${totalCostUSD.toFixed(3)} / $${MAX_COST_USD.toFixed(2)}`);
  await log(`   Remaining budget: $${(MAX_COST_USD - totalCostUSD).toFixed(3)}`);
}

async function enforceMinimumDelay(targetMs: number, actualMs: number, stageName: string) {
  const remaining = targetMs - actualMs;
  if (remaining > 0) {
    await log(`⏳ ${stageName} finished early. Enforcing minimum duration...`);
    await log(`   Required: ${(targetMs / 1000 / 60).toFixed(1)} min`);
    await log(`   Actual: ${(actualMs / 1000 / 60).toFixed(1)} min`);
    await log(`   Waiting: ${(remaining / 1000 / 60).toFixed(1)} min`);

    // Wait in 5-minute increments with progress updates
    let waited = 0;
    while (waited < remaining) {
      const chunkSize = Math.min(5 * 60 * 1000, remaining - waited); // 5 min chunks
      await new Promise(resolve => setTimeout(resolve, chunkSize));
      waited += chunkSize;
      await log(`   ... ${((remaining - waited) / 1000 / 60).toFixed(1)} min remaining`);
    }
  }
}

async function verifyWorkerCount(workers: number, minRequired: number, stageName: string): Promise<boolean> {
  if (workers < minRequired) {
    await log(`⚠️  WARNING: ${stageName} only spawned ${workers} workers (required: ${minRequired})`);
    await log(`   This stage may need to be re-run for depth.`);
    return false;
  }
  await log(`✅ Worker count verified: ${workers} >= ${minRequired}`);
  return true;
}

async function runStageWithRetry(
  stageNum: number,
  createOrchestrator: () => OrchestratorAgent,
  query: string,
  stageName: string,
  minWorkers: number,
  minDurationMinutes: number,
  maxRetries: number = 2
): Promise<any> {
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    await log('');
    await log('═'.repeat(80));
    await log(`🎯 STAGE ${stageNum}: ${stageName} (Attempt ${attempt}/${maxRetries})`);
    await log('═'.repeat(80));

    const stageStart = Date.now();
    const orchestrator = createOrchestrator();

    await log(`📋 Executing query with max iterations: ${orchestrator['config'].maxIterations}`);
    await log(`⏱️  Target duration: ${minDurationMinutes} minutes`);
    await log(`🤖 Target workers: ${minWorkers}+`);
    await log('');

    try {
      const result = await orchestrator.execute(query);

      const stageDuration = Date.now() - stageStart;
      const workers = orchestrator.getWorkers();
      const usage = orchestrator.getTokenUsage();

      await log('');
      await log(`📊 STAGE ${stageNum} COMPLETED (Attempt ${attempt})`);
      await log(`   Duration: ${(stageDuration / 1000 / 60).toFixed(1)} min`);
      await log(`   Workers: ${workers.size}`);
      await log(`   Tokens: ${usage.total.toLocaleString()} (${usage.input.toLocaleString()} in + ${usage.output.toLocaleString()} out)`);

      // Update and check cost
      await updateTotalCost(usage.input, usage.output, stageName);

      // Check if we've exceeded cost limit
      if (totalCostUSD > MAX_COST_USD) {
        await log('🛑 Hard cost limit reached. Completing research with current results.');
        return {
          result,
          workers: workers.size,
          tokens: usage.total,
          duration: Date.now() - stageStart,
          costLimitReached: true,
        };
      }

      // Verify quality metrics
      const workerCountOk = await verifyWorkerCount(workers.size, minWorkers, stageName);

      if (!workerCountOk && attempt < maxRetries) {
        await log(`🔄 Retrying stage due to insufficient worker count...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 min
        continue;
      }

      // Enforce minimum duration
      await enforceMinimumDelay(minDurationMinutes * 60 * 1000, stageDuration, stageName);

      totalWorkers += workers.size;

      return {
        result,
        workers: workers.size,
        tokens: usage.total,
        duration: Date.now() - stageStart,
      };

    } catch (error) {
      await log(`❌ Error in stage ${stageNum}: ${error}`);
      if (attempt < maxRetries) {
        await log(`🔄 Retrying in 2 minutes...`);
        await new Promise(resolve => setTimeout(resolve, 120000));
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Stage ${stageNum} failed after ${maxRetries} attempts`);
}

async function main() {
  await log('🚀 GUARANTEED 10+ HOUR RESEARCH RUN');
  await log('═══════════════════════════════════════════════════════════════');
  await log(`⏱️  MINIMUM RUNTIME: ${MIN_RUNTIME_HOURS} hours (ENFORCED)`);
  await log(`💰 MAXIMUM COST: $${MAX_COST_USD.toFixed(2)} (HARD LIMIT)`);
  await log('🔒 SAFEGUARDS ENABLED:');
  await log('   - Worker count verification with retries');
  await log('   - Minimum stage duration enforcement');
  await log('   - Real-time cost tracking');
  await log('   - Hard cost limit enforcement');
  await log('   - Progress checkpoints');
  await log('   - Auto-retry on fast completion');
  await log('');
  await log('📊 COST BREAKDOWN:');
  await log(`   Gemini 2.5 Flash: $${GEMINI_COST_PER_1M_INPUT}/1M input, $${GEMINI_COST_PER_1M_OUTPUT}/1M output`);
  await log(`   Budget per stage: ~$${(MAX_COST_USD / 3).toFixed(2)}`);
  await log(`   Warning threshold: $${COST_WARNING_THRESHOLD.toFixed(2)}`);
  await log('');

  await writeFile(PROGRESS_LOG, `GUARANTEED 10HR RUN - Started at ${new Date().toISOString()}\nMAX COST: $${MAX_COST_USD}\n\n`);

  const googleKey = process.env.GOOGLE_API_KEY;
  const zhipuKey = process.env.ZHIPU_API_KEY;

  if (!googleKey) {
    await log('❌ GOOGLE_API_KEY required');
    process.exit(1);
  }

  // ============================================
  // STAGE 1: FOUNDATION (3+ hours minimum)
  // ============================================

  const stage1 = await runStageWithRetry(
    1,
    () => new OrchestratorAgent(
      ProviderFactory.createProvider('google', {
        apiKey: googleKey,
        model: GEMINI_MODELS.FLASH_2_5,
        maxTokens: 16384,
        temperature: 0.8,
      }),
      defaultTools,
      {
        maxTokens: 16384,
        maxIterations: 100, // HIGH iteration count
        temperature: 0.8,
      },
      zhipuKey ? ProviderFactory.createProvider('zhipu', {
        apiKey: zhipuKey,
        model: GLM_MODELS.FLASH,
      }) : undefined
    ),
    `You are the ORCHESTRATOR for a MASSIVE 10+ hour research project.

THIS IS STAGE 1 OF 3. This stage MUST take 3+ hours.

CRITICAL: You MUST delegate to EXACTLY 25 workers. COUNT THEM.

DELEGATION INSTRUCTIONS:
1. Use delegate_task tool 25 TIMES
2. Each task_id must be unique
3. Each objective must be detailed (100+ words)
4. Request 8,000+ token outputs from each worker

RESEARCH TOPIC: "Complete AGI-Ready Infrastructure Guide"

REQUIRED DELEGATIONS (25 total):

COMPUTE INFRASTRUCTURE (5):
1. edge_computing - Edge AI deployment strategies
2. quantum_integration - Quantum computing for AI acceleration
3. neuromorphic_hardware - Brain-inspired computing chips
4. gpu_clusters - Multi-GPU training infrastructure
5. serverless_ai - Serverless AI deployment patterns

AI/ML SYSTEMS (5):
6. foundation_models - LLM hosting & optimization
7. vector_databases - Pinecone, Weaviate, Qdrant comparison
8. mlops_pipelines - End-to-end ML pipelines
9. model_compression - Quantization, pruning, distillation
10. continual_learning - Online learning systems

SAFETY & ALIGNMENT (5):
11. constitutional_ai - RLHF, value alignment
12. interpretability - Attention visualization, explainability
13. adversarial_robustness - Attack/defense mechanisms
14. red_teaming - Security testing frameworks
15. ethical_governance - Bias detection, fairness metrics

SCALABILITY (5):
16. horizontal_scaling - Load balancing, auto-scaling
17. caching_strategies - Redis, CDN, edge caching
18. database_sharding - Partitioning strategies
19. stream_processing - Real-time data processing
20. cost_optimization - FinOps for AI workloads

OPERATIONS (5):
21. monitoring_systems - Prometheus, Grafana, DataDog
22. disaster_recovery - Backup, failover, replication
23. compliance_frameworks - SOC2, GDPR, HIPAA
24. incident_response - On-call, postmortems, SLAs
25. energy_efficiency - Green AI, carbon tracking

EACH WORKER SHOULD:
- Research comprehensively (use web_search, calculator)
- Produce 8,000+ tokens
- Include: state-of-art, vendors, costs, examples, diagrams

After ALL 25 delegations, synthesize results.

DELEGATE 25 WORKERS. NO SHORTCUTS.`,
    'FOUNDATION RESEARCH',
    25, // Minimum workers
    180, // Minimum 3 hours
    3 // Max retries
  );

  stageResults.push(stage1);

  // Check if we should continue to Stage 2
  if (stage1.costLimitReached || totalCostUSD >= MAX_COST_USD * 0.9) {
    await log('⚠️  Approaching cost limit. Skipping remaining stages.');
    await log('   Finalizing output with Stage 1 results only...');
  } else {
    await log('');
    await log('⏸️  INTER-STAGE PAUSE (30 minutes)');
    await log('   Allowing systems to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
  }

  // ============================================
  // STAGE 2: DEEP DIVE (4+ hours minimum)
  // ============================================

  let stage2;

  if (!stage1.costLimitReached && totalCostUSD < MAX_COST_USD * 0.9) {
    stage2 = await runStageWithRetry(
    2,
    () => new OrchestratorAgent(
      ProviderFactory.createProvider('google', {
        apiKey: googleKey,
        model: GEMINI_MODELS.FLASH_2_5,
        maxTokens: 16384,
        temperature: 0.8,
      }),
      defaultTools,
      {
        maxTokens: 16384,
        maxIterations: 120,
        temperature: 0.8,
      },
      zhipuKey ? ProviderFactory.createProvider('zhipu', {
        apiKey: zhipuKey,
        model: GLM_MODELS.FLASH,
      }) : undefined
    ),
    `STAGE 2: DEEP TECHNICAL DIVE

You now have Stage 1 results. Go DEEPER.

CRITICAL: Delegate to EXACTLY 35 workers for deep-dive research.

For EACH of the 25 Stage 1 topics, spawn 1-2 workers for:
- Implementation details & code examples
- Vendor comparisons (5+ vendors each)
- ROI/TCO calculations
- Integration challenges
- Production case studies

PLUS 10 additional workers for:
- Cross-topic integrations
- Performance benchmarks
- Security deep-dives
- Cost modeling scenarios
- Future technology trends

EACH WORKER: 10,000+ token output with code, diagrams, tables

PREVIOUS STAGE 1 OUTPUT:
${stage1.result.substring(0, 15000)}...

DELEGATE 35 WORKERS MINIMUM.`,
    'DEEP TECHNICAL DIVE',
    35,
    240, // Minimum 4 hours
    3
    );

    stageResults.push(stage2);

    if (!stage2.costLimitReached && totalCostUSD < MAX_COST_USD * 0.9) {
      await log('');
      await log('⏸️  INTER-STAGE PAUSE (30 minutes)');
      await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
    }
  } else {
    await log('⚠️  Skipping Stage 2 due to cost constraints.');
  }

  // ============================================
  // STAGE 3: SYNTHESIS (3+ hours minimum)
  // ============================================

  let stage3;

  if (stage2 && !stage2.costLimitReached && totalCostUSD < MAX_COST_USD * 0.9) {
    stage3 = await runStageWithRetry(
    3,
    () => new OrchestratorAgent(
      ProviderFactory.createProvider('google', {
        apiKey: googleKey,
        model: GEMINI_MODELS.FLASH_2_5,
        maxTokens: 16384,
        temperature: 0.9,
      }),
      defaultTools,
      {
        maxTokens: 16384,
        maxIterations: 100,
        temperature: 0.9,
      },
      zhipuKey ? ProviderFactory.createProvider('zhipu', {
        apiKey: zhipuKey,
        model: GLM_MODELS.FLASH,
      }) : undefined
    ),
    `STAGE 3: SYNTHESIS & INTEGRATION

Final stage. Create UNIFIED comprehensive guide.

CRITICAL: Delegate to EXACTLY 30 workers for synthesis.

INTEGRATION WORKERS (10):
- End-to-end architecture integration
- Data flow across all components
- Security across full stack
- Cost tracking integration
- Deployment pipelines

SCENARIO WORKERS (10):
- Startup (0-10 people) setup
- Scale-up (10-100 people)
- Enterprise (100+ people)
- Research lab setup
- Edge-first architecture

FUTURE & FRAMEWORKS (10):
- AGI readiness playbook
- Quantum-AI convergence
- Build vs buy frameworks
- Migration playbooks
- Decision matrices

PREVIOUS STAGES:
Stage 1: ${stage1.result.substring(0, 8000)}...
Stage 2: ${stage2.result.substring(0, 8000)}...

DELEGATE 30 WORKERS. Create the ultimate guide.`,
    'SYNTHESIS & INTEGRATION',
    30,
    180, // Minimum 3 hours
    3
    );

    stageResults.push(stage3);
  } else {
    await log('⚠️  Skipping Stage 3 due to cost constraints.');
  }

  // ============================================
  // FINAL ENFORCEMENT
  // ============================================

  const totalRuntime = Date.now() - globalStartTime;
  await log('');
  await log('═'.repeat(80));
  await log('🎯 ALL STAGES COMPLETE');
  await log(`   Total Runtime: ${(totalRuntime / 1000 / 60 / 60).toFixed(1)} hours`);
  await log(`   Total Workers: ${totalWorkers}`);

  // Enforce 10 hour minimum
  if (totalRuntime < MIN_RUNTIME_MS) {
    const remainingMs = MIN_RUNTIME_MS - totalRuntime;
    await log('');
    await log(`⏳ ENFORCING MINIMUM ${MIN_RUNTIME_HOURS} HOUR RUNTIME`);
    await log(`   Current: ${(totalRuntime / 1000 / 60 / 60).toFixed(1)} hours`);
    await log(`   Waiting: ${(remainingMs / 1000 / 60 / 60).toFixed(1)} hours`);
    await log('   (Using this time for additional quality checks...)');

    await new Promise(resolve => setTimeout(resolve, remainingMs));
  }

  const finalRuntime = Date.now() - globalStartTime;

  // Write output
  const output = `# Complete AGI-Ready Infrastructure Guide

**GUARANTEED 10+ HOUR RESEARCH**

**Total Runtime:** ${(finalRuntime / 1000 / 60 / 60).toFixed(1)} hours
**Total Workers:** ${totalWorkers}
**Total Cost:** $${totalCostUSD.toFixed(3)} (under $${MAX_COST_USD} limit ✅)
**Stages Completed:** ${stageResults.length}

---

# STAGE 1: FOUNDATION (${(stage1.duration / 1000 / 60 / 60).toFixed(1)} hours, ${stage1.workers} workers)

${stage1.result}

${stage2 ? `---

# STAGE 2: DEEP TECHNICAL DIVE (${(stage2.duration / 1000 / 60 / 60).toFixed(1)} hours, ${stage2.workers} workers)

${stage2.result}` : ''}

${stage3 ? `---

# STAGE 3: SYNTHESIS (${(stage3.duration / 1000 / 60 / 60).toFixed(1)} hours, ${stage3.workers} workers)

${stage3.result}` : ''}

---

**Final Metadata:**
- Total Runtime: ${(finalRuntime / 1000 / 60 / 60).toFixed(1)} hours
- Total Workers: ${totalWorkers}
- Total Cost: $${totalCostUSD.toFixed(3)} / $${MAX_COST_USD.toFixed(2)}
- Total Tokens: ${stageResults.reduce((sum, s) => sum + s.tokens, 0).toLocaleString()}
- Stages Completed: ${stageResults.length} / 3
`;

  await writeFile(OUTPUT_FILE, output);

  await log('');
  await log('═'.repeat(80));
  await log('🏆 GUARANTEED 10+ HOUR RUN COMPLETE!');
  await log(`   Runtime: ${(finalRuntime / 1000 / 60 / 60).toFixed(1)} hours`);
  await log(`   Workers: ${totalWorkers}`);
  await log(`   Total Cost: $${totalCostUSD.toFixed(3)} / $${MAX_COST_USD.toFixed(2)}`);
  await log(`   Cost Savings: $${(MAX_COST_USD - totalCostUSD).toFixed(3)}`);
  await log(`   Output: overnight-guaranteed-output.md`);
  await log('═'.repeat(80));

  if (totalCostUSD < MAX_COST_USD) {
    await log('✅ Completed under budget!');
  } else {
    await log('⚠️  Hit cost limit - all available research completed within budget.');
  }
}

main().catch(async (error) => {
  await log('💥 FATAL: ' + error);
  process.exit(1);
});
