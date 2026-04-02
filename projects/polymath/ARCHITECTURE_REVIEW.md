# Polymath Evolutionary Idea Generation System - Architecture Review

**Date**: April 2026
**Reviewer**: Claude Code
**Scope**: Comprehensive technical analysis of failure modes, missing components, and architectural gaps

---

## Executive Summary

The Polymath system is architecturally **sound but operationally fragile**. It lacks explicit failure handling, observability, and several critical data model components. The feedback loop implementation is incomplete, and the orchestration layer is under-specified. Below are categorized findings with specific technical recommendations.

---

## 1. FAILURE MODES & RESILIENCE GAPS

### 1.1 API Rate Limiting & Timeouts

**Current State:**
- Gemini embeddings have exponential backoff (§ `gemini-embeddings.ts` lines 81-83)
- Gemini Flash-Lite generation has **no retry logic**
- Vercel serverless timeout: 60s (default) — synthesis may exceed this with multiple API calls

**Failure Scenarios:**
```
Gemini Flash-Lite timeout during idea generation
  ↓
No partial ideas saved
  ↓
Synthesis run fails silently (logs only)
  ↓
Weekly cron silently fails
  ↓
Users see stale suggestions from last week
```

**Specific Risk:**
- `synthesis.ts` line 200-201: `generateSuggestionsBatch()` calls Gemini with 0 retries
- If Gemini takes >30s, Vercel kills the function
- No circuit breaker or graceful degradation

**Recommendation:**
```typescript
// Add timeout wrapper with partial completion support
async function generateWithTimeout(
  fn: () => Promise<T>,
  timeoutMs: number,
  fallbackFn: () => T
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]).catch(() => fallbackFn())
}

// In synthesis.ts: if Gemini times out, return previously suggested ideas + diversity injection
```

### 1.2 Cascading Database Failures

**Current State:**
- No transaction wrapping in synthesis pipeline
- Embeddings generated BEFORE uniqueness check (lines 236-242)
- If duplicate detection fails mid-pipeline, corrupted state

**Scenario:**
```
1. Generate 10 ideas + embeddings (expensive)
2. Start deduplication
3. Database connection drops
4. 5 ideas marked duplicates (incorrect)
5. Retry: duplicate check passes, inserts same 5 ideas again
   Result: Duplicates in DB, wasted embeddings
```

**Recommendation:**
- Wrap entire synthesis in PostgreSQL transaction
- Generate embeddings AFTER deduplication (cheaper)
- Implement idempotent inserts with `ON CONFLICT DO NOTHING`

```sql
-- In project_suggestions upsert:
INSERT INTO project_suggestions (...)
VALUES (...)
ON CONFLICT (user_id, title) DO UPDATE
SET updated_at = now()
WHERE status = 'pending'
```

### 1.3 Embedding Vector Corruption

**Current State:**
- pgvector index: `ivfflat(embedding vector_cosine_ops)` with `lists = 100` (hard-coded)
- No validation of embedding dimensions (768 assumed, not checked)
- Cosine similarity can return NaN if magnitudes = 0

**Failure Path:**
```
1. Gemini returns empty embedding: [0, 0, ..., 0]
2. cosineSimilarity() → 0/0 = NaN
3. Deduplication threshold check: NaN > 0.88 is false
4. Corrupted idea stored with null similarity score
5. Vector search returns garbage results
```

**Recommendation:**
```typescript
// In gemini-embeddings.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== 768 || b.length !== 768) {
    throw new Error(`Invalid embedding dimensions: ${a.length}, ${b.length}`)
  }

  const dotProduct = a.reduce((sum, val, i) => sum + val * arrayB[i], 0)
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

  if (magA === 0 || magB === 0) {
    console.warn('Zero-magnitude embedding detected')
    return 0 // Treat zero vectors as completely dissimilar
  }

  const similarity = dotProduct / (magA * magB)
  if (isNaN(similarity) || !isFinite(similarity)) {
    throw new Error(`Invalid similarity: ${similarity}`)
  }
  return similarity
}
```

### 1.4 Deployment Artifact Failures

**Current State:**
- Cron jobs in `api/cron/jobs.ts` (only file in dir)
- No fallback if vercel.json cron config fails
- Strengthen nodes feature is **archived** (line 96: `message: 'Feature archived'`)

**Issue:**
- If Vercel cron is disabled/broken, no synthesis happens
- User has no visibility (silent failure)
- No health check endpoint

**Recommendation:**
```typescript
// Create /api/health endpoint
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const checks = {
    supabase: await checkSupabaseConnection(),
    gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
    cron_last_run: await getLastCronTimestamp(),
    synthesis_queue: await getSynthesisPendingCount()
  }

  const allHealthy = checks.supabase === 'ok' && checks.cron_last_run < Date.now() - 7*24*60*60*1000

  res.status(allHealthy ? 200 : 503).json(checks)
}
```

---

## 2. DATA MODEL GAPS & MISSING TABLES

### 2.1 Missing: Synthesis Run History

**Current Gap:**
- No audit trail of when synthesis ran, how many ideas generated, what failed
- `project_suggestions` has `suggested_at` but no foreign key to a synthesis run
- If synthesis crashes mid-stream, no way to know what was lost

**Missing Table:**
```sql
CREATE TABLE synthesis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('in_progress', 'success', 'partial', 'failed')),

  -- Context
  mode TEXT, -- 'normal', 'wildcard', 'stretch', etc.
  capabilities_count INT,
  interests_count INT,

  -- Results
  ideas_generated INT,
  ideas_stored INT,
  ideas_deduplicated INT,
  embedding_errors INT,

  -- Debugging
  error_message TEXT,
  logs JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Foreign key constraint
ALTER TABLE project_suggestions ADD COLUMN synthesis_run_id UUID REFERENCES synthesis_runs(id);
```

**Use Case:**
- Detect synthesis failures in monitoring
- Replay failed runs with partial data
- Analyze efficiency (ideas/embedding call)

### 2.2 Missing: Rejection Feedback Tracking

**Current Gap:**
- `project_suggestions` has `status` field with ratings (-1, 1, 2)
- But **no structured feedback reasons**
- Cannot distinguish "not interested" vs "too vague" vs "not feasible"
- Feedback cannot be embedded and used to guide future prompts

**Missing Table:**
```sql
CREATE TABLE suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES project_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Structured feedback
  rating INT CHECK (rating IN (-1, 0, 1, 2)), -- -1=meh, 1=spark, 2=built
  feedback_type TEXT[], -- ['too_vague', 'not_feasible', 'uninteresting', 'already_doing', 'requires_tools']
  confidence FLOAT DEFAULT 0.5, -- User's confidence in their feedback
  free_text TEXT, -- User's written explanation

  -- Embedding for feedback analysis
  feedback_embedding VECTOR(768),

  -- Suggestions for improvement (user-provided)
  improvement_suggestions TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_suggestion ON suggestion_feedback(suggestion_id);
CREATE INDEX idx_feedback_rating ON suggestion_feedback(rating);
CREATE INDEX idx_feedback_embedding ON suggestion_feedback USING ivfflat(feedback_embedding vector_cosine_ops);
```

**Why it matters:**
- Current system: "User rejected idea" → reduce capability strengths
- Better system: "User rejected because 'too vague'" → adjust prompt to be more specific
- Last 3 weeks of feedback should feed into prompt construction (architecture specifies this but it's not implemented)

### 2.3 Missing: Domain Pair Exploration History

**Current Gap:**
- Architecture specifies "70% high-distance pairs, 20% medium, 10% single-domain"
- But there's **no table tracking which pairs have been explored**
- `capability_combinations` exists but is **not being populated or queried**

**Current Issue (synthesis.ts):**
```typescript
// Lines 157-167: generateSuggestionsBatch()
// Capabilities are just ranked by strength, then sliced(0, 15)
// No "distance" or "novelty" calculation between pairs
// The domain sampler strategy is completely absent
```

**Missing Table Update:**
```sql
-- capability_combinations needs update
ALTER TABLE capability_combinations ADD COLUMN:
  distance_score FLOAT, -- Semantic distance (1 - cosine_similarity)
  exploration_count INT DEFAULT 0, -- Times this pair has been suggested
  last_explored_at TIMESTAMPTZ,
  avg_user_reception FLOAT, -- Average rating from suggestions with this pair

  -- Track mode diversity
  explored_in_modes TEXT[] DEFAULT '{}', -- ['normal', 'wildcard', 'stretch']

  -- Freshness tracking
  days_since_explored INT GENERATED ALWAYS AS (EXTRACT(DAY FROM now() - last_explored_at)) STORED;

-- Query to enforce domain sampler distribution
CREATE VIEW domain_pair_candidates AS
WITH pairs_with_distance AS (
  SELECT
    cap1.id as cap1_id,
    cap2.id as cap2_id,
    1 - (cap1.embedding <=> cap2.embedding) as distance,
    COALESCE(cc.exploration_count, 0) as times_explored
  FROM capabilities cap1
  CROSS JOIN capabilities cap2
  WHERE cap1.id < cap2.id
  LEFT JOIN capability_combinations cc ON
    (cc.capability_ids @> ARRAY[cap1.id, cap2.id])
)
SELECT * FROM pairs_with_distance
WHERE distance > 0.3 AND times_explored < 5
ORDER BY distance DESC, times_explored ASC;
```

**Implementation:**
```typescript
// In synthesis.ts: Fix domain sampler
async function selectDomainPair(userId: string): Promise<[Capability, Capability]> {
  const rand = Math.random()
  let targetDistance: [number, number]

  if (rand < 0.7) {
    targetDistance = [0.7, 1.0] // High distance (novel)
  } else if (rand < 0.9) {
    targetDistance = [0.4, 0.7] // Medium distance (related)
  } else {
    // Single domain (find 2 capabilites from same source_project)
    const { data: singleDomain } = await supabase
      .from('capabilities')
      .select('*')
      .eq('source_project', 'polymath')
      .limit(2)
    return [singleDomain[0], singleDomain[1]]
  }

  // Find unexplored pair in distance range
  const { data: candidates } = await supabase.rpc('find_capability_pair', {
    min_distance: targetDistance[0],
    max_distance: targetDistance[1],
    user_id: userId,
    limit: 1
  })

  return [candidates[0].cap1_id, candidates[0].cap2_id]
}
```

### 2.4 Missing: Frontier Mode Tracking

**Current Gap:**
- Architecture specifies: "domain pair + **frontier mode** → structured JSON"
- Synthesis implements mode constraints (lines 286-325)
- But **no table tracks which modes have been explored**
- Can't enforce "explore 30% of ideas in frontier modes"

**Missing Table:**
```sql
CREATE TABLE frontier_mode_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  synthesis_run_id UUID REFERENCES synthesis_runs(id),
  mode TEXT NOT NULL CHECK (mode IN ('one-skill', 'quick', 'stretch', 'analog', 'opposite', 'wildcard')),

  ideas_generated INT,
  ideas_accepted_by_user INT,
  avg_novelty_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_frontier_user_mode ON frontier_mode_runs(user_id, mode);
```

**Implementation:**
```typescript
// In synthesis.ts: Track frontier mode distribution
export async function runSynthesis(userId: string, forceMode?: string) {
  // Determine mode: 70% normal, 30% frontier modes
  const mode = forceMode || (Math.random() < 0.3
    ? ['one-skill', 'quick', 'stretch', 'analog', 'opposite'][Math.floor(Math.random() * 5)]
    : null)

  // Generate with mode constraint
  const ideas = await generateSuggestionsBatch(
    capabilities,
    interests,
    CONFIG.SUGGESTIONS_PER_RUN,
    previousTitles,
    pairWeightsSection,
    mode ? modeConstraints[mode] : ''
  )

  // Track for future frontier mode distribution
  if (mode) {
    await supabase.from('frontier_mode_runs').insert({
      user_id: userId,
      synthesis_run_id: runId,
      mode,
      ideas_generated: ideas.length
    })
  }
}
```

---

## 3. KNOWLEDGE GRAPH IMPLEMENTATION GAPS

### 3.1 Current State is **Not a Graph**

**Issue:**
- Architecture calls it "knowledge graph" but it's actually disconnected tables
- `capability_combinations` is a **pair list**, not a graph
- No edge weights, traversal, or relationship inference
- Can't ask: "What's the path from REST APIs → AR visualization?"

**Current Structure:**
```
capabilities table          project_suggestions table
    ↓                              ↓
  [flat list]              [flat list with cap_ids array]
    ↓
capability_combinations table
    ↓
  [pair list, no traversal]
```

**Better Structure (Property Graph):**
```sql
CREATE TABLE knowledge_nodes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  node_type TEXT CHECK (node_type IN ('capability', 'interest', 'domain', 'project', 'concept')),
  name TEXT NOT NULL,
  description TEXT,
  embedding VECTOR(768),
  source_table TEXT, -- 'capabilities' | 'entities' | 'projects'
  source_id UUID, -- FK to source

  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, node_type, source_id)
);

CREATE TABLE knowledge_edges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  source_node_id UUID REFERENCES knowledge_nodes(id),
  target_node_id UUID REFERENCES knowledge_nodes(id),

  edge_type TEXT, -- 'combines_to', 'enables', 'conflicts_with', 'explores', 'bridges'
  weight FLOAT DEFAULT 1.0, -- Strength of relationship

  -- Directionality
  directed BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB, -- e.g., {"distance_score": 0.85, "last_explored": "2026-04-02"}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(source_node_id, target_node_id, edge_type)
);

CREATE INDEX idx_edges_source ON knowledge_edges(source_node_id);
CREATE INDEX idx_edges_target ON knowledge_edges(target_node_id);
CREATE INDEX idx_edges_weight ON knowledge_edges(weight DESC);

-- Graph traversal function
CREATE OR REPLACE FUNCTION find_paths(
  start_node_id UUID,
  max_depth INT DEFAULT 3
)
RETURNS TABLE (
  path UUID[],
  distance FLOAT,
  edge_types TEXT[]
) AS $$
WITH RECURSIVE paths AS (
  -- Base case: start node
  SELECT
    ARRAY[start_node_id] as path,
    0::FLOAT as total_weight,
    ARRAY[]::TEXT[] as types

  UNION ALL

  -- Recursive case: extend path
  SELECT
    path || ke.target_node_id,
    total_weight + (1 - ke.weight), -- Accumulate distance
    types || ARRAY[ke.edge_type]
  FROM paths
  JOIN knowledge_edges ke ON ke.source_node_id = paths.path[array_length(paths.path, 1)]
  WHERE
    array_length(paths.path, 1) < max_depth
    AND NOT ke.target_node_id = ANY(paths.path) -- Avoid cycles
)
SELECT path, total_weight as distance, types as edge_types
FROM paths
ORDER BY total_weight ASC;
$$ LANGUAGE SQL;
```

### 3.2 Missing: Graph Traversal Queries

**Use Cases Not Supported:**
1. "Find 2-hop paths between REST APIs and AR" (for bridge detection)
2. "What new capabilities would connect domain X to domain Y?" (for novelty)
3. "Recommend capabilities based on user's recent projects" (personalization)

**Queries to Implement:**

```typescript
// Find unexplored paths (for frontier mode)
async function findUnexploredPaths(userId: string): Promise<Capability[][]> {
  const { data } = await supabase.rpc('find_paths', {
    start_node_id: randomCapabilityId,
    max_depth: 3
  })

  // Filter to paths not in capability_combinations yet
  return data.filter(path => {
    const explored = await supabase
      .from('capability_combinations')
      .select('id')
      .contains('capability_ids', path)
      .single()

    return !explored
  })
}

// Find bridging concepts (for synthesis prompts)
async function findBridgeConcepts(
  cap1: Capability,
  cap2: Capability
): Promise<string[]> {
  const { data } = await supabase.rpc('find_paths', {
    start_node_id: cap1.id,
    end_node_id: cap2.id,
    max_depth: 3
  })

  // Extract concepts from paths
  return data[0]?.path.map(nodeId => getNodeName(nodeId)) || []
}
```

---

## 4. FEEDBACK LOOP IMPLEMENTATION GAPS

### 4.1 Current State: **Incomplete**

**Architecture Spec:**
> "Rejection/acceptance reasons feed back into prompts (last 3 weeks)"

**Actual Implementation:**
- `bedtime-ideas.ts` has placeholder (line 495-500):
  ```typescript
  async function storePrompts(userId: string, prompts: BedtimePrompt[]) {
    // Placeholder
    return
  }
  ```
- `synthesis.ts` tracks `noveltyScore`, `feasibilityScore`, `interestScore`
- But these are **calculated randomly**, not learned from feedback

### 4.2 Missing: Feedback-Driven Prompt Construction

**Current (Line 173-198 in synthesis.ts):**
```typescript
const prompt = `You are a high-speed strategic synthesis engine.
Generate ${count} diverse project concepts...
[static prompt template]
Return ONLY a JSON array...`
```

**Should Be:**

```typescript
async function buildDynamicPrompt(
  userId: string,
  capabilities: Capability[],
  interests: Interest[]
): Promise<string> {
  // Get last 3 weeks of feedback
  const { data: feedback } = await supabase
    .from('suggestion_feedback')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 21*24*60*60*1000).toISOString())
    .order('created_at', { ascending: false })

  // Analyze patterns
  const rejectionReasons = feedback
    .filter(f => f.rating === -1)
    .flatMap(f => f.feedback_type || [])

  const acceptancePatterns = feedback
    .filter(f => f.rating >= 1)
    .map(f => ({
      title: f.suggestion_title,
      keywords: extractKeywords(f.improvement_suggestions),
      capabilityIds: f.capability_ids
    }))

  // Build guidance section
  const feedbackGuidance = `
RECENT USER FEEDBACK (${feedback.length} responses in last 3 weeks):
Rejected ideas often had these issues: ${rejectionReasons.join(', ') || 'none tracked'}
User LIKED ideas with these patterns: ${acceptancePatterns.slice(0, 3).map(p => p.title).join(', ')}

INSTRUCTION: Prioritize ideas that:
${acceptancePatterns.length > 0 ? `
- Have keywords like: ${extractSharedKeywords(acceptancePatterns).join(', ')}
- Combine capabilities: ${extractSharedCapabilities(acceptancePatterns).join(', ')}
` : '- Focus on clarity and feasibility'}
${rejectionReasons.includes('too_vague') ? '- Are HIGHLY SPECIFIC with concrete next steps' : ''}
${rejectionReasons.includes('not_feasible') ? '- Can be completed in < 2 weeks' : ''}
  `

  return `You are a high-speed strategic synthesis engine...
${feedbackGuidance}
Generate ${count} ideas...`
}
```

### 4.3 Missing: Embedding-Based Feedback Similarity

**Gap:**
- Feedback is text but never embedded
- Can't find "similar rejection reasons" across users or time
- No pattern matching for novel rejection types

**Implementation:**
```typescript
// After user provides feedback, embed it
async function processUserFeedback(
  suggestionId: string,
  rating: number,
  feedbackText: string
) {
  const embedding = await generateEmbedding(feedbackText)

  // Find similar past feedback
  const { data: similar } = await supabase.rpc('match_feedback', {
    query_embedding: embedding,
    match_threshold: 0.85,
    match_count: 5,
    filter_user_id: userId
  })

  // If multiple users have similar rejections, flag pattern
  if (similar.length > 1) {
    console.log(`Pattern detected: ${feedbackText} (${similar.length} similar rejections)`)
    // Could use this to adjust system-wide prompts
  }

  await supabase.from('suggestion_feedback').insert({
    suggestion_id: suggestionId,
    rating,
    free_text: feedbackText,
    feedback_embedding: embedding
  })
}
```

### 4.4 Missing: 30% Exploration Directive

**Architecture Spec:**
> "30% of runs ignore feedback for exploration"

**Current State:**
- No exploration toggle
- Synthesis always uses same capabilities/interests
- "Wildcard" ideas exist but are just injected at position 3

**Implementation:**

```typescript
export async function runSynthesis(userId: string) {
  const explorationMode = Math.random() < 0.3

  if (explorationMode) {
    console.log('[Synthesis] Exploration mode enabled (30% probability)')

    // Ignore feedback, use random capability pairs
    const [cap1, cap2] = await selectRandomCapabilityPair()

    // Force frontier mode
    const mode = ['one-skill', 'quick', 'stretch', 'analog', 'opposite'][Math.floor(Math.random() * 5)]

    // Use generic prompt (don't inject feedback)
    const ideas = await generateSuggestionsBatch(
      [cap1, cap2],
      interests,
      count,
      [],
      '', // No pairWeightsSection
      modeConstraints[mode]
    )
  } else {
    // Normal mode: use feedback-enhanced prompt
    const prompt = await buildDynamicPrompt(userId, capabilities, interests)
    const ideas = await generateSuggestionsBatch(...)
  }
}
```

---

## 5. MONITORING & OBSERVABILITY GAPS

### 5.1 Missing: Synthesis Metrics & Dashboarding

**Current State:**
- Only console.log()
- No structured logging
- No metrics collection

**Missing Metrics:**

```typescript
interface SynthesisMetrics {
  // Throughput
  ideas_per_second: number
  embeddings_per_second: number

  // Quality
  deduplication_rate: number // % ideas removed as duplicates
  avg_novelty_score: number
  avg_feasibility_score: number

  // Timing
  total_duration_ms: number
  embedding_duration_ms: number
  dedup_duration_ms: number
  storage_duration_ms: number

  // Errors
  api_errors: number
  db_errors: number
  embedding_errors: number

  // Feedback signals
  spark_rate: number // % ideas rated "spark"
  meh_rate: number
  build_rate: number
}

// Track per synthesis run
async function recordSynthesisMetrics(
  runId: string,
  metrics: SynthesisMetrics
) {
  await supabase.from('synthesis_metrics').insert({
    synthesis_run_id: runId,
    ...metrics,
    recorded_at: new Date()
  })
}
```

**Dashboard Queries:**
```sql
-- Feedback effectiveness over time
SELECT
  DATE_TRUNC('week', sr.completed_at) as week,
  AVG(sm.spark_rate) as avg_spark_rate,
  AVG(sm.avg_novelty_score) as avg_novelty,
  COUNT(DISTINCT sr.id) as synthesis_runs
FROM synthesis_runs sr
JOIN synthesis_metrics sm ON sr.id = sm.synthesis_run_id
WHERE sr.user_id = $1 AND sr.status = 'success'
GROUP BY week
ORDER BY week DESC;

-- Capability effectiveness
SELECT
  c.name,
  COUNT(ps.id) as suggestion_count,
  SUM(CASE WHEN sr.rating = 1 THEN 1 ELSE 0 END)::float / COUNT(*) as spark_rate,
  AVG(sr.rating) as avg_rating
FROM capabilities c
JOIN project_suggestions ps ON c.id = ANY(ps.capability_ids)
LEFT JOIN suggestion_ratings sr ON ps.id = sr.suggestion_id
GROUP BY c.id
ORDER BY spark_rate DESC;
```

### 5.2 Missing: Error Alerting

**Current Gaps:**
- Synthesis failure → silently logged
- Embedding errors → retried but not tracked
- DB connection failures → not detected

**Implementation:**

```typescript
// Create alert system
interface AlertRule {
  condition: () => Promise<boolean>
  severity: 'warning' | 'critical'
  message: string
  notifyEmail?: string
}

const alertRules: AlertRule[] = [
  {
    condition: async () => {
      const { count } = await supabase
        .from('synthesis_runs')
        .select('*', { count: 'exact' })
        .eq('status', 'failed')
        .gte('completed_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
      return count > 2 // 2+ failures in a week
    },
    severity: 'critical',
    message: 'Multiple synthesis failures detected'
  },
  {
    condition: async () => {
      const { count } = await supabase
        .from('synthesis_runs')
        .select('*', { count: 'exact' })
        .eq('status', 'in_progress')
        .lt('created_at', new Date(Date.now() - 2*60*60*1000).toISOString())
      return count > 0 // Synthesis stuck for >2 hours
    },
    severity: 'critical',
    message: 'Synthesis appears to be stuck'
  }
]

// Run alert check (in cron or separate health check)
async function checkAlerts() {
  for (const rule of alertRules) {
    if (await rule.condition()) {
      await sendAlert(rule.severity, rule.message)
    }
  }
}
```

---

## 6. SCALABILITY ISSUES

### 6.1 Embedding Cost Explosion

**Current State:**
- Embeddings generated for:
  - New ideas: N embeddings per synthesis run
  - Deduplication check: O(N * M) comparisons (N new, M historical)
  - Bedtime prompts: vectorized for similarity search

**Cost Growth:**
```
Week 1:  100 ideas generated → 100 embeddings
Week 2:  100 ideas generated → 100 + (100 * 100) deduplications = 200 embeddings
Week 4:  100 ideas → 100 + (100 * 400) = 200 embeddings
Year 1:  100 * 52 = 5200 ideas → 5200 + (100 * 5200) = 520K embeddings
         At $2/million = $1/year... but:
         - Bedtime prompts: +50 embeddings/day = 18K/year
         - Memory processing: +30 embeddings/day = 10K/year
         - Total: ~550K embeddings/year = potential bottleneck
```

**Recommendation:**
```typescript
// Use embeddings cache before generation
async function getCachedOrGenerateEmbedding(
  text: string,
  type: 'idea' | 'feedback' | 'memory'
) {
  // Check cache
  const hash = hashText(text)
  const { data: cached } = await supabase
    .from('embedding_cache')
    .select('embedding')
    .eq('hash', hash)
    .eq('type', type)
    .single()

  if (cached?.embedding) {
    console.log('[Cache] Embedding hit')
    return cached.embedding
  }

  // Generate and cache
  const embedding = await generateEmbedding(text)
  await supabase.from('embedding_cache').insert({
    hash,
    type,
    text: text.substring(0, 1000), // Store first 1000 chars
    embedding,
    created_at: new Date()
  })

  return embedding
}

// Deduplicate before embedding
async function deduplicateBeforeEmbedding(ideas: ProjectIdea[]) {
  const { data: existing } = await supabase
    .from('project_suggestions')
    .select('title, description')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  // String-level dedup (100% match detection)
  return ideas.filter(idea =>
    !existing.some(e =>
      e.title.toLowerCase() === idea.title.toLowerCase() ||
      e.description.toLowerCase() === idea.description.toLowerCase()
    )
  )
}
```

### 6.2 IVFFlat Index Performance Degradation

**Current State:**
```sql
CREATE INDEX idx_projects_embedding ON projects
  USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
```

**Problem:**
- `lists = 100` is hard-coded
- As ideas grow, IVFFlat performance degrades (needs rebuilding)
- No monitoring of index health

**Recommendation:**
```sql
-- Dynamic index rebuilding
CREATE OR REPLACE FUNCTION rebuild_embedding_indexes()
RETURNS void AS $$
BEGIN
  -- Calculate optimal lists count
  -- Rule: lists = sqrt(table_rows) / 100
  WITH row_counts AS (
    SELECT
      (SELECT COUNT(*) FROM project_suggestions) as suggestion_rows,
      (SELECT COUNT(*) FROM capabilities) as capability_rows
  )
  SELECT
    LEAST(
      GREATEST(SQRT(suggestion_rows) / 100, 10),
      1000
    ) as optimal_lists
  FROM row_counts;

  -- Rebuild if needed
  REINDEX INDEX CONCURRENTLY idx_projects_embedding;
  REINDEX INDEX CONCURRENTLY idx_capabilities_embedding;
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly
-- In cron: SELECT rebuild_embedding_indexes();
```

### 6.3 Deduplication Threshold Decay

**Current State:**
- Threshold: 0.92 cosine similarity (line 248)
- As more ideas are generated, collision probability increases

**Problem:**
```
With 1000 random 768-dim vectors:
  - Random collision rate at threshold 0.92: ~0.1% (expected 1 false positive)

With 10000 ideas (1 year):
  - Collision rate: ~10% (expected 1000 false positives)

With 100000 ideas (10 years):
  - Collision rate: ~60% (expected 60000 false positives)
  → At some point, all ideas look similar, nothing gets added
```

**Solution:**
```typescript
// Adaptive threshold based on corpus size
async function getAdaptiveDeduplicationThreshold(userId: string): Promise<number> {
  const { count } = await supabase
    .from('project_suggestions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  // Raise threshold as corpus grows
  const baseThreshold = 0.88
  const adaptiveThreshold = Math.min(
    0.99,
    baseThreshold + (Math.log10(count) / 100)
  )

  console.log(`Deduplication threshold: ${adaptiveThreshold.toFixed(3)} (${count} existing ideas)`)
  return adaptiveThreshold
}
```

---

## 7. MISSING COMPONENTS & FEATURES

### 7.1 Cold Start Problem

**Gap:**
- New user with 0 memories, 0 capabilities → synthesis generates what?
- `synthesis.ts` line 298: checks `if (capabilities.length === 0 && interests.length === 0)`
- But doesn't handle partial cold-start (few memories, many capabilities)

**Recommendation:**

```typescript
// Cold-start onboarding
async function runColdStartSynthesis(userId: string) {
  const { interests, capabilities } = await loadSynthesisContext(userId)

  if (capabilities.length < 3) {
    // User has few capabilities: extract from interests instead
    const inferredCapabilities = await inferCapabilitiesFromInterests(interests)
    // Or: guide user to define capabilities first
    return { success: false, requiresOnboarding: true }
  }

  if (interests.length < 2) {
    // User has few interests: use capability-only mode
    const ideas = await generateSuggestionsBatch(
      capabilities,
      [], // Empty interests
      10,
      [],
      '', // No pair weights
      '' // No mode
    )
    return ideas
  }

  return await generateSuggestionsBatch(capabilities, interests, 10)
}
```

### 7.2 Multi-User Orchestration

**Current State:**
- System is designed for single user (hardcoded `userId` in cron)
- If used with multiple users, synthesis runs serially

**Gap:**
```typescript
// cron/jobs.ts line 48
const userId = getUserId() // Single user only
const suggestions = await runSynthesis(userId) // Runs once
```

**Should Be:**
```typescript
async function runSynthesisForAllUsers() {
  const { data: users } = await supabase
    .from('auth.users')
    .select('id')

  const results = await Promise.all(
    users.map(user =>
      runSynthesis(user.id)
        .catch(err => {
          console.error(`Failed for user ${user.id}:`, err)
          return null
        })
    )
  )

  return results.filter(Boolean)
}
```

### 7.3 Capability Update Mechanism

**Gap:**
- `capabilities` table exists but nothing populates it
- `capability-scanner.ts` and `capabilities-extraction.ts` don't run
- User's actual skills never get updated after initial load

**Recommendation:**
```typescript
// Implement capability refresh
async function scanUserCapabilities(userId: string) {
  // 1. Scan git history for recent commits
  const recentCommits = await getGitCommits(30) // Last 30 days

  // 2. Extract file paths → project mappings
  const projectFiles = new Map<string, string[]>()
  recentCommits.forEach(commit => {
    commit.files.forEach(file => {
      const project = inferProjectFromFile(file)
      projectFiles.set(project, [...(projectFiles.get(project) || []), file])
    })
  })

  // 3. Scan files for technical patterns
  for (const [project, files] of projectFiles) {
    const capabilities = await extractCapabilitiesFromFiles(files)

    // Update capability strengths
    for (const cap of capabilities) {
      await updateCapabilityStrength(cap.name, cap.strength)
    }
  }
}

// Run on cron (weekly)
// Or: after each git push via GitHub webhook
```

---

## 8. ARCHITECTURAL RECOMMENDATIONS SUMMARY

### 8.1 Priority 1 (Critical - Implementation Breaks)

| Issue | Impact | Effort |
|-------|--------|--------|
| Synthesis timeout handling | Idea generation fails silently weekly | 4h |
| Transaction wrapping | Data corruption from failed deduplication | 6h |
| Embedding validation | NaN similarity scores corrupt vector search | 2h |
| Synthesis run history table | Cannot debug failures or analyze patterns | 8h |
| Feedback table schema | Cannot implement feedback-driven prompts | 6h |
| Domain pair tracking | Domain sampler strategy not executable | 8h |

### 8.2 Priority 2 (High - Feature Gaps)

| Issue | Impact | Effort |
|-------|--------|--------|
| Knowledge graph implementation | Cannot analyze capability relationships | 16h |
| Feedback-driven prompt generation | Feedback loop is disconnected | 12h |
| Synthesis metrics & monitoring | Cannot detect system degradation | 10h |
| Adaptive deduplication threshold | Duplicate ideas as corpus grows | 6h |
| Cold-start handling | New users get no suggestions | 4h |

### 8.3 Priority 3 (Medium - Polish)

| Issue | Impact | Effort |
|-------|--------|--------|
| Multi-user orchestration | Only works for single user | 8h |
| Health check endpoint | No visibility into system state | 2h |
| Alert rules | Silent failures not detected | 4h |
| Capability update mechanism | Skills never refresh | 6h |
| Embedding cost optimization | Exponential cost growth | 8h |

### 8.4 Priority 4 (Nice-to-Have)

| Issue | Impact | Effort |
|-------|--------|--------|
| Frontier mode tracking | Cannot analyze frontier exploration effectiveness | 4h |
| Graph traversal queries | Advanced analytics not possible | 12h |
| Embedding cache | Reduces API costs | 6h |

---

## 9. IMPLEMENTATION ROADMAP

### Phase 1 (Week 1): Critical Fixes
```
Day 1-2: Synthesis timeout + transaction wrapping
Day 3: Embedding validation + NaN handling
Day 4: Synthesis run history table + schema migration
Day 5: Feedback table schema + initial feedback collection
```

### Phase 2 (Week 2): Feedback Loop
```
Day 1-2: Feedback-driven prompt construction
Day 3: Domain pair tracking + sampler implementation
Day 4: Exploration mode (30% toggle)
Day 5: Test full feedback loop (generate → rate → regenerate)
```

### Phase 3 (Week 3): Observability
```
Day 1-2: Synthesis metrics collection
Day 3: Dashboard queries + alerting rules
Day 4: Health check endpoint
Day 5: Deduplication threshold adaptation
```

### Phase 4+ (Future): Advanced Features
```
Knowledge graph, multi-user orchestration, capability scanning, etc.
```

---

## 10. RISK MATRIX

```
         Likelihood
Severity  High  Medium  Low
   High    🔴    🔴    🟡
  Medium   🔴    🟡    🟢
   Low     🟡    🟢    🟢

🔴 = Address immediately
🟡 = Plan for next sprint
🟢 = Monitor for future

Critical Risks (🔴):
1. Synthesis timeouts → weekly generation fails
2. Deduplication bugs → database corruption
3. Embedding validation → vector search poisoned
4. Missing feedback tables → feedback loop can't be implemented
5. No domain pair tracking → architecture feature is broken

Medium Risks (🟡):
1. Embedding cost explosion → API budget exceeded
2. IVFFlat degradation → search performance tanks
3. No synthesis metrics → blind to quality issues
4. Cold-start problem → new users frustrated
5. Single-user hardcoding → multi-user deployment blocked
```

---

## 11. TESTING STRATEGY

### Unit Tests
```typescript
// Test deduplication doesn't corrupt on failure
async function testDuplicateDetectionRecovery() {
  // 1. Generate ideas
  // 2. Inject DB failure mid-dedup
  // 3. Verify no corrupted state
  // 4. Retry: should succeed without duplicates
}

// Test embedding validation
async function testEmbeddingValidation() {
  // Test zero-magnitude vectors → cosineSimilarity returns 0
  // Test wrong dimensions → throws error
  // Test NaN → caught and logged
}

// Test timeout graceful degradation
async function testSynthesisTimeout() {
  // Timeout after 30s
  // Verify: partial results saved, logs recorded, no duplicate inserts
}
```

### Integration Tests
```typescript
// Test full synthesis pipeline with feedback
async function testSynthesisWithFeedback() {
  // 1. Generate ideas
  // 2. User rates ideas
  // 3. Next synthesis uses feedback-enhanced prompt
  // 4. Verify new ideas differ from rejected ones
}

// Test domain sampler distribution
async function testDomainSamplerDistribution() {
  // Run 100 syntheses
  // Track: high-distance pairs (should be 70%), medium (20%), single (10%)
  // Verify distribution is within ±5% of target
}
```

### Chaos Engineering
```typescript
// Inject failures and verify system recovers
- Gemini API timeout → synthesis completes with partial results
- Supabase connection drop → retry with exponential backoff
- Corrupted embedding vector → caught during validation
- Database transaction abort → entire synthesis rolled back
```

---

## CONCLUSION

**The Polymath system is architecturally sound but operationally incomplete.** The core idea generation pipeline exists, but critical supporting infrastructure is missing:

1. **Failure handling** is weak (no retries for generation, no transaction safety)
2. **Data model** is incomplete (no synthesis history, no structured feedback, no domain pair tracking)
3. **Feedback loop** is disconnected (feedback collected but not used to shape prompts)
4. **Knowledge graph** is not a graph (just flat tables)
5. **Observability** is absent (no metrics, no alerting, no health checks)

**Estimated effort to production-ready**:
- Critical fixes: 24-30 hours
- Full implementation: 80-100 hours
- Full production deployment with observability: 120-150 hours

**Recommendation**: Start with Priority 1 items (database schema, timeout handling, embedding validation) in the next 1-2 weeks. These unblock the feedback loop and make the system robust enough for extended testing.

