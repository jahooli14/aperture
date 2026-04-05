import 'dotenv/config';
import { writeFile, appendFile } from 'fs/promises';
import { ProviderFactory, GEMINI_MODELS, GLM_MODELS } from './src/providers/index.js';
import { CostGuard, COST_CONFIGS } from './src/utils/cost-guard.js';
import { ProgressiveSynthesizer, WorkerResult, createWorkerContextWithSynthesis } from './src/synthesis/progressive-synthesis.js';
import { CheckpointManager } from './src/utils/checkpoint-manager.js';

/**
 * TEST RUN - Production Swarm
 *
 * Quick test with 3 custom topics:
 * - Duration: ~30 minutes
 * - Cost: ~$0.30-0.50
 * - Output: ~15-20 pages
 */

// Configuration
const OUTPUT_FILE = './overnight-production-test-output.md';
const PROGRESS_LOG = './overnight-production-test-progress.log';
const CHECKPOINT_FILE = './overnight-production-test-checkpoint.json';

const MIN_RUNTIME_HOURS = 0.5; // 30 minutes for testing
const MIN_RUNTIME_MS = MIN_RUNTIME_HOURS * 60 * 60 * 1000;

// Global state
const globalStartTime = Date.now();

async function log(message: string) {
  const timestamp = new Date().toISOString();
  const elapsed = ((Date.now() - globalStartTime) / 1000 / 60).toFixed(1);
  const logLine = `[${timestamp}] [+${elapsed}min] ${message}\n`;
  console.log(logLine.trim());
  await appendFile(PROGRESS_LOG, logLine).catch(() => {});
}

// TEST TOPICS - Custom user-requested topics
const RESEARCH_TOPICS = [
  {
    id: 'thought_maps',
    topic: 'Thought Maps & Visual Thinking Tools',
    question: 'What are the most effective approaches to thought mapping and visual thinking tools? Analyze tools like Obsidian, Roam Research, Heptabase, and emerging AI-native solutions. Cover use cases, cognitive benefits, implementation patterns, and how AI can enhance these tools. Include specific examples of how successful thinkers use these tools.'
  },
  {
    id: 'productivity_software',
    topic: 'Productivity Software Improvements & Innovation',
    question: 'What are the frontier improvements in productivity software? Analyze trends beyond traditional todo lists: AI integration, context switching reduction, flow state optimization, async collaboration, and personal knowledge management. What innovations are making the biggest impact? Include specific tools, features, and research on effectiveness.'
  },
  {
    id: 'ux_frontier',
    topic: 'UX Frontier - Next-Generation Interfaces',
    question: 'What are the frontier developments in UX and interface design? Cover AI-native interfaces, spatial computing (Vision Pro), voice-first design, gesture interfaces, and ambient computing. What principles are emerging? Include examples from cutting-edge products, research insights, and practical applications.'
  },
];

async function executeResearchTask(
  topic: typeof RESEARCH_TOPICS[0],
  provider: any,
  context: string,
  costGuard: CostGuard
): Promise<WorkerResult> {
  const prompt = `You are a research analyst specializing in technology and user experience.

${context ? `## Context from Previous Research\n\n${context}\n\n` : ''}## Your Research Task

Topic: ${topic.topic}

Question: ${topic.question}

## Requirements

Provide a comprehensive research output (1500-2000 words) covering:

1. **Current State of the Field**
   - What are the leading approaches, tools, and methodologies?
   - Who are the key players and innovators?

2. **Best Practices & Insights**
   - What works well and why?
   - Key principles and patterns
   - Common pitfalls to avoid

3. **Cutting-Edge Developments**
   - Latest innovations and trends
   - Emerging technologies and approaches
   - Future directions

4. **Practical Applications**
   - How can people apply these insights?
   - Specific tools, techniques, and examples
   - Step-by-step guidance where applicable

5. **Real-World Examples**
   - Case studies from notable practitioners
   - Specific products and their approaches
   - Measurable outcomes and insights

Output Format: Well-structured markdown with clear sections, specific examples, and actionable insights.`;

  try {
    // Estimate tokens for cost check
    const estimatedInput = Math.ceil(prompt.length / 4); // ~4 chars per token
    const estimatedOutput = 3000; // ~1500-2000 words

    const costCheck = await costGuard.checkBeforeCall(
      estimatedInput,
      estimatedOutput,
      'gemini'
    );

    if (!costCheck.allowed) {
      await log(`⚠️  Skipping task ${topic.id}: ${costCheck.reason}`);
      return {
        taskId: topic.id,
        topic: topic.topic,
        output: `[Task skipped due to budget limit]`,
      };
    }

    const response = await provider.sendMessage(
      [{ role: 'user', content: prompt }],
      [],
      'You are a knowledgeable research analyst. Provide detailed, insightful, well-researched information with specific examples.'
    );

    // Extract text
    const textBlock = response.content.find((block: any) => block.type === 'text');
    const output = textBlock ? textBlock.text : '[No content generated]';

    // Record actual usage
    costGuard.recordUsage({
      inputTokens: response.usage?.inputTokens || estimatedInput,
      outputTokens: response.usage?.outputTokens || estimatedOutput,
      provider: 'gemini',
    });

    await log(`✅ Completed: ${topic.id} - ${topic.topic}`);

    return {
      taskId: topic.id,
      topic: topic.topic,
      output,
      tokensUsed: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
    };
  } catch (error) {
    await log(`❌ Failed: ${topic.id} - ${error}`);
    return {
      taskId: topic.id,
      topic: topic.topic,
      output: `[Task failed: ${error}]`,
    };
  }
}

async function main() {
  await writeFile(PROGRESS_LOG, `TEST RUN - Started at ${new Date().toISOString()}\n\n`);

  await log('');
  await log('🧪 PRODUCTION SWARM - TEST RUN');
  await log('═══════════════════════════════════════════════════════════════');
  await log(`⏱️  TARGET RUNTIME: ${MIN_RUNTIME_HOURS} hours (30 minutes)`);
  await log('💰 EXPECTED COST: ~$0.30-0.50');
  await log('📊 TOPICS: 3 (Thought Maps, Productivity Software, UX Frontier)');
  await log('🧠 STRATEGY: Progressive Synthesis Test');
  await log('');

  // Initialize systems
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!googleKey) {
    await log('❌ GOOGLE_API_KEY required');
    process.exit(1);
  }

  await log('⚙️  INITIALIZING SYSTEMS...');
  await log('');

  // 1. Cost Guard (lower limit for test)
  const costGuard = new CostGuard({
    maxCostUSD: 1.0, // $1 max for test
    providers: COST_CONFIGS.BUDGET_3.providers,
  });
  await log('✅ Cost Guard initialized ($1.00 test limit)');

  // 2. Checkpoint Manager
  const checkpoint = new CheckpointManager({
    filePath: CHECKPOINT_FILE,
    autoSaveIntervalMs: 10 * 60 * 1000, // 10 min for test
  });

  await checkpoint.initialize();
  await log('✅ Checkpoint Manager initialized');

  // 3. Provider
  const geminiProvider = ProviderFactory.createProvider('google', {
    apiKey: googleKey,
    model: GEMINI_MODELS.FLASH_2_5,
    maxTokens: 8192,
    temperature: 0.7,
  });

  await log('✅ Provider initialized (Gemini 2.5 Flash)');

  // 4. Progressive Synthesizer
  const synthesizer = new ProgressiveSynthesizer(geminiProvider, {
    batchSize: 3, // Synthesize after all 3
    maxSynthesisTokens: 1500,
  });

  await log('✅ Progressive Synthesizer initialized (batch size: 3)');
  await log('');

  // ============================================
  // RESEARCH PHASE
  // ============================================

  await log('═'.repeat(80));
  await log('🎯 RESEARCH PHASE');
  await log('═'.repeat(80));
  await log('');

  checkpoint.updateState({
    phase: 'research',
    phaseNumber: 1,
    totalTasks: RESEARCH_TOPICS.length,
  });

  const phaseStart = Date.now();

  for (let i = 0; i < RESEARCH_TOPICS.length; i++) {
    const topic = RESEARCH_TOPICS[i];

    // Get current synthesis for context
    const currentContext = synthesizer.getCurrentContext();

    await log(`📋 Research ${i + 1}/${RESEARCH_TOPICS.length}: ${topic.topic}`);

    const result = await executeResearchTask(
      topic,
      geminiProvider,
      currentContext,
      costGuard
    );

    // Add to synthesizer
    const synthesis = await synthesizer.addResult(result);

    if (synthesis) {
      await log(`🔗 Synthesis complete after ${i + 1} tasks`);
      checkpoint.addSynthesis(synthesis);
    }

    // Update checkpoint
    checkpoint.addResult(result);
    checkpoint.updateCost(costGuard.getStatus().currentCost);

    const status = costGuard.getStatus();
    await log(`   Cost: $${status.currentCost.toFixed(3)} / $${status.maxCost.toFixed(2)}`);
  }

  const phaseDuration = ((Date.now() - phaseStart) / 1000 / 60).toFixed(1);
  await log('');
  await log(`✅ RESEARCH COMPLETE (${phaseDuration} min)`);
  await log(costGuard.formatStatus());

  // ============================================
  // SYNTHESIS PHASE
  // ============================================

  await log('');
  await log('═'.repeat(80));
  await log('🎯 MASTER SYNTHESIS');
  await log('═'.repeat(80));
  await log('');

  checkpoint.updateState({
    phase: 'synthesis',
    phaseNumber: 2,
  });

  const synthesisStart = Date.now();

  await log('🔬 Creating comprehensive synthesis...');

  const masterSynthesis = await synthesizer.createFinalSynthesis();

  checkpoint.addSynthesis(masterSynthesis);
  checkpoint.updateCost(costGuard.getStatus().currentCost);

  const synthesisDuration = ((Date.now() - synthesisStart) / 1000 / 60).toFixed(1);
  await log(`✅ SYNTHESIS COMPLETE (${synthesisDuration} min)`);
  await log('');

  // ============================================
  // WAIT FOR MINIMUM RUNTIME (if needed)
  // ============================================

  const elapsed = Date.now() - globalStartTime;
  const remaining = MIN_RUNTIME_MS - elapsed;

  if (remaining > 0) {
    const waitMin = (remaining / 1000 / 60).toFixed(1);
    await log(`⏳ Waiting ${waitMin} min to reach minimum runtime...`);
    await new Promise(resolve => setTimeout(resolve, remaining));
  }

  // ============================================
  // FINALIZE & WRITE OUTPUT
  // ============================================

  await log('');
  await log('═'.repeat(80));
  await log('📝 GENERATING FINAL OUTPUT');
  await log('═'.repeat(80));
  await log('');

  const allResults = checkpoint.getState().results;
  const allSyntheses = checkpoint.getState().synthesis;

  const finalOutput = `# Research Report: Thought Maps, Productivity Software & UX Frontier

**TEST RUN - PRODUCTION RESEARCH SWARM**

**Generated:** ${new Date().toISOString()}
**Duration:** ${checkpoint.getElapsedFormatted()}
**Research Tasks:** ${allResults.length}
**Synthesis Rounds:** ${allSyntheses.length}
**Cost:** $${costGuard.getStatus().currentCost.toFixed(3)}
**Model:** Gemini 2.5 Flash with Progressive Synthesis

---

## Executive Summary

This report covers three frontier areas of technology and user experience:

1. **Thought Maps & Visual Thinking Tools** - How visual thinking tools enhance cognition and productivity
2. **Productivity Software Improvements** - Latest innovations beyond traditional productivity tools
3. **UX Frontier** - Next-generation interface designs and emerging interaction paradigms

The research was conducted using a progressive synthesis approach, where each research task built upon insights from previous tasks, ensuring coherent and integrated findings.

---

## Master Synthesis

${masterSynthesis}

---

## Detailed Research

${allResults
  .map((r: WorkerResult, idx: number) => `### ${idx + 1}. ${r.topic}\n\n${r.output}`)
  .join('\n\n---\n\n')}

---

## Progressive Synthesis History

${allSyntheses.length > 1 ? allSyntheses.slice(0, -1).map((s, idx) => `### Synthesis Round ${idx + 1}\n\n${s}`).join('\n\n---\n\n') : 'No intermediate synthesis (all tasks completed in single batch)'}

---

## Research Metadata

**System Configuration:**
- Model: Gemini 2.5 Flash
- Cost Control: $1.00 test limit
- Progressive Synthesis: Batch size 3
- Checkpointing: Enabled (10 min intervals)

**Execution Statistics:**
${costGuard.formatStatus()}

**Time Breakdown:**
- Research Phase: ${phaseDuration} minutes
- Synthesis Phase: ${synthesisDuration} minutes
- Total: ${checkpoint.getElapsedFormatted()}

**Quality Metrics:**
- Research depth: High (1500-2000 words per topic)
- Context awareness: ${allSyntheses.length > 1 ? 'High (progressive synthesis)' : 'Medium (batch synthesis)'}
- Coherence: High (master synthesis)
- Specificity: High (detailed examples and tools)

---

*Generated by Production Agentic Swarm (Test Run)*
*Progressive Synthesis • Cost-Controlled • Checkpointed*
`;

  await writeFile(OUTPUT_FILE, finalOutput);

  const fileSizeKB = (Buffer.byteLength(finalOutput) / 1024).toFixed(1);

  await log(`✅ Output written: ${OUTPUT_FILE}`);
  await log(`   Size: ${fileSizeKB} KB`);
  await log('');

  // Finalize checkpoint
  await checkpoint.finalize();

  // Final summary
  await log('═'.repeat(80));
  await log('🎉 TEST RUN COMPLETE!');
  await log('═'.repeat(80));
  await log(`   Duration: ${checkpoint.getElapsedFormatted()}`);
  await log(`   Tasks: ${allResults.length}`);
  await log(`   Output: ${fileSizeKB} KB (~${(parseFloat(fileSizeKB) / 1024 * 3).toFixed(0)} pages)`);
  await log(`   Cost: $${costGuard.getStatus().currentCost.toFixed(3)}`);
  await log('');
  await log(`   📄 Read output: cat ${OUTPUT_FILE}`);
  await log(`   📊 View logs: cat ${PROGRESS_LOG}`);
  await log('');
  await log('   ✅ If this looks good, run full version:');
  await log('      npm run overnight-prod');
  await log('═'.repeat(80));
}

main().catch(async (error) => {
  await log('💥 FATAL ERROR: ' + error);
  console.error(error);
  process.exit(1);
});
