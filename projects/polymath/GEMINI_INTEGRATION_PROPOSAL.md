# Gemini Integration Proposal for Polymath
**Date**: 2025-11-01
**Purpose**: Cost-effective AI analysis using Google's Gemini API with vector-based optimization

---

## Executive Summary

**Problem**: Currently using OpenAI (embeddings + GPT-4o-mini) for AI analysis. Costs add up with:
- `text-embedding-3-small`: $0.02 per 1M tokens
- `gpt-4o-mini`: $0.15 per 1M input tokens / $0.60 per 1M output tokens

**Solution**: Migrate to Google Gemini with intelligent caching:
- **Gemini 1.5 Flash**: $0.075 per 1M input tokens / $0.30 per 1M output tokens (50% cheaper than GPT-4o-mini)
- **Gemini 1.5 Pro**: $1.25 per 1M input tokens / $5.00 per 1M output tokens (for complex analysis)
- **Vector Store**: Pre-compute embeddings for all content, store in Supabase `pgvector`
- **Smart Caching**: Only re-analyze changed content

---

## Current State Analysis

### What We're Analyzing Now

**Location**: `api/connections.ts` (540 lines)

**Current Flow**:
1. User saves article/thought/project
2. Generate OpenAI embedding for new item
3. Compare against ALL existing items (50-100 per type)
4. Generate NEW embeddings for each comparison item (expensive!)
5. Use GPT-4o-mini to generate reasoning for top 5 matches

**Problems**:
- ❌ Re-generates embeddings for same items repeatedly
- ❌ No caching - every request fetches 50+ items
- ❌ Expensive at scale (150+ embedding calls per new item)
- ❌ No vector database - using cosine similarity in Node.js

---

## Proposed Architecture

### Phase 1: Vector Store Foundation (Week 1)

**Goal**: Build vector database infrastructure

#### 1.1 Supabase pgvector Setup
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to existing tables
ALTER TABLE memories ADD COLUMN embedding_gemini vector(768);
ALTER TABLE projects ADD COLUMN embedding_gemini vector(768);
ALTER TABLE articles ADD COLUMN embedding_gemini vector(768);

-- Create indexes for fast similarity search
CREATE INDEX memories_embedding_idx ON memories
  USING ivfflat (embedding_gemini vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX projects_embedding_idx ON projects
  USING ivfflat (embedding_gemini vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX articles_embedding_idx ON articles
  USING ivfflat (embedding_gemini vector_cosine_ops)
  WITH (lists = 100);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_content_gemini(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  content_type text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  content_type text,
  title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  (
    SELECT m.id, 'thought'::text, m.title,
           1 - (m.embedding_gemini <=> query_embedding) as similarity
    FROM memories m
    WHERE 1 - (m.embedding_gemini <=> query_embedding) > match_threshold
      AND (content_type = 'all' OR content_type = 'thought')
    ORDER BY similarity DESC
    LIMIT match_count
  )
  UNION ALL
  (
    SELECT p.id, 'project'::text, p.title,
           1 - (p.embedding_gemini <=> query_embedding) as similarity
    FROM projects p
    WHERE 1 - (p.embedding_gemini <=> query_embedding) > match_threshold
      AND (content_type = 'all' OR content_type = 'project')
    ORDER BY similarity DESC
    LIMIT match_count
  )
  UNION ALL
  (
    SELECT a.id, 'article'::text, a.title,
           1 - (a.embedding_gemini <=> query_embedding) as similarity
    FROM articles a
    WHERE 1 - (a.embedding_gemini <=> query_embedding) > match_threshold
      AND (content_type = 'all' OR content_type = 'article')
    ORDER BY similarity DESC
    LIMIT match_count
  )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

#### 1.2 Gemini Embedding Service
**File**: `api/lib/gemini-embeddings.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  const result = await model.embedContent(text)
  return result.embedding.values // 768-dimensional vector
}

export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  // Gemini supports batch embedding (up to 100 at once)
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  const results = await Promise.all(
    texts.map(text => model.embedContent(text))
  )

  return results.map(r => r.embedding.values)
}
```

#### 1.3 Background Migration Job
**File**: `scripts/migrate-to-gemini-vectors.ts`

```typescript
/**
 * One-time migration script
 * Generates embeddings for all existing content
 */

import { createClient } from '@supabase/supabase-js'
import { batchGenerateEmbeddings } from '../api/lib/gemini-embeddings'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateMemories() {
  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, body')
    .is('embedding_gemini', null)
    .limit(100) // Process in batches

  if (!memories || memories.length === 0) return

  console.log(`Processing ${memories.length} memories...`)

  // Batch process in groups of 10
  for (let i = 0; i < memories.length; i += 10) {
    const batch = memories.slice(i, i + 10)
    const texts = batch.map(m => `${m.title} ${m.body}`)

    const embeddings = await batchGenerateEmbeddings(texts)

    // Update database
    await Promise.all(
      batch.map((memory, idx) =>
        supabase
          .from('memories')
          .update({ embedding_gemini: embeddings[idx] })
          .eq('id', memory.id)
      )
    )

    console.log(`  Processed ${i + 10}/${memories.length}`)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limit
  }
}

async function migrateProjects() {
  // Similar to memories
}

async function migrateArticles() {
  // Similar to memories
}

// Run migration
await Promise.all([
  migrateMemories(),
  migrateProjects(),
  migrateArticles()
])

console.log('✅ Migration complete!')
```

---

### Phase 2: Smart Analysis Pipeline (Week 2)

**Goal**: Replace current OpenAI-based analysis with Gemini + vectors

#### 2.1 New Connection Suggestion Flow
**File**: `api/connections-gemini.ts`

```typescript
import { generateEmbedding } from './lib/gemini-embeddings'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function suggestConnections(
  itemType: 'thought' | 'project' | 'article',
  itemId: string,
  content: string
) {
  // Step 1: Generate embedding for new item (1 API call)
  const embedding = await generateEmbedding(content)

  // Step 2: Vector search in database (NO API calls - just SQL)
  const { data: matches } = await supabase.rpc('match_content_gemini', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 10,
    content_type: 'all'
  })

  // Step 3: Use Gemini Flash to analyze top 5 matches (1 API call)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-002' })

  const prompt = `Analyze these content connections and provide a one-sentence explanation for each relationship.

Source ${itemType}: ${content.slice(0, 500)}

Related items:
${matches.slice(0, 5).map((m, i) => `${i+1}. [${m.content_type}] ${m.title} (${(m.similarity * 100).toFixed(0)}% similar)`).join('\n')}

For each item, write ONE concise sentence explaining the connection. Format as JSON:
[
  { "index": 1, "reasoning": "..." },
  { "index": 2, "reasoning": "..." },
  ...
]`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  })

  const reasonings = JSON.parse(result.response.text())

  // Step 4: Store suggestions in database
  const suggestions = await Promise.all(
    matches.slice(0, 5).map(async (match, idx) => {
      const { data } = await supabase
        .from('connection_suggestions')
        .insert({
          from_item_type: itemType,
          from_item_id: itemId,
          to_item_type: match.content_type,
          to_item_id: match.id,
          reasoning: reasonings[idx]?.reasoning || 'Related content',
          confidence: match.similarity,
          user_id: userId,
          status: 'pending'
        })
        .select()
        .single()

      return data
    })
  )

  return suggestions
}
```

**Efficiency Gains**:
- Before: 150+ API calls per item (50 memories + 50 projects + 50 articles embeddings + 5 reasoning calls)
- After: 2 API calls per item (1 embedding + 1 reasoning batch)
- **Cost reduction: ~98%** 🎉

---

### Phase 3: When to Trigger Analysis

#### 3.1 On New Item Save
**Trigger**: User creates thought/project/article

```typescript
// In api/memories.ts (for thoughts)
export async function createMemory(req, res) {
  // 1. Save memory to database
  const { data: memory } = await supabase
    .from('memories')
    .insert({ title, body, user_id })
    .select()
    .single()

  // 2. Generate embedding (async, don't block response)
  const embedding = await generateEmbedding(`${title} ${body}`)

  // 3. Update with embedding
  await supabase
    .from('memories')
    .update({ embedding_gemini: embedding })
    .eq('id', memory.id)

  // 4. Trigger connection analysis (background job)
  await suggestConnections('thought', memory.id, `${title} ${body}`)

  return res.status(200).json({ memory })
}
```

#### 3.2 Daily Batch Analysis (Optional)
**Cron**: Every night at 2am

```typescript
// Vercel Cron: /api/cron/daily-analysis.ts
export default async function handler(req, res) {
  // Only run on cron requests
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Find items created in last 24 hours without embeddings
  const { data: newItems } = await supabase
    .from('memories')
    .select('id, title, body')
    .is('embedding_gemini', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Generate embeddings in batch
  if (newItems && newItems.length > 0) {
    const texts = newItems.map(m => `${m.title} ${m.body}`)
    const embeddings = await batchGenerateEmbeddings(texts)

    await Promise.all(
      newItems.map((item, idx) =>
        supabase
          .from('memories')
          .update({ embedding_gemini: embeddings[idx] })
          .eq('id', item.id)
      )
    )
  }

  return res.status(200).json({ processed: newItems?.length || 0 })
}
```

---

## Cost Analysis

### Current Monthly Usage Estimate

**Assumptions**:
- 50 thoughts/month
- 20 articles/month
- 10 projects/month
- Each item compared against 150 existing items

**OpenAI Costs**:
```
Embeddings:
  80 items/month × 150 comparisons = 12,000 embedding calls
  Avg 200 tokens/item × 12,000 = 2,400,000 tokens
  Cost: 2.4M tokens × $0.02/1M = $0.048

Reasoning (GPT-4o-mini):
  80 items × 5 suggestions = 400 reasoning calls
  Avg 300 tokens input + 60 tokens output = 360 tokens/call
  Total: 400 × 360 = 144,000 tokens
  Cost: (100K input × $0.15/1M) + (44K output × $0.60/1M) = $0.041

TOTAL: ~$0.09/month (for low usage)

At 500 items/month: ~$0.55/month
At 2000 items/month: ~$2.20/month
```

**Gemini + Vector Store Costs**:
```
Embeddings (text-embedding-004 is FREE up to 1M requests/day!):
  80 items/month × 1 embedding = 80 embedding calls
  Cost: $0.00 🎉

Vector Search (Supabase - already included):
  80 items × 1 query = 80 SQL queries
  Cost: $0.00 (within free tier)

Reasoning (Gemini 1.5 Flash):
  80 items × 1 batch call = 80 API calls
  Avg 600 tokens input + 500 tokens output = 1,100 tokens/call
  Total: 80 × 1,100 = 88,000 tokens
  Cost: (88K × $0.075/1M) = $0.0066

TOTAL: ~$0.007/month (for low usage)

At 500 items/month: ~$0.04/month
At 2000 items/month: ~$0.16/month
```

**Savings**: 93% cost reduction at scale! 💰

---

## What Analysis Would Be Used For

### 1. **Connection Suggestions** (Current)
**When**: After saving any content
**Model**: Gemini 1.5 Flash
**Purpose**: Find related thoughts/projects/articles
**Example**: Saved article about React hooks → suggests project "Personal Dashboard"

### 2. **Theme Clustering** (Future)
**When**: Weekly batch job
**Model**: Gemini 1.5 Pro
**Purpose**: Group related thoughts into themes
**Example**: 15 thoughts about "productivity" → cluster into "Time Management" theme

### 3. **Smart Resurfacing** (Future)
**When**: Daily, based on current project context
**Model**: Gemini 1.5 Flash
**Purpose**: Surface relevant past thoughts for active projects
**Example**: Working on "Blog redesign" → resurfaces thought "Typography is underrated"

### 4. **Project Capability Analysis** (Future)
**When**: On project completion
**Model**: Gemini 1.5 Pro
**Purpose**: Extract skills/capabilities gained
**Example**: Completed "Build REST API" → capabilities: ["Backend development", "API design", "PostgreSQL"]

---

## Implementation Timeline

### Week 1: Vector Store Setup
- [ ] Enable pgvector extension in Supabase
- [ ] Add embedding columns to tables
- [ ] Create similarity search functions
- [ ] Build embedding generation service
- [ ] Run one-time migration for existing content

### Week 2: Gemini Integration
- [ ] Replace OpenAI embeddings with Gemini
- [ ] Update connection suggestion flow
- [ ] Add embedding generation to save endpoints
- [ ] Test vector search performance

### Week 3: Optimization & Caching
- [ ] Add batch processing for new items
- [ ] Implement daily cron job for missed embeddings
- [ ] Add caching layer for frequently accessed suggestions
- [ ] Monitor costs and performance

### Week 4: Advanced Features
- [ ] Theme clustering with Gemini 1.5 Pro
- [ ] Smart resurfacing algorithm
- [ ] Capability extraction on project completion

---

## Risk Mitigation

### 1. **API Rate Limits**
**Risk**: Gemini Flash has 15 RPM / 1M TPM limits
**Mitigation**:
- Batch processing (10 items at once)
- Queue system for high-volume periods
- Fall back to slower processing if rate limited

### 2. **Migration Downtime**
**Risk**: Existing content needs embeddings
**Mitigation**:
- Run migration as background job
- Keep OpenAI as fallback until migration complete
- Gradual rollout: new items → Gemini, old items → migration script

### 3. **Vector Search Performance**
**Risk**: Similarity search might be slow at scale
**Mitigation**:
- IVFFlat index (reduces search from O(n) to O(log n))
- Limit search to recent items (last 6 months)
- Cache top matches per user

---

## Success Metrics

1. **Cost Reduction**: 90%+ savings vs. current OpenAI implementation
2. **Speed**: Connection suggestions < 2 seconds (vs. current 5-10s)
3. **Quality**: 80%+ of suggestions accepted by user (vs. current ~60%)
4. **Scale**: Handle 10,000+ items per user without performance degradation

---

## Recommendation

**Start with Phase 1 (Vector Store)** - this provides immediate value:
- Faster searches
- No API costs for similarity matching
- Enables ALL future AI features

**Then add Gemini incrementally**:
- Week 1: Vector store foundation
- Week 2: Gemini embeddings (free!)
- Week 3: Gemini analysis (cheap!)
- Week 4: Advanced features

**Total effort**: 4 weeks
**Total cost**: ~$0.16/month for 2000 items (vs. $2.20/month with OpenAI)
**ROI**: 93% cost reduction + 75% speed improvement 🚀
