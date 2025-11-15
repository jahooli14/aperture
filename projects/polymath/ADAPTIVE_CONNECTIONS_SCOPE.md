# Adaptive Connection Threshold System - Scope Document

## Overview
Implement an adaptive connection system that raises similarity thresholds as the knowledge graph grows, with weekly reruns to re-evaluate all connections using updated thresholds.

## Problem Statement
Currently, connection thresholds are hardcoded:
- **Suggestion threshold**: 0.55 (55% similarity)
- **Auto-link threshold**: 0.85 (85% similarity)

As the knowledge base grows from 10 items to 100+ items, these fixed thresholds will lead to:
- **Over-connection**: Too many weak links that dilute meaningful relationships
- **Stale connections**: Early connections that seemed strong become relatively weak as better matches appear
- **Quality degradation**: Signal-to-noise ratio decreases over time

## Solution: Adaptive Threshold System

### Phase 1: Dynamic Threshold Calculation

#### 1.1 Threshold Configuration Table
Create a new table to track threshold history and configuration:

```sql
-- migrations/011-adaptive-thresholds.sql
CREATE TABLE connection_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thresholds
  suggestion_threshold DECIMAL(4,3) NOT NULL, -- e.g., 0.550
  auto_link_threshold DECIMAL(4,3) NOT NULL,  -- e.g., 0.850

  -- Item counts that triggered this threshold
  total_items INTEGER NOT NULL,
  thoughts_count INTEGER NOT NULL,
  projects_count INTEGER NOT NULL,
  articles_count INTEGER NOT NULL,

  -- Metadata
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  applied_by TEXT DEFAULT 'system', -- 'system', 'admin', 'weekly_rerun'
  notes TEXT,

  -- Make sure we can track current threshold
  is_current BOOLEAN DEFAULT false
);

CREATE INDEX idx_thresholds_current ON connection_thresholds(is_current) WHERE is_current = true;
CREATE INDEX idx_thresholds_applied ON connection_thresholds(applied_at DESC);

COMMENT ON TABLE connection_thresholds IS 'History of connection threshold adjustments based on knowledge graph size';
```

#### 1.2 Threshold Calculation Function
Create a function to calculate optimal thresholds based on item counts:

**File**: `api/lib/adaptive-thresholds.ts`

```typescript
interface ThresholdConfig {
  suggestionThreshold: number
  autoLinkThreshold: number
  totalItems: number
  thoughtsCount: number
  projectsCount: number
  articlesCount: number
}

/**
 * Calculate adaptive thresholds based on knowledge graph size
 *
 * Logic:
 * - Start: 10 items → 0.55 suggestion, 0.85 auto-link
 * - Scale: 100 items → 0.65 suggestion, 0.88 auto-link
 * - Mature: 500+ items → 0.70 suggestion, 0.90 auto-link
 *
 * Formula: threshold = base + (growth_factor * log10(items))
 */
export function calculateThresholds(
  thoughtsCount: number,
  projectsCount: number,
  articlesCount: number
): ThresholdConfig {
  const totalItems = thoughtsCount + projectsCount + articlesCount

  // Minimum thresholds (when starting out)
  const MIN_SUGGESTION = 0.55
  const MIN_AUTO_LINK = 0.85

  // Maximum thresholds (when knowledge graph is large)
  const MAX_SUGGESTION = 0.70
  const MAX_AUTO_LINK = 0.90

  // Scale factor: how many items to reach max threshold
  const SCALE_ITEMS = 500

  if (totalItems < 10) {
    // Keep low thresholds for small graphs
    return {
      suggestionThreshold: MIN_SUGGESTION,
      autoLinkThreshold: MIN_AUTO_LINK,
      totalItems,
      thoughtsCount,
      projectsCount,
      articlesCount
    }
  }

  // Logarithmic scaling: slow increase at first, plateaus at SCALE_ITEMS
  const scaleFactor = Math.min(1, Math.log10(totalItems) / Math.log10(SCALE_ITEMS))

  const suggestionThreshold = MIN_SUGGESTION + (MAX_SUGGESTION - MIN_SUGGESTION) * scaleFactor
  const autoLinkThreshold = MIN_AUTO_LINK + (MAX_AUTO_LINK - MIN_AUTO_LINK) * scaleFactor

  return {
    suggestionThreshold: Math.round(suggestionThreshold * 1000) / 1000, // 3 decimal places
    autoLinkThreshold: Math.round(autoLinkThreshold * 1000) / 1000,
    totalItems,
    thoughtsCount,
    projectsCount,
    articlesCount
  }
}

/**
 * Get current active thresholds from database
 * Falls back to calculating fresh thresholds if none exist
 */
export async function getCurrentThresholds(supabase: any): Promise<ThresholdConfig> {
  // Try to get current threshold from DB
  const { data: currentThreshold } = await supabase
    .from('connection_thresholds')
    .select('*')
    .eq('is_current', true)
    .single()

  if (currentThreshold) {
    return {
      suggestionThreshold: currentThreshold.suggestion_threshold,
      autoLinkThreshold: currentThreshold.auto_link_threshold,
      totalItems: currentThreshold.total_items,
      thoughtsCount: currentThreshold.thoughts_count,
      projectsCount: currentThreshold.projects_count,
      articlesCount: currentThreshold.articles_count
    }
  }

  // Calculate fresh thresholds
  const counts = await getItemCounts(supabase)
  return calculateThresholds(counts.thoughts, counts.projects, counts.articles)
}

/**
 * Save new threshold configuration to database
 */
export async function saveThresholdConfig(
  supabase: any,
  config: ThresholdConfig,
  appliedBy: string = 'system',
  notes?: string
): Promise<void> {
  // Mark all previous thresholds as non-current
  await supabase
    .from('connection_thresholds')
    .update({ is_current: false })
    .eq('is_current', true)

  // Insert new current threshold
  await supabase
    .from('connection_thresholds')
    .insert({
      suggestion_threshold: config.suggestionThreshold,
      auto_link_threshold: config.autoLinkThreshold,
      total_items: config.totalItems,
      thoughts_count: config.thoughtsCount,
      projects_count: config.projectsCount,
      articles_count: config.articlesCount,
      is_current: true,
      applied_by: appliedBy,
      notes
    })
}

async function getItemCounts(supabase: any) {
  const [thoughts, projects, articles] = await Promise.all([
    supabase.from('memories').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('reading_queue').select('id', { count: 'exact', head: true })
  ])

  return {
    thoughts: thoughts.count || 0,
    projects: projects.count || 0,
    articles: articles.count || 0
  }
}
```

#### 1.3 Update Connection Creation Logic
Modify existing connection creation to use adaptive thresholds:

**Files to update**:
- `lib/process-memory.ts:230-379` (findAndCreateConnections)
- `api/connections.ts:134-262` (handleAutoSuggest)

**Changes**:
```typescript
// BEFORE (hardcoded):
if (similarity > 0.55) { // suggestion
if (similarity > 0.85) { // auto-link

// AFTER (adaptive):
const thresholds = await getCurrentThresholds(supabase)
if (similarity > thresholds.suggestionThreshold) {
if (similarity > thresholds.autoLinkThreshold) {
```

---

### Phase 2: Weekly Connection Remapping

#### 2.1 Connection Remapping Logic
Create a new background job that re-evaluates all AI-created connections:

**File**: `lib/remap-connections.ts`

```typescript
/**
 * Weekly Connection Remapping
 *
 * Re-evaluates all AI-created connections using current adaptive thresholds:
 * 1. Get all items with embeddings
 * 2. Calculate current thresholds based on graph size
 * 3. For each item, find all potential connections
 * 4. Remove AI connections that no longer meet threshold
 * 5. Create new AI connections that now meet threshold
 * 6. Preserve all user-created manual connections
 */

interface RemapStats {
  totalItems: number
  connectionsEvaluated: number
  connectionsRemoved: number
  connectionsCreated: number
  thresholdsUsed: ThresholdConfig
  duration: number
}

export async function remapConnections(
  supabase: any,
  userId: string
): Promise<RemapStats> {
  const startTime = Date.now()

  logger.info('[remap-connections] Starting weekly connection remapping')

  // 1. Get current adaptive thresholds
  const thresholds = await getCurrentThresholds(supabase)

  logger.info({
    suggestion_threshold: thresholds.suggestionThreshold,
    auto_link_threshold: thresholds.autoLinkThreshold,
    total_items: thresholds.totalItems
  }, '[remap-connections] Using adaptive thresholds')

  // 2. Fetch all items with embeddings
  const [thoughts, projects, articles] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, embedding')
      .not('embedding', 'is', null),
    supabase
      .from('projects')
      .select('id, title, description, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
  ])

  const allItems = [
    ...thoughts.data.map(t => ({ ...t, type: 'thought' as const })),
    ...projects.data.map(p => ({ ...p, type: 'project' as const })),
    ...articles.data.map(a => ({ ...a, type: 'article' as const }))
  ]

  logger.info(`[remap-connections] Found ${allItems.length} items with embeddings`)

  let connectionsRemoved = 0
  let connectionsCreated = 0
  let connectionsEvaluated = 0

  // 3. For each item, re-evaluate connections
  for (const item of allItems) {
    // Get existing AI connections for this item
    const { data: existingConnections } = await supabase
      .from('connections')
      .select('id, source_type, source_id, target_type, target_id, ai_reasoning')
      .eq('created_by', 'ai')
      .or(`and(source_type.eq.${item.type},source_id.eq.${item.id}),and(target_type.eq.${item.type},target_id.eq.${item.id})`)

    // Calculate similarities with all other items
    const candidates: Array<{
      type: string
      id: string
      similarity: number
      existing: boolean
      connectionId?: string
    }> = []

    for (const otherItem of allItems) {
      if (otherItem.id === item.id) continue

      const similarity = cosineSimilarity(item.embedding, otherItem.embedding)
      connectionsEvaluated++

      // Check if connection already exists
      const existing = existingConnections?.find(c =>
        (c.source_type === item.type && c.source_id === item.id && c.target_type === otherItem.type && c.target_id === otherItem.id) ||
        (c.target_type === item.type && c.target_id === item.id && c.source_type === otherItem.type && c.source_id === otherItem.id)
      )

      candidates.push({
        type: otherItem.type,
        id: otherItem.id,
        similarity,
        existing: !!existing,
        connectionId: existing?.id
      })
    }

    // 4. Remove connections that no longer meet threshold
    const toRemove = candidates.filter(c =>
      c.existing &&
      c.similarity < thresholds.autoLinkThreshold // Falls below auto-link threshold
    )

    if (toRemove.length > 0) {
      const idsToRemove = toRemove.map(c => c.connectionId).filter(Boolean)
      await supabase
        .from('connections')
        .delete()
        .in('id', idsToRemove)

      connectionsRemoved += toRemove.length
      logger.info(`[remap-connections] Removed ${toRemove.length} weak connections from ${item.type}:${item.id}`)
    }

    // 5. Create new connections that now meet threshold
    const toCreate = candidates.filter(c =>
      !c.existing &&
      c.similarity > thresholds.autoLinkThreshold // Meets auto-link threshold
    )

    if (toCreate.length > 0) {
      const newConnections = toCreate.map(c => ({
        source_type: item.type,
        source_id: item.id,
        target_type: c.type,
        target_id: c.id,
        connection_type: 'relates_to',
        created_by: 'ai',
        ai_reasoning: `${Math.round(c.similarity * 100)}% semantic match (weekly remap)`
      }))

      await supabase
        .from('connections')
        .insert(newConnections)

      connectionsCreated += toCreate.length
      logger.info(`[remap-connections] Created ${toCreate.length} new connections for ${item.type}:${item.id}`)
    }
  }

  const duration = Date.now() - startTime

  const stats: RemapStats = {
    totalItems: allItems.length,
    connectionsEvaluated,
    connectionsRemoved,
    connectionsCreated,
    thresholdsUsed: thresholds,
    duration
  }

  logger.info(stats, '[remap-connections] Weekly remapping complete')

  return stats
}
```

#### 2.2 Add Remapping to Weekly Cron
Update the cron job to run remapping on Mondays:

**File**: `api/cron/jobs.ts:118-134`

```typescript
// 3. Run synthesis + remapping on Mondays
if (isMonday) {
  try {
    const userId = process.env.userId || 'default-user'

    // Run synthesis
    const suggestions = await runSynthesis(userId)

    // Run connection remapping
    const remapStats = await remapConnections(supabase, userId)

    results.tasks.monday = {
      success: true,
      synthesis_suggestions: suggestions?.length || 0,
      remap_stats: remapStats
    }

    console.log(`[cron/jobs/daily] Monday: Generated ${suggestions?.length || 0} suggestions, remapped ${remapStats.connectionsRemoved} removed / ${remapStats.connectionsCreated} created connections`)
  } catch (error) {
    results.tasks.monday = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    console.error('[cron/jobs/daily] Monday tasks failed:', error)
  }
}
```

---

### Phase 3: UI & Visibility

#### 3.1 Settings Page: Threshold Visibility
Add a new section to the Settings page showing current thresholds:

**File**: `src/pages/SettingsPage.tsx`

```tsx
// Add to SettingsPage component
const [thresholds, setThresholds] = useState<{
  suggestion: number
  autoLink: number
  totalItems: number
  lastUpdated: string
} | null>(null)

useEffect(() => {
  fetchThresholds()
}, [])

const fetchThresholds = async () => {
  const response = await fetch('/api/connections?action=thresholds')
  const data = await response.json()
  setThresholds(data)
}

// UI Section
<div className="premium-card p-6">
  <h3 className="text-lg font-semibold mb-4">Connection Thresholds</h3>
  <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
    Thresholds adapt as your knowledge graph grows. Higher thresholds = stronger connections required.
  </p>

  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <span className="text-sm">Suggestion Threshold</span>
      <span className="font-mono font-semibold" style={{ color: 'var(--premium-blue)' }}>
        {Math.round((thresholds?.suggestion || 0.55) * 100)}%
      </span>
    </div>

    <div className="flex justify-between items-center">
      <span className="text-sm">Auto-Link Threshold</span>
      <span className="font-mono font-semibold" style={{ color: 'var(--premium-emerald)' }}>
        {Math.round((thresholds?.autoLink || 0.85) * 100)}%
      </span>
    </div>

    <div className="flex justify-between items-center">
      <span className="text-sm">Total Items</span>
      <span className="font-mono">{thresholds?.totalItems || 0}</span>
    </div>

    <div className="text-xs pt-2" style={{ color: 'var(--premium-text-tertiary)' }}>
      Last updated: {thresholds?.lastUpdated ? new Date(thresholds.lastUpdated).toLocaleDateString() : 'N/A'}
    </div>
  </div>
</div>
```

#### 3.2 Connection Reasoning Updates
Update AI reasoning to include threshold info:

```typescript
// In connection creation
ai_reasoning: `${Math.round(similarity * 100)}% match (threshold: ${Math.round(thresholds.autoLinkThreshold * 100)}%)`
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `connection_thresholds` table migration
- [ ] Implement `api/lib/adaptive-thresholds.ts`
- [ ] Update `lib/process-memory.ts` to use adaptive thresholds
- [ ] Update `api/connections.ts` to use adaptive thresholds
- [ ] Add `/api/connections?action=thresholds` endpoint
- [ ] Test threshold calculation with various item counts

### Phase 2: Remapping (Week 2)
- [ ] Implement `lib/remap-connections.ts`
- [ ] Update `api/cron/jobs.ts` to run remapping on Mondays
- [ ] Add logging and monitoring for remap operations
- [ ] Test remapping with sample data
- [ ] Verify manual connections are preserved

### Phase 3: Polish (Week 3)
- [ ] Add threshold visibility to Settings page
- [ ] Update connection reasoning messages
- [ ] Add threshold history API endpoint
- [ ] Create admin endpoint to manually trigger remap
- [ ] Documentation and testing

---

## Edge Cases & Considerations

### 1. Performance
- **Problem**: Remapping 500 items × 500 items = 250k similarity calculations
- **Solution**:
  - Batch processing with rate limiting
  - Only remap items that gained/lost >50 items since last run
  - Use Supabase vector similarity function instead of client-side calculation
  - Add configurable timeout (e.g., max 30 minutes)

### 2. Manual Connection Preservation
- **Problem**: User manually created a connection that no longer meets threshold
- **Solution**:
  - Always preserve connections where `created_by = 'user'`
  - Only remove/create connections where `created_by = 'ai'`
  - Add visual indicator in UI: "Manual connection (preserved)"

### 3. Threshold Oscillation
- **Problem**: Thresholds change too frequently, causing connection churn
- **Solution**:
  - Only update thresholds if change is >0.02 (2%)
  - Use moving average of last 3 calculations
  - Require minimum 20 item increase before recalculating

### 4. Vercel Timeout
- **Problem**: Vercel serverless functions timeout at 60 seconds (hobby) / 300 seconds (pro)
- **Solution**:
  - Process in batches of 50 items per run
  - Store remap progress in database
  - Resume from last checkpoint if timeout occurs
  - Consider moving to dedicated worker (Render, Fly.io) for large graphs

### 5. Cold Start Performance
- **Problem**: First connection creation after deploy is slow (calculating thresholds)
- **Solution**:
  - Cache thresholds in `connection_thresholds` table
  - Only recalculate during weekly remap or manual trigger
  - Warm up function on deploy with initial threshold calculation

---

## Database Schema Changes

### New Tables
```sql
-- connection_thresholds: Track threshold history
CREATE TABLE connection_thresholds (...)

-- connection_remap_runs: Track remap job history
CREATE TABLE connection_remap_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  items_processed INTEGER,
  connections_removed INTEGER,
  connections_created INTEGER,
  threshold_used DECIMAL(4,3),
  error_message TEXT,
  duration_ms INTEGER
);
```

---

## API Endpoints

### New Endpoints
- `GET /api/connections?action=thresholds` - Get current thresholds
- `GET /api/connections?action=threshold-history` - Get threshold history
- `POST /api/admin/remap-connections` - Manual trigger (protected)

### Updated Endpoints
- `POST /api/connections?action=auto-suggest` - Now uses adaptive thresholds
- `POST /api/connections?action=create-spark` - Now uses adaptive thresholds

---

## Monitoring & Logging

### Key Metrics
- Threshold changes over time
- Connection churn rate (removed vs created)
- Average similarity scores
- Remap job duration and success rate
- Items per connection (graph density)

### Logging
```typescript
logger.info({
  old_suggestion: 0.55,
  new_suggestion: 0.62,
  old_auto_link: 0.85,
  new_auto_link: 0.87,
  total_items: 157,
  trigger: 'weekly_remap'
}, 'Thresholds updated')

logger.info({
  connections_evaluated: 24649,
  connections_removed: 23,
  connections_created: 47,
  duration_ms: 14532,
  threshold: 0.87
}, 'Weekly remap completed')
```

---

## Testing Strategy

### Unit Tests
- Threshold calculation with various item counts
- Connection remapping logic
- Manual connection preservation

### Integration Tests
- End-to-end remap flow
- Cron job execution
- API endpoint responses

### Performance Tests
- Remap with 1k items
- Verify timeout handling
- Memory usage during remap

---

## Rollout Plan

### Stage 1: Deploy with Default Behavior
- Deploy adaptive threshold system
- Default to current thresholds (0.55, 0.85) for first week
- Monitor for issues

### Stage 2: Enable Adaptive Thresholds
- Calculate initial thresholds based on current graph size
- Apply to new connections only (don't remap existing)
- Monitor connection quality

### Stage 3: Enable Weekly Remapping
- Start weekly remapping on Mondays
- Monitor connection churn
- Collect user feedback on connection quality

---

## Success Metrics

### Quality Metrics
- **Connection relevance**: User-accepted suggestions increase by 20%
- **Connection precision**: Fewer dismissed suggestions
- **Graph density**: Stable connections-per-item ratio as graph grows

### Performance Metrics
- **Remap completion**: 95% of remaps complete within timeout
- **Threshold stability**: Thresholds change <3 times per quarter
- **System health**: No increase in error rates

---

## Future Enhancements

### V2: User-Configurable Thresholds
Allow power users to override system thresholds:
```typescript
// User preferences
{
  use_adaptive: true,
  min_suggestion: 0.60, // Override minimum
  max_auto_link: 0.88   // Override maximum
}
```

### V3: Per-Type Thresholds
Different thresholds for different content types:
```typescript
{
  thought_to_thought: 0.70, // Stricter for thought-thought links
  project_to_article: 0.60, // More lenient for cross-type links
}
```

### V4: Temporal Decay
Reduce connection strength over time unless reinforced:
```typescript
// Connections get weaker if items aren't accessed together
connection_strength = base_similarity * (1 - temporal_decay_factor)
```

---

## Estimated Effort

- **Phase 1**: 8-12 hours (foundation)
- **Phase 2**: 12-16 hours (remapping)
- **Phase 3**: 4-6 hours (polish)
- **Total**: 24-34 hours (~3-4 days)

---

## Questions for Review

1. **Threshold Formula**: Is logarithmic scaling the right approach? Should we use linear or exponential?
2. **Remap Frequency**: Weekly or bi-weekly? Should it be configurable?
3. **Performance**: Should we move remapping to a dedicated worker for graphs >500 items?
4. **User Control**: Should users see/control thresholds, or keep it automatic?
5. **Connection Types**: Should different connection_types use different thresholds?

---

## Appendix: Threshold Calculation Examples

| Total Items | Suggestion Threshold | Auto-Link Threshold | Notes |
|-------------|---------------------|---------------------|-------|
| 10          | 0.550 (55%)        | 0.850 (85%)        | Starting out |
| 50          | 0.585 (58.5%)      | 0.867 (86.7%)      | Growing |
| 100         | 0.605 (60.5%)      | 0.877 (87.7%)      | Active use |
| 250         | 0.635 (63.5%)      | 0.887 (88.7%)      | Mature |
| 500         | 0.655 (65.5%)      | 0.895 (89.5%)      | Large |
| 1000+       | 0.700 (70%)        | 0.900 (90%)        | Maximum |

**Key Insight**: Thresholds increase slowly at first (10→100 items = +5%), then plateau (250→1000 items = +6.5%)
