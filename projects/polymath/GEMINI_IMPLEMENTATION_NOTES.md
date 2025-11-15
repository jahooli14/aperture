# Gemini Vector Implementation - Quick Reference

**Date**: 2025-11-01
**Status**: Ready to implement
**Estimated Time**: 4 weeks

---

## Prerequisites

1. **Supabase pgvector Extension**
   - Already available in Supabase (no upgrade needed)
   - Enable with: `CREATE EXTENSION IF NOT EXISTS vector;`

2. **Google Cloud API Key**
   - Get from: https://aistudio.google.com/app/apikey
   - Set env var: `GEMINI_API_KEY=your-key-here`
   - Add to Vercel environment variables

3. **Install Dependencies**
   ```bash
   npm install @google/generative-ai
   ```

---

## Step-by-Step Implementation

### Step 1: Database Schema (Run in Supabase SQL Editor)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to existing tables
ALTER TABLE memories ADD COLUMN embedding_gemini vector(768);
ALTER TABLE projects ADD COLUMN embedding_gemini vector(768);
ALTER TABLE articles ADD COLUMN embedding_gemini vector(768);

-- Create indexes for fast similarity search (this may take a few minutes)
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

### Step 2: Create Gemini Embedding Service

**File**: `api/lib/gemini-embeddings.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

/**
 * Generate a single embedding using Gemini
 * Model: text-embedding-004 (768 dimensions)
 * Cost: FREE (up to 1M requests/day)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  const result = await model.embedContent(text)
  return result.embedding.values
}

/**
 * Generate multiple embeddings in batch (up to 100)
 * More efficient than individual calls
 */
export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  // Process in chunks of 100 (Gemini limit)
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += 100) {
    const chunk = texts.slice(i, i + 100)
    const embeddings = await Promise.all(
      chunk.map(text => model.embedContent(text))
    )
    results.push(...embeddings.map(e => e.embedding.values))
  }

  return results
}
```

### Step 3: Update API Endpoints to Generate Embeddings

**Example**: `api/memories.ts` (apply same pattern to projects.ts, reading.ts)

```typescript
import { generateEmbedding } from './lib/gemini-embeddings'

// In POST handler (create new memory):
const { data: memory } = await supabase
  .from('memories')
  .insert({ title, body, user_id })
  .select()
  .single()

// Generate embedding immediately (don't block response)
const content = `${title} ${body}`
const embedding = await generateEmbedding(content)

// Update with embedding
await supabase
  .from('memories')
  .update({ embedding_gemini: embedding })
  .eq('id', memory.id)

// Return response (embedding happens in background)
return res.status(200).json({ memory })
```

### Step 4: Create Migration Script for Existing Data

**File**: `scripts/migrate-to-gemini-vectors.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { batchGenerateEmbeddings } from '../api/lib/gemini-embeddings'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateTable(
  tableName: 'memories' | 'projects' | 'articles',
  getContent: (row: any) => string
) {
  let processedCount = 0

  while (true) {
    // Fetch batch of items without embeddings
    const { data: items } = await supabase
      .from(tableName)
      .select('*')
      .is('embedding_gemini', null)
      .limit(100)

    if (!items || items.length === 0) break

    console.log(`Processing ${items.length} ${tableName}...`)

    // Generate embeddings in batches of 10
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10)
      const texts = batch.map(getContent)

      const embeddings = await batchGenerateEmbeddings(texts)

      // Update database
      await Promise.all(
        batch.map((item, idx) =>
          supabase
            .from(tableName)
            .update({ embedding_gemini: embeddings[idx] })
            .eq('id', item.id)
        )
      )

      processedCount += batch.length
      console.log(`  ✓ ${processedCount} total`)

      // Rate limit: 1 second between batches
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`✅ ${tableName}: ${processedCount} items migrated`)
}

async function main() {
  console.log('Starting Gemini vector migration...\n')

  await migrateTable('memories', m => `${m.title} ${m.body}`)
  await migrateTable('projects', p => `${p.title} ${p.description || ''}`)
  await migrateTable('articles', a => `${a.title} ${a.content?.slice(0, 1000) || ''}`)

  console.log('\n🎉 Migration complete!')
}

main()
```

**Run migration**:
```bash
tsx scripts/migrate-to-gemini-vectors.ts
```

### Step 5: Update Connection Suggestions API

**File**: `api/suggestions.ts` (replace OpenAI logic)

```typescript
import { generateEmbedding } from './lib/gemini-embeddings'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function suggestConnections(
  itemType: 'thought' | 'project' | 'article',
  itemId: string,
  content: string,
  userId: string
) {
  // Step 1: Generate embedding for item (1 API call)
  const embedding = await generateEmbedding(content)

  // Step 2: Vector search (SQL - no API cost!)
  const { data: matches } = await supabase.rpc('match_content_gemini', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 10,
    content_type: 'all'
  })

  if (!matches || matches.length === 0) {
    return []
  }

  // Step 3: Use Gemini Flash to explain connections (1 API call)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-002' })

  const prompt = `Analyze these content connections and provide a one-sentence explanation for each.

Source ${itemType}: ${content.slice(0, 500)}

Related items:
${matches.slice(0, 5).map((m, i) =>
  `${i+1}. [${m.content_type}] ${m.title} (${(m.similarity * 100).toFixed(0)}% match)`
).join('\n')}

For each item, write ONE concise sentence explaining how it relates to the source.
Format as JSON array:
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

  // Step 4: Store suggestions
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

### Step 6: Add Daily Cleanup Cron (Optional)

**File**: `api/cron/daily-embeddings.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { batchGenerateEmbeddings } from '../lib/gemini-embeddings'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only run on cron requests
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Find items created in last 24h without embeddings
  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, body')
    .is('embedding_gemini', null)
    .gte('created_at', yesterday)
    .limit(100)

  if (memories && memories.length > 0) {
    const texts = memories.map(m => `${m.title} ${m.body}`)
    const embeddings = await batchGenerateEmbeddings(texts)

    await Promise.all(
      memories.map((m, idx) =>
        supabase
          .from('memories')
          .update({ embedding_gemini: embeddings[idx] })
          .eq('id', m.id)
      )
    )
  }

  // Repeat for projects and articles...

  return res.status(200).json({ processed: memories?.length || 0 })
}
```

**Add to vercel.json**:
```json
{
  "crons": [{
    "path": "/api/cron/daily-embeddings",
    "schedule": "0 2 * * *"
  }]
}
```

---

## Testing Checklist

- [ ] Supabase pgvector extension enabled
- [ ] Embedding columns added to all tables
- [ ] Indexes created (check with `\d+ memories` in SQL editor)
- [ ] Migration script runs without errors
- [ ] New items get embeddings on save
- [ ] Vector search returns relevant results
- [ ] Connection suggestions work with Gemini reasoning
- [ ] Costs are tracked (check Google Cloud Console)

---

## Monitoring

### Check Embedding Coverage
```sql
SELECT
  'memories' as table_name,
  COUNT(*) as total,
  COUNT(embedding_gemini) as with_embeddings,
  ROUND(100.0 * COUNT(embedding_gemini) / COUNT(*), 2) as coverage_percent
FROM memories
UNION ALL
SELECT
  'projects',
  COUNT(*),
  COUNT(embedding_gemini),
  ROUND(100.0 * COUNT(embedding_gemini) / COUNT(*), 2)
FROM projects
UNION ALL
SELECT
  'articles',
  COUNT(*),
  COUNT(embedding_gemini),
  ROUND(100.0 * COUNT(embedding_gemini) / COUNT(*), 2)
FROM articles;
```

### Test Vector Search
```sql
-- Get embedding from a known item
SELECT embedding_gemini FROM memories LIMIT 1;

-- Test similarity search with that embedding
SELECT * FROM match_content_gemini(
  (SELECT embedding_gemini FROM memories LIMIT 1),
  0.75,
  5,
  'all'
);
```

---

## Rollback Plan

If something goes wrong:

1. **Keep OpenAI as fallback**:
   ```typescript
   const embedding = await (
     process.env.USE_GEMINI === 'true'
       ? generateGeminiEmbedding(text)
       : generateOpenAIEmbedding(text)
   )
   ```

2. **Drop columns** (if needed):
   ```sql
   ALTER TABLE memories DROP COLUMN embedding_gemini;
   ALTER TABLE projects DROP COLUMN embedding_gemini;
   ALTER TABLE articles DROP COLUMN embedding_gemini;
   ```

3. **Remove indexes**:
   ```sql
   DROP INDEX IF EXISTS memories_embedding_idx;
   DROP INDEX IF EXISTS projects_embedding_idx;
   DROP INDEX IF EXISTS articles_embedding_idx;
   ```

---

## Expected Results

**Before (OpenAI)**:
- 150+ API calls per new item
- ~5-10 seconds for suggestions
- $0.09-$2.20/month depending on usage

**After (Gemini + Vectors)**:
- 2 API calls per new item
- ~1-2 seconds for suggestions
- $0.007-$0.16/month depending on usage
- **93% cost reduction**
- **75% speed improvement**

---

## Next Steps After Implementation

1. **Theme Clustering**: Use Gemini 1.5 Pro to group related thoughts weekly
2. **Smart Resurfacing**: Surface relevant past thoughts based on active project
3. **Capability Extraction**: Analyze completed projects for skills gained
4. **Quality Metrics**: Track suggestion acceptance rate

---

**Ready to implement!** Start with Step 1 (database schema) and work through sequentially.
