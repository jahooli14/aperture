# Idea Engine

An always-on evolutionary ideation engine that generates, scores, and evolves ideas at the intersections of human knowledge domains — autonomously, 24/7, at low cost.

---

## What It Does

Every 50 minutes:
1. **Samples** a domain pair (neuroscience × ML, thermodynamics × economics, etc.)
2. **Selects** a frontier mode (Translate, Tool Transfer, Assumption Audit, Analogy Mine, Compression, Inversion)
3. **Generates** an idea using Gemini 3.1 Flash-Lite
4. **Scores** on novelty, cross-domain distance, tractability
5. **Deduplicates** using pgvector semantic search
6. **Stores** if it passes filters (~33% pass rate)

Every week (Mon/Thu):
1. **Reviews** ~40 pending ideas with Claude Opus
2. **Categorizes** as BUILD / SPARK / REJECT
3. **Extracts** rejection patterns (negative selection)
4. **Creates** frontier blocks for high-FAS approved ideas (FAS > 0.7)
5. **Evolves** next generation based on feedback

The system learns over time what kinds of ideas get approved and adjusts domain/mode selection accordingly, while maintaining 30% forced exploration to prevent local optima.

---

## Key Features

### Evolutionary Pressure
- **Negative selection:** Rejection reasons penalize failing domain pairs/modes
- **Positive selection:** Approved ideas spawn follow-up generations
- **Surprise rewards:** Unexpected approvals get amplified
- **Mode collapse detection:** Entropy monitoring forces diversity

### Frontier Advancement
- Tracks which ideas genuinely advance the frontier (not just "good ideas")
- Creates frontier blocks for FAS > 0.7 ideas
- Maintains lineage tracking (genealogy of ideas)
- Extracts abstract patterns for future mutation

### Six Frontier Modes
1. **Translate** — Express concept from domain A in domain B's language
2. **Tool Transfer** — Apply A's methodology to B's unsolved problem
3. **Assumption Audit** — Question A's foundations using B's insights
4. **Analogy Mine** — Find structural isomorphism between solved (A) and unsolved (B)
5. **Compression** — Unify separate phenomena under single principle
6. **Inversion** — Flip A's consensus, check if B has counter-evidence

---

## Architecture

```
GitHub Actions (cron: */50 * * * *)
  └─> Vercel API: /api/idea-engine/generate
      └─> Gemini 3.1 Flash-Lite (agent + pre-filter)
      └─> Supabase (pgvector storage + dedup)

GitHub Actions (cron: Mon/Thu 9am)
  └─> Vercel API: /api/idea-engine/review
      └─> Claude Opus (batch review)
      └─> Supabase (update statuses, create frontier blocks)

Vercel Frontend: /ideas
  └─> React page (read-only, filters by status)
```

**Cost:** $2.37/month (API calls) + $0 infrastructure

---

## Project Structure

```
projects/idea-engine/
├── README.md                     # This file
├── SETUP.md                      # Deployment guide
├── VARIABLES_NEEDED.md           # What you need to provide
├── config/
│   ├── domains.json              # 20 domains × 5 concepts
│   ├── frontier-modes.json       # 6 mode prompt templates
│   └── seed-ideas.json           # 15 cold-start examples
├── src/
│   ├── lib/
│   │   ├── types.ts              # TypeScript types
│   │   ├── supabase.ts           # DB client
│   │   ├── domain-sampler.ts     # Weighted domain pair selection
│   │   ├── mode-selector.ts      # Entropy-tracked mode selection
│   │   ├── gemini-client.ts      # Gemini API with retry logic
│   │   ├── deduplication.ts      # pgvector similarity search
│   │   ├── frontier-advancement.ts # FAS calculation
│   │   └── feedback-summarizer.ts  # 3-week feedback compression
│   └── pages/
│       └── IdeasPage.tsx         # React frontend
├── supabase/
│   └── migrations/
│       └── 20260402000001_create_idea_engine_schema.sql
└── api/ (in polymath/)
    └── idea-engine/
        ├── generate.ts           # Generation endpoint
        └── review.ts             # Opus review endpoint

.github/workflows/
├── idea-engine-generate.yml      # Cron: every 50 min
└── idea-engine-review.yml        # Cron: Mon/Thu 9am
```

---

## Database Schema

11 tables (all prefixed with `ie_` to avoid Polymath conflicts):

| Table | Purpose |
|-------|---------|
| `ie_ideas` | All generated ideas |
| `ie_frontier_blocks` | High-FAS approved ideas |
| `ie_domains` | Domain taxonomy (20 domains) |
| `ie_domain_pairs` | Explored pairs + success rates |
| `ie_rejection_patterns` | Negative selection tracking |
| `ie_evolutionary_feedback` | Review cycle history |
| `ie_lineage_edges` | Parent-child idea relationships |
| `ie_generation_batches` | Batch tracking |
| `ie_mode_stats` | Mode usage + success rates |
| `ie_seed_ideas` | Cold-start examples |
| `ie_feedback_summaries` | Compressed feedback for prompts |

---

## Cost Breakdown

Monthly costs at 29 ideas/day, 2x/week Opus review:

| Service | Usage | Cost |
|---------|-------|------|
| Gemini Flash-Lite (generation) | 870 calls | $0.50 |
| Gemini Flash-Lite (pre-filter) | 870 calls | $0.15 |
| Claude Opus (review) | 8 reviews × ~40 ideas | $1.71 |
| **API Total** | | **$2.36** |
| Vercel (serverless + frontend) | <1 GB-hour | $0 |
| Supabase (database + pgvector) | <50MB | $0 |
| GitHub Actions (cron) | ~450 min | $0 |
| **Infrastructure Total** | | **$0** |
| **Grand Total** | | **$2.36/mo** |

6x under the $15 budget. Room to scale to 6x more ideas if needed.

---

## Quick Start

### 1. Prerequisites
- Gemini API key (Google AI Studio)
- Anthropic API key (Claude console)
- Supabase user ID (from Polymath)
- Vercel deployment (using Polymath)

### 2. Setup
```bash
# Run SQL migration in Supabase
# (see SETUP.md step 1)

# Add environment variables to Vercel
# (see SETUP.md step 3)

# Add GitHub secrets
# (see SETUP.md step 4)

# Deploy
git add . && git commit -m "Add idea-engine" && git push
```

### 3. Initialize
```bash
# Manual trigger to test
curl -X POST https://your-project.vercel.app/api/idea-engine/generate \
  -H "Authorization: Bearer YOUR_SECRET"
```

### 4. View Ideas
```
https://your-project.vercel.app/ideas
```

Full instructions in **[SETUP.md](./SETUP.md)**

---

## Configuration Options

### Adjust Generation Frequency
Edit `.github/workflows/idea-engine-generate.yml`:
```yaml
schedule:
  - cron: '*/50 * * * *'  # Change to */30 for 30min, etc.
```

### Adjust Review Frequency
Edit `.github/workflows/idea-engine-review.yml`:
```yaml
schedule:
  - cron: '0 9 * * 1,4'  # Mon/Thu 9am
```

### Tune Pre-filter Pass Rate
Edit `api/idea-engine/generate.ts`:
```typescript
const PREFILTER_THRESHOLD = 0.55; // Lower = more pass
```

### Change Deduplication Strictness
Edit `src/lib/deduplication.ts`:
```typescript
similarityThreshold: number = 0.88  // Higher = stricter
```

---

## Monitoring

### Check System Health
```bash
# Recent batches
curl https://your-domain.vercel.app/api/idea-engine/status \
  -H "Authorization: Bearer YOUR_SECRET"
```

### Check Mode Entropy (Collapse Detection)
```sql
SELECT calculate_mode_entropy('your-user-id');
-- Should be 0.6-1.0
-- Below 0.6 = mode collapse (forced exploration activates)
```

### View Frontier Blocks
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

## How It Evolves

### Week 1 (Cold Start)
- Uses seed ideas as reference
- Uniform random mode/domain selection
- Learns from first Opus reviews

### Week 2-4 (Learning)
- Builds rejection pattern database
- Identifies successful domain pairs/modes
- Starts avoiding bad patterns

### Month 2+ (Evolved)
- Modes weighted by success rate
- Domain pairs biased toward successful combos
- 30% forced exploration prevents stagnation
- Frontier blocks spawn follow-up mutations
- Feedback summaries compress 3 weeks → 250 tokens

### Key Metrics to Track
1. **Approval rate** (should trend up as system learns)
2. **Mode entropy** (should stay >0.6)
3. **Frontier block count** (2-3/month = healthy)
4. **Lineage depth** (ideas building on ideas, >3 generations)

---

## Next Steps

1. **Fill out [VARIABLES_NEEDED.md](./VARIABLES_NEEDED.md)**
   - API keys
   - User ID
   - Delivery preferences

2. **Run setup from [SETUP.md](./SETUP.md)**
   - Database migration
   - Environment variables
   - Deploy to Vercel

3. **Wait 24-48 hours** for first batch to accumulate

4. **Run first Opus review** (manual or wait for cron)

5. **Check approved ideas** on `/ideas` page

6. **Monitor evolution** via mode entropy and frontier blocks

---

## Philosophy

This isn't a "random idea generator." It's an evolutionary system:

- **Volume ≠ Goal:** Type diversity (different cognitive moves) > topic diversity
- **Frontier modes matter:** The six modes exist because valuable ideas come from specific operations (translation, tool transfer, etc.) that brute-force combination doesn't produce
- **Learning is key:** Opus rejection reasons teach the system what frontier moves look like
- **Building blocks:** Approved ideas become seeds for future generations
- **Genuine shifts:** FAS > 0.7 ideas genuinely advance the frontier, not just "interesting thoughts"

The system optimizes for **frontier advancement per generation**, not just approval rate.

---

## Support

- **Setup issues:** See [SETUP.md](./SETUP.md)
- **Variables needed:** See [VARIABLES_NEEDED.md](./VARIABLES_NEEDED.md)
- **Vercel logs:** Dashboard > Deployments > Functions > Logs
- **Supabase logs:** Dashboard > Logs
- **GitHub Actions:** Repo > Actions > Workflow runs

---

**Built:** April 2026
**Cost:** $2.36/month
**Status:** Production-ready
**Next:** Fill out variables and deploy
