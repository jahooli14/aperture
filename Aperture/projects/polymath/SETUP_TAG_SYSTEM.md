# Tag Normalization System - Setup Guide

Quick setup guide for the semantic tag normalization system.

## Prerequisites

- Supabase project with pgvector extension enabled
- Environment variables configured (`.env.local` or `.env.production.local`)

## Setup Steps

### 1. Enable pgvector Extension

In your Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Or** use the UI: Dashboard → Database → Extensions → Enable "pgvector"

### 2. Run Database Migrations

Run these in order in your Supabase SQL Editor:

```sql
-- migrations/000-enable-vector.sql (if you didn't use the UI in step 1)
CREATE EXTENSION IF NOT EXISTS vector;

-- migrations/001-initial-schema.sql
-- (Run the entire file - creates memories, projects, entities tables)

-- migrations/002-canonical-tags.sql
-- (Run the entire file - creates canonical_tags and tag_aliases tables)
```

### 3. Generate Seed Tag Embeddings

In your terminal, from the polymath project root:

```bash
npx tsx scripts/init-seed-embeddings.ts
```

You should see:
```
🚀 Starting seed tag embedding generation...
[info] Generating embeddings for seed tags...
[info] (80): Processing seed tags
...
✅ Success! All seed tags now have embeddings.
🎉 Tag normalization system is ready to use!
```

**Troubleshooting:**
- If you get env variable errors, make sure `.env.local` or `.env.production.local` exists with:
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
- If you get "table not found", wait 2-3 minutes for Supabase schema cache to refresh

### 4. Verify Setup

Check that seed tags have embeddings:

```sql
SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings
FROM canonical_tags
WHERE is_seed = true;
```

Should show: `total: 80, with_embeddings: 80`

### 5. Test It!

Create a test voice note with tags like "React", "ML", "fitness routine"

Then check the normalized tags:

```sql
SELECT title, tags
FROM memories
ORDER BY created_at DESC
LIMIT 5;
```

You should see canonical forms like `["web development", "machine learning", "fitness"]`

## What Happens Next

Every new voice capture will automatically:
1. Extract 3-7 tags using AI
2. Normalize them to canonical forms via semantic similarity
3. Store the normalized tags
4. Cache aliases for future fast lookups

## Monitoring

### Popular Tags
```sql
SELECT tag, usage_count, category
FROM canonical_tags
ORDER BY usage_count DESC
LIMIT 20;
```

### Recent Aliases Created
```sql
SELECT ta.alias, ct.tag as canonical_tag
FROM tag_aliases ta
JOIN canonical_tags ct ON ct.id = ta.canonical_tag_id
ORDER BY ta.created_at DESC
LIMIT 20;
```

### User-Generated Tags
```sql
SELECT tag, usage_count, category
FROM canonical_tags
WHERE is_seed = false
ORDER BY created_at DESC
LIMIT 20;
```

## Configuration

### Adjust Similarity Threshold

Edit `lib/tag-normalizer.ts:72`:

```typescript
similarity_threshold: 0.85 // Higher = stricter, Lower = more clustering
```

### Add More Seed Tags

```sql
INSERT INTO canonical_tags (tag, category, is_seed, usage_count)
VALUES ('your-new-tag', 'Technology', true, 0);
```

Then generate embedding:
```bash
npx tsx scripts/init-seed-embeddings.ts
```

## Files Reference

- **Migration**: `migrations/002-canonical-tags.sql`
- **Normalizer Logic**: `lib/tag-normalizer.ts`
- **Integration**: `lib/process-memory.ts` (line 38)
- **Setup Script**: `scripts/init-seed-embeddings.ts`
- **Full Documentation**: `CANONICAL_TAGS_SYSTEM.md`

## Support

If tags aren't normalizing:
1. Check seed embeddings were generated (query above)
2. Check logs for "Mapped tag to canonical form" or "Created new canonical tag"
3. Verify `lib/process-memory.ts:38` calls `normalizeTags()`
4. Try lowering similarity threshold to 0.80 for more aggressive clustering

## Complete!

Your tag system is now live. Tags will normalize automatically on every new voice capture.
