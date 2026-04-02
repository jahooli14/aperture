
# Idea Engine - Setup Guide

An always-on evolutionary ideation engine that generates, scores, and evolves ideas at the intersections of human knowledge domains.

---

## Architecture Overview

- **Generation**: Gemini 3.1 Flash-Lite agents (1 every 50 min = ~29 ideas/day)
- **Pre-filter**: Flash-Lite scoring on novelty/distance/tractability (33% pass rate)
- **Storage**: PostgreSQL + pgvector (shared with Polymath)
- **Review**: Claude Opus 2x/week (Mon/Thu) for frontier filtering
- **Cost**: ~$2.37/month API costs + $0 infrastructure (Vercel + Supabase free tiers)

---

## Prerequisites

1. **Supabase account** (using Polymath's existing project)
2. **Vercel account** (using existing Polymath deployment)
3. **Gemini API key** (Google AI Studio)
4. **Anthropic API key** (for Opus reviews)
5. **GitHub repo** (for Actions cron)

---

## Step 1: Database Setup

### Run SQL Migration

The idea-engine tables use the `ie_` prefix to avoid conflicts with Polymath.

```bash
# Navigate to Polymath Supabase dashboard
# SQL Editor > New Query > Paste contents of:
projects/idea-engine/supabase/migrations/20260402000001_create_idea_engine_schema.sql

# Execute the migration
```

This creates 11 tables:
- `ie_ideas` - All generated ideas
- `ie_frontier_blocks` - High-value approved ideas
- `ie_domains` - Domain taxonomy (20 domains)
- `ie_domain_pairs` - Tracks explored domain pairs
- `ie_rejection_patterns` - Negative selection
- `ie_evolutionary_feedback` - Review cycle tracking
- `ie_lineage_edges` - Parent-child relationships
- `ie_generation_batches` - Batch tracking
- `ie_mode_stats` - Frontier mode usage
- `ie_seed_ideas` - Cold-start examples
- `ie_feedback_summaries` - Compressed feedback

### Verify Tables

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'ie_%';
```

You should see 11 tables.

---

## Step 2: Seed Data

### Load Domains

```bash
# Insert domains from config/domains.json
# Run this SQL in Supabase:
```

```sql
INSERT INTO ie_domains (domain_id, name, description, concepts)
SELECT
  (value->>'id')::text,
  (value->>'name')::text,
  (value->>'description')::text,
  ARRAY(SELECT jsonb_array_elements_text(value->'concepts'))
FROM jsonb_array_elements('[
  {
    "id": "neuroscience",
    "name": "Neuroscience",
    "description": "Study of nervous systems, neurons, and brain function",
    "concepts": ["Synaptic plasticity", "Neural oscillations", "Distributed representation", "Dendritic computation", "Metaplasticity"]
  },
  ... (copy from config/domains.json)
]'::jsonb);
```

### Load Seed Ideas

```bash
# Insert seed ideas from config/seed-ideas.json
# Run this SQL in Supabase:
```

```sql
INSERT INTO ie_seed_ideas (title, description, reasoning, frontier_mode, domain_pair, quality_rating)
SELECT
  (value->>'title')::text,
  (value->>'description')::text,
  (value->>'reasoning')::text,
  (value->>'frontier_mode')::text,
  ARRAY(SELECT jsonb_array_elements_text(value->'domain_pair')),
  (value->>'quality_rating')::int
FROM jsonb_array_elements('[
  ... (copy from config/seed-ideas.json)
]'::jsonb);
```

---

## Step 3: Environment Variables

### Vercel Environment Variables

Go to Vercel Dashboard > Your Project > Settings > Environment Variables

Add the following:

```bash
# Supabase (already set for Polymath)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Anthropic API
ANTHROPIC_API_KEY=your-anthropic-api-key

# Idea Engine Config
IDEA_ENGINE_USER_ID=your-user-id-from-supabase-auth
IDEA_ENGINE_SECRET=generate-random-secret-here

# Vercel Domain (for GitHub Actions)
VERCEL_DOMAIN=your-project.vercel.app
```

To generate `IDEA_ENGINE_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4: GitHub Secrets

Go to GitHub Repo > Settings > Secrets and variables > Actions

Add these secrets:

```
VERCEL_DOMAIN=your-project.vercel.app
IDEA_ENGINE_SECRET=same-secret-as-vercel
```

---

## Step 5: Initialize User Data

Run these initialization functions once per user:

```bash
# Option A: Via Vercel API route (recommended)
curl -X POST https://your-project.vercel.app/api/idea-engine/init \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json"

# Option B: Manually in Supabase SQL Editor
```

```sql
-- Initialize domain pairs
SELECT init_domain_pairs('your-user-id');

-- Initialize mode stats
SELECT init_mode_stats('your-user-id');
```

---

## Step 6: Deploy

### Deploy to Vercel

```bash
cd ~/Aperture/projects/polymath
git add .
git commit -m "Add idea-engine"
git push

# Vercel will auto-deploy
```

### Enable GitHub Actions

GitHub Actions are automatically enabled. Verify:

1. Go to GitHub Repo > Actions
2. You should see two workflows:
   - "Idea Engine - Generate" (runs every 50 min)
   - "Idea Engine - Opus Review" (runs Mon/Thu 9am UTC)

### Manual Trigger (Test)

```bash
# Test generation endpoint
curl -X POST https://your-project.vercel.app/api/idea-engine/generate \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json"

# Should return:
# {"success": true, "passed_filter": true, "stored": true, ...}
```

---

## Step 7: View Ideas

### Option A: Frontend (React)

Navigate to:
```
https://your-project.vercel.app/ideas
```

You should see the Ideas page with filters for:
- All
- Approved
- Spark
- Pending

### Option B: Supabase Dashboard

```sql
SELECT
  title,
  status,
  domain_pair,
  frontier_mode,
  prefilter_score,
  created_at
FROM ie_ideas
ORDER BY created_at DESC
LIMIT 20;
```

---

## Monitoring

### Check Generation Health

```bash
# See recent batches
curl https://your-project.vercel.app/api/idea-engine/status \
  -H "Authorization: Bearer YOUR_SECRET"
```

### Check GitHub Actions

Go to GitHub > Actions to see cron job execution history.

### Supabase Logs

Check Supabase Dashboard > Logs for any database errors.

---

## Adjusting Parameters

### Generation Frequency

Edit `.github/workflows/idea-engine-generate.yml`:

```yaml
schedule:
  - cron: '*/50 * * * *'  # Change to */30 for every 30 min, etc.
```

### Review Frequency

Edit `.github/workflows/idea-engine-review.yml`:

```yaml
schedule:
  - cron: '0 9 * * 1,4'  # Mon/Thu 9am
  # Change to '0 9 * * *' for daily
```

### Pre-filter Pass Rate

Edit `api/idea-engine/generate.ts`:

```typescript
const PREFILTER_THRESHOLD = 0.55; // Lower = more ideas pass (33% pass rate)
// 0.50 = ~40% pass rate
// 0.60 = ~25% pass rate
```

### Similarity Threshold (Deduplication)

Edit `src/lib/deduplication.ts`:

```typescript
export async function checkDuplicate(
  userId: string,
  embedding: number[],
  similarityThreshold: number = 0.88  // Change this
): Promise<DuplicateCheck>
```

Higher = stricter deduplication (fewer ideas stored)

---

## Troubleshooting

### "No pending ideas to review"

This is normal if generation hasn't run enough times yet. Wait for ~10-20 generations (8-16 hours) before first review.

### "Embedding generation placeholder warning"

The system currently uses placeholder embeddings. To enable real deduplication:

1. Deploy a sentence-transformers Python service (e.g., on Railway)
2. Update `src/lib/deduplication.ts` to call your embedding service
3. Or use OpenAI embeddings API

### "Opus review failed"

Check Anthropic API key and quota. Opus reviews cost ~$1.71/month with 2x/week cadence.

### "GitHub Actions not triggering"

- Ensure repo is public OR you have GitHub Actions minutes
- Check Settings > Actions > General > Allow all actions
- Verify secrets are set correctly

---

## Cost Breakdown

**Monthly costs:**

| Service | Usage | Cost |
|---------|-------|------|
| Gemini Flash-Lite (generation) | 870 calls | $0.50 |
| Gemini Flash-Lite (pre-filter) | 870 calls | $0.15 |
| Claude Opus (review) | 8 reviews | $1.71 |
| Vercel (hosting) | <1 GB-hour | $0 |
| Supabase (database) | <50MB | $0 |
| GitHub Actions (cron) | ~450 min | $0 |
| **Total** | | **$2.36/mo** |

---

## Next Steps

1. **Wait 24 hours** for first batch of ideas to accumulate
2. **Run first Opus review** manually (or wait for Mon/Thu cron)
3. **Check approved ideas** on frontend
4. **Monitor mode entropy** to ensure diversity:

```sql
SELECT calculate_mode_entropy('your-user-id');
-- Should return 0.6-1.0 (healthy)
-- Below 0.6 = mode collapse (forced exploration will kick in)
```

5. **Review frontier blocks**:

```sql
SELECT
  concept_name,
  frontier_advancement_score,
  spawn_count,
  status
FROM ie_frontier_blocks
ORDER BY frontier_advancement_score DESC;
```

---

## Questions to Answer

1. **How do you want to receive approved ideas?**
   - Option A: Check website manually
   - Option B: Weekly email digest
   - Option C: Slack/Discord notification
   - Option D: Daily summary

2. **Delivery format:**
   - Just titles?
   - Full descriptions?
   - Only frontier blocks (FAS > 0.7)?

3. **Notification triggers:**
   - After each Opus review?
   - Only when frontier block is created?
   - Daily digest at specific time?

4. **Email/notification setup needed:**
   - Your email address?
   - Preferred notification service (SendGrid, Resend, Discord webhook)?

---

## Support

- Check logs: Vercel Dashboard > Deployments > Functions > Logs
- Database: Supabase Dashboard > SQL Editor
- GitHub Actions: Repo > Actions > Workflow runs
- API test: `curl https://your-domain.vercel.app/api/idea-engine/health`

---

**You're all set!** The system will now:
- Generate 1 idea every 50 minutes (~29/day)
- Pre-filter to ~33% pass rate (~10/day stored)
- Review 2x/week with Opus (~40 ideas/review)
- Create frontier blocks for FAS > 0.7 ideas
- Track rejection patterns and evolve over time
