# Canonical Tags System

## Overview

The canonical tags system provides **semantic tag normalization** for consistent categorization across memories. Instead of generating unique tags for every memory, the system uses AI-powered similarity matching to cluster related tags together.

## Problem Solved

**Before:**
- Every memory gets unique tags: "ML", "machine learning", "ML models", "artificial intelligence"
- No way to find all related content
- Tag explosion makes browsing useless

**After:**
- All variations map to canonical forms: "machine learning"
- Consistent vocabulary emerges naturally
- Can browse all memories about "machine learning" reliably

## Architecture

### Hybrid Approach (Recommended)

1. **Seed tags** (~80 high-quality tags across common domains)
2. **Semantic clustering** (new tags compared to existing using embeddings)
3. **Automatic aliasing** (variations stored as aliases for fast lookups)

### Database Schema

```sql
-- Master list of canonical tags
canonical_tags (
  id UUID,
  tag TEXT UNIQUE,
  category TEXT, -- Technology, Health, Business, Creative, Learning, Personal
  usage_count INTEGER, -- How many memories use this
  embedding VECTOR(768), -- For similarity matching
  is_seed BOOLEAN -- Predefined vs emergent tags
)

-- Alternative spellings that map to canonical tags
tag_aliases (
  id UUID,
  alias TEXT UNIQUE,
  canonical_tag_id UUID REFERENCES canonical_tags(id)
)
```

### Flow

1. **Memory created** → AI extracts 3-7 tags
2. **Normalization** → Each tag goes through:
   - Exact match check (fast)
   - Alias lookup (fast)
   - Embedding similarity (0.85+ threshold)
   - Create new canonical tag if no match
3. **Result** → Memory tagged with canonical forms
4. **Learning** → New aliases cached for future speed

## Setup

### 1. Run Migration

```sql
-- In your Supabase SQL editor:
\i migrations/002-canonical-tags.sql
```

This creates:
- `canonical_tags` table with 80 seed tags
- `tag_aliases` table
- Helper functions (`find_similar_tag`, `increment_tag_usage`)

### 2. Generate Seed Embeddings

```bash
# One-time initialization
curl -X POST https://your-app.vercel.app/api/init-tags
```

This generates embeddings for all seed tags (~80 API calls, takes ~10 seconds).

### 3. Done!

New memories will automatically normalize tags. The system learns and improves over time.

## Seed Tags (80 total)

### Technology (20)
programming, web development, mobile development, machine learning, artificial intelligence, data science, cloud computing, devops, security, databases, api design, frontend, backend, testing, design systems, performance optimization, automation, blockchain, networking, system architecture

### Health & Wellness (15)
fitness, nutrition, mental health, mindfulness, sleep, meditation, yoga, running, strength training, stretching, wellness, stress management, hydration, recovery, injury prevention

### Business & Career (15)
entrepreneurship, productivity, leadership, marketing, sales, strategy, negotiation, networking, time management, project management, remote work, communication, public speaking, career development, freelancing

### Creative (12)
writing, music, photography, design, art, filmmaking, drawing, painting, creativity, storytelling, crafts, content creation

### Learning (10)
education, reading, language learning, online courses, books, research, note-taking, study techniques, memory techniques, skills development

### Personal (8)
relationships, family, travel, hobbies, finance, home improvement, cooking, parenting

## Configuration

### Similarity Threshold

Default: **0.85** (very similar)

- Higher (0.90+) → More strict, creates more unique tags
- Lower (0.75-0.80) → More lenient, more clustering

Edit in `lib/tag-normalizer.ts:72`:

```typescript
const { data: similarTag } = await supabase
  .rpc('find_similar_tag', {
    query_embedding: embedding,
    similarity_threshold: 0.85 // Adjust here
  })
```

### Category Inference

New tags automatically categorized using Gemini:
- Technology
- Health
- Business
- Creative
- Learning
- Personal

Edit categories in `lib/tag-normalizer.ts:139` if needed.

## Examples

### Tag Normalization in Action

| Raw Tag | Canonical Tag | Match Type |
|---------|--------------|------------|
| "ML" | "machine learning" | Semantic (similarity: 0.92) |
| "React.js" | "web development" | Semantic (similarity: 0.87) |
| "React" | "web development" | Alias (cached from previous) |
| "mindful meditation" | "mindfulness" | Semantic (similarity: 0.89) |
| "quantum computing" | "quantum computing" | New canonical (no match found) |

### API Response

```json
{
  "memory": {
    "id": "...",
    "title": "Learning React hooks today",
    "tags": ["web development", "programming", "learning"]
    // Original AI extraction: ["React", "hooks", "JavaScript", "frontend dev"]
    // Normalized to canonical forms automatically
  }
}
```

## Benefits

### 1. Consistent Browsing
```sql
-- Find all memories about web development
SELECT * FROM memories WHERE 'web development' = ANY(tags);
-- Catches: React, Vue, Angular, HTML, CSS, frontend, etc.
```

### 2. Tag Analytics
```sql
-- Most popular topics
SELECT tag, usage_count
FROM canonical_tags
ORDER BY usage_count DESC
LIMIT 10;
```

### 3. Automatic Consolidation
- System learns user's vocabulary over time
- Popular variations become aliases
- No manual tag management needed

### 4. Cross-Memory Connections
- "Show me all machine learning memories" works reliably
- Project suggestions can cluster by canonical tags
- Timeline view can group by topic evolution

## Monitoring

### Check Tag Distribution

```sql
-- Tags by category
SELECT category, COUNT(*) as tag_count
FROM canonical_tags
GROUP BY category
ORDER BY tag_count DESC;

-- Most used tags
SELECT tag, usage_count, category
FROM canonical_tags
ORDER BY usage_count DESC
LIMIT 20;

-- Emergent (user-generated) tags
SELECT tag, usage_count, category
FROM canonical_tags
WHERE is_seed = false
ORDER BY usage_count DESC;
```

### View Aliases

```sql
-- See how tags are being mapped
SELECT
  ta.alias,
  ct.tag as canonical_tag,
  ct.usage_count
FROM tag_aliases ta
JOIN canonical_tags ct ON ct.id = ta.canonical_tag_id
ORDER BY ct.usage_count DESC;
```

## Maintenance

### Periodic Consolidation (Optional)

If you want to manually merge similar canonical tags:

```sql
-- Find similar canonical tags (cosine similarity > 0.90)
SELECT
  a.tag as tag1,
  b.tag as tag2,
  1 - (a.embedding <=> b.embedding) as similarity
FROM canonical_tags a, canonical_tags b
WHERE a.id < b.id
AND 1 - (a.embedding <=> b.embedding) > 0.90
ORDER BY similarity DESC;

-- Merge "react" into "web development"
-- 1. Move aliases
UPDATE tag_aliases SET canonical_tag_id = 'web-dev-uuid' WHERE canonical_tag_id = 'react-uuid';

-- 2. Update memories
UPDATE memories SET tags = array_replace(tags, 'react', 'web development');

-- 3. Delete old tag
DELETE FROM canonical_tags WHERE id = 'react-uuid';
```

## Future Enhancements

### Phase 2
- [ ] Tag hierarchies (parent/child relationships)
- [ ] Tag co-occurrence analysis (frequently paired tags)
- [ ] Synonym suggestions UI (merge similar tags)
- [ ] Tag search autocomplete (browse canonical vocabulary)

### Phase 3
- [ ] Custom user categories (beyond 6 default)
- [ ] Tag strength tracking (interest evolution over time)
- [ ] Smart tag suggestions based on memory content
- [ ] Tag-based memory clustering visualization

## Troubleshooting

### Tags not being normalized

1. Check seed embeddings were generated:
```sql
SELECT COUNT(*) as missing_embeddings
FROM canonical_tags
WHERE embedding IS NULL;
```

2. Check normalization logs:
```bash
# Search Vercel logs for:
# "Mapped tag to canonical form"
# "Created new canonical tag"
```

### Too many unique tags being created

- Lower similarity threshold to 0.80 (more clustering)
- Check if seed tags cover your domain
- Add more seed tags if needed:
```sql
INSERT INTO canonical_tags (tag, category, is_seed, usage_count)
VALUES ('your-new-tag', 'Technology', true, 0);
```

### Performance issues

- Tag normalization adds ~200-300ms per memory
- Cached aliases make subsequent matches instant
- Embeddings generated once per unique tag variation
- Consider batching if processing many memories at once

## Code References

- **Migration**: `migrations/002-canonical-tags.sql`
- **Normalizer**: `lib/tag-normalizer.ts`
- **Integration**: `lib/process-memory.ts:38`
- **Initialization**: `api/init-tags.ts`

## Questions?

- Similarity threshold too strict? Lower it to 0.80
- Want more categories? Add them to `inferCategory()`
- Need domain-specific tags? Add to seed data in migration
- Want to disable? Comment out line 38 in `process-memory.ts`
