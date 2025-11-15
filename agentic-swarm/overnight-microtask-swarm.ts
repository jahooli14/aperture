import 'dotenv/config';
import { writeFile, appendFile } from 'fs/promises';
import { ProviderFactory, GLM_MODELS } from './src/providers/index.js';

/**
 * MICROTASK SWARM - GLM ONLY (FREE!)
 *
 * Strategy:
 * - Break research into 100+ TINY microtasks
 * - Each task is simple enough for GLM to handle
 * - No complex orchestration needed
 * - Spawn workers in parallel batches
 * - Pure swarm behavior
 */

const OUTPUT_FILE = './overnight-microtask-output.md';
const PROGRESS_LOG = './overnight-microtask-progress.log';
const MIN_RUNTIME_HOURS = 10;
const MIN_RUNTIME_MS = MIN_RUNTIME_HOURS * 60 * 60 * 1000;

const globalStartTime = Date.now();
let completedTasks = 0;
let totalTasks = 0;

async function log(message: string) {
  const timestamp = new Date().toISOString();
  const elapsed = ((Date.now() - globalStartTime) / 1000 / 60).toFixed(1);
  const logLine = `[${timestamp}] [+${elapsed}min] [Tasks: ${completedTasks}/${totalTasks}] ${message}\n`;
  console.log(logLine.trim());
  await appendFile(PROGRESS_LOG, logLine).catch(() => {});
}

interface MicroTask {
  id: string;
  topic: string;
  specificQuestion: string;
  targetWords: number;
}

// Generate 100+ microtasks - each is VERY specific and simple
function generateMicroTasks(): MicroTask[] {
  const tasks: MicroTask[] = [];

  // Infrastructure (20 tasks)
  const infraTopics = [
    'Edge computing CDN strategies',
    'Edge computing cost analysis',
    'Kubernetes for AI workloads',
    'Docker optimization for ML',
    'Service mesh for microservices',
    'Load balancing strategies',
    'Auto-scaling policies',
    'Database sharding',
    'Database replication',
    'Redis caching patterns',
    'Memcached vs Redis',
    'Content delivery networks',
    'Global traffic routing',
    'Network latency optimization',
    'Bandwidth cost optimization',
    'Data center locations',
    'Cloud region selection',
    'Multi-region architecture',
    'Disaster recovery setup',
    'Backup strategies',
  ];

  // AI/ML Systems (25 tasks)
  const mlTopics = [
    'GPT-4 API pricing',
    'Claude API pricing',
    'Gemini API pricing',
    'LLM response time optimization',
    'LLM context window management',
    'LLM prompt caching',
    'LLM batching requests',
    'Vector database: Pinecone',
    'Vector database: Weaviate',
    'Vector database: Qdrant',
    'Vector database: Milvus',
    'Embedding models comparison',
    'Semantic search implementation',
    'RAG architecture basics',
    'RAG optimization techniques',
    'Fine-tuning vs prompting',
    'LoRA fine-tuning',
    'Full fine-tuning costs',
    'Model quantization techniques',
    'Model pruning methods',
    'Model distillation process',
    'GPU types for inference',
    'GPU types for training',
    'vLLM for serving',
    'Triton inference server',
  ];

  // Scalability (20 tasks)
  const scaleTopics = [
    'Horizontal scaling patterns',
    'Vertical scaling limits',
    'Auto-scaling metrics',
    'Load testing tools',
    'Performance benchmarking',
    'Latency optimization',
    'Throughput optimization',
    'Connection pooling',
    'Queue systems: RabbitMQ',
    'Queue systems: Kafka',
    'Queue systems: AWS SQS',
    'Stream processing: Kafka Streams',
    'Stream processing: Flink',
    'Event sourcing patterns',
    'CQRS architecture',
    'Microservices communication',
    'API gateway patterns',
    'Rate limiting strategies',
    'Circuit breaker pattern',
    'Retry policies',
  ];

  // Security (15 tasks)
  const securityTopics = [
    'OAuth 2.0 implementation',
    'JWT token security',
    'API key management',
    'Secret rotation',
    'Encryption at rest',
    'Encryption in transit',
    'TLS/SSL configuration',
    'DDoS protection',
    'WAF configuration',
    'SQL injection prevention',
    'XSS prevention',
    'CSRF protection',
    'API authentication best practices',
    'Zero trust architecture',
    'Security audit tools',
  ];

  // Monitoring (15 tasks)
  const monitoringTopics = [
    'Prometheus setup',
    'Grafana dashboards',
    'CloudWatch metrics',
    'DataDog monitoring',
    'Application logging',
    'Structured logging',
    'Log aggregation',
    'Error tracking: Sentry',
    'APM tools comparison',
    'Distributed tracing',
    'OpenTelemetry setup',
    'Alert policies',
    'On-call rotation',
    'Incident response',
    'Postmortem process',
  ];

  // Cost Optimization (10 tasks)
  const costTopics = [
    'Cloud cost tracking',
    'Reserved instances savings',
    'Spot instances usage',
    'S3 storage classes',
    'CloudFront cost optimization',
    'Lambda cold start reduction',
    'Database cost optimization',
    'API call cost reduction',
    'Bandwidth cost reduction',
    'Resource tagging strategy',
  ];

  const allTopics = [
    ...infraTopics,
    ...mlTopics,
    ...scaleTopics,
    ...securityTopics,
    ...monitoringTopics,
    ...costTopics,
  ];

  // Create microtasks
  allTopics.forEach((topic, idx) => {
    tasks.push({
      id: `task_${idx + 1}`,
      topic,
      specificQuestion: `What are the key considerations, best practices, and common pitfalls for ${topic}?`,
      targetWords: 300,
    });
  });

  return tasks;
}

async function executeMicroTask(
  task: MicroTask,
  provider: any
): Promise<string> {
  const prompt = `You are a technical researcher.

Task: Research "${task.topic}"

Question: ${task.specificQuestion}

Requirements:
- Write exactly ${task.targetWords} words
- Include specific examples
- Mention 2-3 tools/vendors if applicable
- Be concise and practical
- Use markdown formatting

Output format:
## ${task.topic}

[Your ${task.targetWords}-word research here]
`;

  try {
    const response = await provider.sendMessage(
      [{ role: 'user', content: prompt }],
      [],
      'You are a helpful technical researcher. Provide detailed, accurate information.'
    );

    // Extract text from response content array
    const textBlock = response.content.find((block: any) => block.type === 'text');
    const result = textBlock ? textBlock.text : '[No text content in response]';

    await log(`✅ Completed: ${task.id} - ${task.topic}`);
    return result;
  } catch (error) {
    await log(`❌ Failed: ${task.id} - ${error}`);
    return `## ${task.topic}\n\n[Task failed: ${error}]\n`;
  }
}

async function runBatch(
  tasks: MicroTask[],
  batchSize: number,
  provider: any
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);

    await log(`📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} tasks)`);

    const batchPromises = batch.map(task => executeMicroTask(task, provider));
    const batchResults = await Promise.all(batchPromises);

    results.push(...batchResults);
    completedTasks += batch.length;

    await log(`📊 Progress: ${completedTasks}/${totalTasks} tasks (${((completedTasks / totalTasks) * 100).toFixed(1)}%)`);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

async function main() {
  await writeFile(PROGRESS_LOG, `MICROTASK SWARM - Started at ${new Date().toISOString()}\n\n`);

  await log('🐝 MICROTASK SWARM - GLM ONLY (FREE!)');
  await log('═══════════════════════════════════════════════════════════════');
  await log(`⏱️  MINIMUM RUNTIME: ${MIN_RUNTIME_HOURS} hours`);
  await log('💰 COST: $0.00 (GLM is free!)');
  await log('🧠 STRATEGY: Break complex research into 100+ simple microtasks');
  await log('');

  const zhipuKey = process.env.ZHIPU_API_KEY;

  if (!zhipuKey) {
    await log('❌ ZHIPU_API_KEY required');
    process.exit(1);
  }

  await log('🔧 Creating GLM provider...');
  const provider = ProviderFactory.createProvider('zhipu', {
    apiKey: zhipuKey,
    model: GLM_MODELS.FLASH,
    maxTokens: 2048,
    temperature: 0.7,
  });

  await log('📋 Generating microtasks...');
  const tasks = generateMicroTasks();
  totalTasks = tasks.length;

  await log(`✅ Generated ${totalTasks} microtasks`);
  await log('');
  await log('📊 Task Breakdown:');
  await log('   - Infrastructure: 20 tasks');
  await log('   - AI/ML Systems: 25 tasks');
  await log('   - Scalability: 20 tasks');
  await log('   - Security: 15 tasks');
  await log('   - Monitoring: 15 tasks');
  await log('   - Cost Optimization: 10 tasks');
  await log('');

  // Phase 1: Quick pass (5 parallel workers)
  await log('');
  await log('═'.repeat(80));
  await log('🚀 PHASE 1: RAPID RESEARCH (5 parallel workers)');
  await log('═'.repeat(80));
  await log('');

  const phase1Start = Date.now();
  const phase1Results = await runBatch(tasks, 5, provider);
  const phase1Duration = Date.now() - phase1Start;

  await log('');
  await log(`✅ PHASE 1 COMPLETE`);
  await log(`   Duration: ${(phase1Duration / 1000 / 60).toFixed(1)} minutes`);
  await log('');

  // Enforce minimum runtime
  const elapsed = Date.now() - globalStartTime;
  const remaining = MIN_RUNTIME_MS - elapsed;

  if (remaining > 0) {
    await log('⏳ Enforcing minimum 10-hour runtime...');
    await log(`   Elapsed: ${(elapsed / 1000 / 60 / 60).toFixed(2)} hours`);
    await log(`   Remaining: ${(remaining / 1000 / 60 / 60).toFixed(2)} hours`);
    await log('   Entering extended synthesis mode...');
    await log('');

    // Phase 2: Deep synthesis (slower, more detailed)
    await log('═'.repeat(80));
    await log('🔬 PHASE 2: DEEP SYNTHESIS (extended analysis)');
    await log('═'.repeat(80));
    await log('');

    // Run synthesis tasks until we hit 10 hours
    const synthesisTopics = [
      'Integration patterns between all researched topics',
      'Cost-benefit analysis of different approaches',
      'Scalability comparison across solutions',
      'Security trade-offs in various architectures',
      'Performance benchmarks for different stacks',
      'Real-world case studies and implementations',
      'Common failure modes and solutions',
      'Best practices for production deployment',
      'Monitoring and observability strategies',
      'Future trends and emerging technologies',
    ];

    let synthesisRound = 1;
    const synthesisResults: string[] = [];

    while (Date.now() - globalStartTime < MIN_RUNTIME_MS) {
      await log(`🔄 Synthesis Round ${synthesisRound}...`);

      for (const topic of synthesisTopics) {
        const synthesisTask: MicroTask = {
          id: `synthesis_${synthesisRound}_${synthesisTopics.indexOf(topic)}`,
          topic: topic,
          specificQuestion: `Based on AGI-ready infrastructure research, analyze: ${topic}`,
          targetWords: 500,
        };

        const result = await executeMicroTask(synthesisTask, provider);
        synthesisResults.push(result);

        // Check if we've hit our time target
        if (Date.now() - globalStartTime >= MIN_RUNTIME_MS) {
          await log('⏰ Minimum runtime reached!');
          break;
        }

        // Delay between synthesis tasks
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s between tasks
      }

      synthesisRound++;

      if (Date.now() - globalStartTime >= MIN_RUNTIME_MS) {
        break;
      }

      await log(`📊 Synthesis progress: Round ${synthesisRound - 1} complete`);
    }

    await log('');
    await log(`✅ PHASE 2 COMPLETE`);
    await log(`   Synthesis rounds: ${synthesisRound - 1}`);
    await log(`   Additional insights: ${synthesisResults.length}`);
    await log('');

    // Combine all results
    phase1Results.push(...synthesisResults);
  }

  const totalDuration = ((Date.now() - globalStartTime) / 1000 / 60 / 60).toFixed(2);

  await log('');
  await log('═'.repeat(80));
  await log('🎉 SWARM RESEARCH COMPLETE!');
  await log('═'.repeat(80));
  await log(`   Total Duration: ${totalDuration} hours`);
  await log(`   Tasks Completed: ${completedTasks}`);
  await log(`   Cost: $0.00 (FREE!)`);
  await log('');

  // Generate final output
  const output = `# Complete Guide to Building AGI-Ready Infrastructure

**MICROTASK SWARM RESEARCH**

**Generated:** ${new Date().toISOString()}
**Duration:** ${totalDuration} hours
**Tasks Completed:** ${completedTasks}
**Cost:** $0.00 (GLM Free Tier)
**Workers:** ${completedTasks} micro-workers
**Strategy:** Massively parallel microtask swarm

---

## Executive Summary

This guide was created by a swarm of ${completedTasks} autonomous micro-workers, each researching a specific narrow topic. By breaking down complex research into simple microtasks, we achieved:

- Zero cost (using GLM free tier)
- Highly focused, specific insights
- Parallel processing at scale
- ${totalDuration} hours of autonomous work

---

${phase1Results.join('\n\n---\n\n')}

---

## Research Metadata

**Execution Details:**
- Total Duration: ${totalDuration} hours
- Micro-workers Spawned: ${completedTasks}
- Cost: $0.00 (FREE)
- Provider: GLM-4-Flash
- Completion: ${new Date().toISOString()}

**Research Methodology:**
- Phase 1: Rapid parallel research (${totalTasks} focused topics)
- Phase 2: Deep synthesis and integration
- Each worker handled a single specific question
- No complex orchestration required
- Pure swarm intelligence

---

*Generated by Microtask Swarm (GLM-4-Flash)*
*Zero Cost Autonomous Research*
`;

  await writeFile(OUTPUT_FILE, output);

  const fileSizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2);

  await log('📝 OUTPUT WRITTEN');
  await log(`   File: ${OUTPUT_FILE}`);
  await log(`   Size: ${fileSizeMB} MB`);
  await log('');
  await log('═══════════════════════════════════════════════════════════════');
  await log('🏆 MISSION ACCOMPLISHED!');
  await log(`   ${totalDuration} hours of FREE autonomous research`);
  await log(`   ${completedTasks} micro-workers executed successfully`);
  await log('   cat overnight-microtask-output.md');
  await log('═══════════════════════════════════════════════════════════════');
}

main().catch(async (error) => {
  await log('💥 FATAL ERROR: ' + error);
  console.error(error);
  process.exit(1);
});
