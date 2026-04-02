# Frontier Modes Integration with Existing Polymath Systems

How the 6 frontier modes fit into Polymath's existing architecture.

---

## Current Polymath Synthesis Pipeline

```
User Input (voice/text/reading)
  ↓
Memory Extraction (process-memory.ts)
  - Entities, themes, capabilities identified
  ↓
Synthesis Engine (synthesis.ts)
  - Generates project ideas from capability combinations
  - Scores by novelty (0.7-1.0), feasibility (hardcoded), interest (embedding similarity)
  - Constraint modes: one-skill, quick, stretch, analog, opposite
  ↓
Suggestions (project_suggestions table)
  - Stored with novelty_score, feasibility_score, interest_score
  - Pre-filtered by novelty threshold
  ↓
User Feedback (rate: spark/meh/built)
  - Only tells synthesis engine "don't repeat this"
  - Does NOT adjust weights
```

**Weakness:** The system generates but never learns. Novelty scores are semi-random. User feedback is binary.

---

## Frontier Modes: How They Augment Synthesis

```
User Input
  ↓
Memory Extraction (existing)
  ↓
FRONTIER MODES (new layer)
  - 6 modes force specific cognitive operations
  - Each mode generates ideas from novel domain pairings
  - Ideas pre-filtered by novelty/distance/tractability rubric
  ↓
SYNTHESIS ENGINE (existing)
  - Continues to generate constraint-based ideas
  - Now receives feedback summary from frontier results
  ↓
Suggestions (expanded schema)
  - frontier_mode: true/false
  - source_domain, target_domain, cross_domain_distance
  - rejection_reason (for learning)
  ↓
OPUS REVIEW (new layer)
  - Weekly batch evaluation of frontier ideas
  - Verdicts: BUILD / SPARK / REJECT
  ↓
Feedback Loop (enhanced)
  - Tracks rejections: unclear_reasoning, too_incremental, etc.
  - Compresses feedback into mode summaries
  - Next run uses compressed feedback (30% exploration override)
  ↓
User Engagement
  - Frontier ideas in suggestions feed
  - Weekly Opus verdicts visible to user
  - Analytics: entropy, spark rate per mode, novelty trends
```

---

## Integration Points: File-by-File

### New Files to Create

| File | Purpose | Dependencies |
|------|---------|--------------|
| `api/_lib/frontier-modes.ts` | FrontierModeConfig for all 6 modes | MODELS, optimization-config |
| `api/_lib/feedback-summarizer.ts` | Compress 3 weeks of signals | supabase |
| `api/_lib/pre-filter-scorer.ts` | Score ideas on novelty/distance/tractability | gemini-embeddings |
| `api/_lib/opus-reviewer.ts` | Weekly batch reviews | MODELS (opus) |
| `api/frontier/generate-ideas.ts` | Main orchestrator | All of above |
| `api/cron/weekly-opus-review.ts` | Weekly scheduler | opus-reviewer |
| `lib/frontier/types.ts` | TypeScript interfaces | - |

### Modified Files

| File | Change | Reason |
|------|--------|--------|
| `api/_lib/synthesis.ts` | Inject `feedbackSummary` into prompt | Synthesis engine learns from frontier feedback |
| `api/_lib/bedtime-ideas.ts` | Reference frontier modes for domain bridging | Bedtime prompts can mention frontier ideas as catalysts |
| `migrations/XXX-frontier-schema.sql` | Add frontier_rejections, frontier_acceptances tables | Track feedback signals |
| `types.ts` | Extend ProjectSuggestion with frontier fields | Include source_domain, target_domain, etc. |
| `supabase/schema.sql` | Add RLS policies for frontier tables | Ensure user privacy |

### Untouched (Existing Strong Design)

| System | Why It Works |
|--------|-------------|
| **Voice capture** | Already streams interim results and shows processing state |
| **Bedtime prompts** | Already does cross-pollination; frontier modes enhance it |
| **Embedding generation** | Already computes 768-dim embeddings for memories/articles |
| **Synthesis scoring** | Already has novelty/feasibility/interest; frontier adds domain distance |
| **DataSynchronizer** | Already runs on cron; can trigger frontier generation |
| **Zustand stores** | Can store frontier ideas same way as regular suggestions |

---

## API Contract: How Frontier Modes Fit

### New Endpoint: POST /api/frontier/generate

```typescript
// Request
{
  userId: string
  mode?: 'Translate' | 'ToolTransfer' | 'AssumptionAudit' | 'AnalogyMine' | 'Compression' | 'Inversion'
  forceExploration?: boolean  // Ignore feedback
  domainA?: string  // Optional: specify domains
  domainB?: string
}

// Response
{
  success: boolean
  ideas: [{
    id: string
    title: string
    description: string
    reasoning: string
    mode: string
    source_domain: string
    target_domain: string
    pre_filter_scores: {
      novelty_score: 0.72
      cross_domain_distance: 0.68
      tractability_score: 0.65
      overall_frontier_score: 0.68
      should_reject: false
    }
    status: 'accepted' | 'rejected'
  }]
  feedback_summary: string  // What the system learned this week
  is_exploration_run: boolean
}
```

### Integration into Existing Suggestions Feed

Frontier ideas land in the same `project_suggestions` table:

```sql
INSERT INTO project_suggestions (user_id, title, description, reasoning, novelty_score, feasibility_score, interest_score, frontier_mode, source_domain, target_domain)
VALUES (...)
```

They're then served through the existing suggestions UI components with a "Frontier Mode" badge.

---

## Database Schema: Minimal Additions

### Three New Tables (50 lines total SQL)

```sql
-- Rejection signals (what the user/system rejected and why)
CREATE TABLE frontier_rejections (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  idea_id UUID REFERENCES project_suggestions,
  mode TEXT NOT NULL,  -- Translate, ToolTransfer, etc.
  novelty_score FLOAT,
  rejection_reason TEXT NOT NULL,  -- unclear_reasoning, too_incremental, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Acceptance signals (what sparked/was built)
CREATE TABLE frontier_acceptances (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  idea_id UUID REFERENCES project_suggestions,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,  -- sparked, built, shelved
  user_energy_gain INT,  -- -5 to +5
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generation logs (metadata for analytics)
CREATE TABLE frontier_generation_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  mode TEXT NOT NULL,
  generated_count INT,
  accepted_count INT,
  rejected_count INT,
  is_exploration_run BOOLEAN,
  feedback_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extended project_suggestions table
ALTER TABLE project_suggestions ADD COLUMN frontier_mode BOOLEAN DEFAULT false;
ALTER TABLE project_suggestions ADD COLUMN source_domain TEXT;
ALTER TABLE project_suggestions ADD COLUMN target_domain TEXT;
ALTER TABLE project_suggestions ADD COLUMN cross_domain_distance FLOAT;
```

### Why Minimal Changes?
- Frontier ideas are still suggestions (reuse existing UI, filtering, rating logic)
- Rejection/acceptance tracking is separate (doesn't break existing feedback system)
- Generation logs enable weekly analytics without bloating main tables

---

## Scheduling & Cron Jobs

### New Cron Trigger: Weekly Opus Review

**When:** Every Monday 8:00 AM UTC
**What:** Batch review all frontier ideas from past week
**How long:** ~30 seconds per user (parallelizable)

```typescript
// api/cron/weekly-opus-review.ts
// Runs POST /api/frontier/generate for each user with a "review" flag
// Stores verdicts in a new frontier_verdicts table
```

### No New Sync Jobs Needed
- Frontier generation is request-driven (via POST /api/frontier/generate)
- Or triggered by existing DataSynchronizer as one of its syncs
- No additional polling required

---

## LLM Provider Integration

### Reuses Existing Models

| Model | Usage | Cost |
|-------|-------|------|
| Gemini (default) | Pre-filter scoring, idea generation | Per-call |
| Claude Opus | Weekly verdict reviews | Per-batch |
| Existing embeddings | Cross-domain distance calculation | Reused from synthesis |

### No New Model Training Required
- All operations are prompt-based
- Rubrics are built into the prompts
- Learning happens via feedback compression (not fine-tuning)

---

## Feature Rollout Plan

### Week 1: Silent Beta
1. Implement frontier mode configs + FeedbackSummarizer
2. Test with 5-10 manual generations
3. Check for token efficiency (is feedback summary <300 tokens?)
4. Iterate on prompts

### Week 2: Small Group
1. Enable frontier generation for 10 power users
2. Collect feedback, ideas, verdicts
3. Measure: mode distribution, spark rate, rejection reasons
4. Validate that modes are generating distinct ideas

### Week 3: Expanded Beta
1. Enable for all users (but hidden by default)
2. Add UI badge: "Frontier Mode" on idea cards
3. Show feedback summary to users
4. Collect 100+ ideas for calibration

### Week 4+: General Availability
1. Turn on Opus weekly reviews
2. Show verdicts in UI (BUILD / SPARK / REJECT + reasoning)
3. Enable mode analytics dashboard
4. Deploy mode collapse detection

---

## Success Metrics

### System Health
- **Prompt efficiency:** Average tokens used per idea (target: <3000)
- **Mode entropy:** Distribution of modes (target: 0.9+ / 1.0)
- **Rejection rate:** % of ideas rejected by pre-filter (target: 20-30%)

### User Engagement
- **Spark rate:** % of ideas marked "sparked" by user (measure per mode)
- **Build rate:** % of ideas actually built as projects (measure per mode)
- **Idea diversity:** Do weekly batches feel different? (qualitative)

### Learning
- **Feedback signal:** Are rejection reasons concentrated or spread? (entropy of reasons)
- **Calibration drift:** Does tractability estimate error change over time? (monthly)
- **Mode preference:** Does user have 1-2 standout modes? (track per user)

---

## Risk Mitigation

### Risk: Prompt Token Bloat
**Mitigation:** FeedbackSummarizer caps at 300 tokens. Weekly monitoring of avg token count.

### Risk: Mode Collapse (all ideas sound the same)
**Mitigation:** Entropy detection runs weekly. If entropy < 0.6, force underrepresented modes next run.

### Risk: Bad Opus Reviews (verdicts don't match user taste)
**Mitigation:** Track user's spark/build rate for Opus-recommended ideas. If <20%, tune review prompt.

### Risk: Tractability Estimates Stay Wrong
**Mitigation:** Monthly recalibration (after 30 completed/abandoned ideas). Adjust all future estimates by systematic bias.

### Risk: Cold Start Confusion (users don't understand frontier modes)
**Mitigation:** Show 3 seed examples per mode in onboarding. Let users rate seeds to validate understanding.

### Risk: API Cost Explosion
**Mitigation:** Batch Opus reviews (once weekly, not per-idea). Pre-filter scores with cheaper model first. Cap frontier generation to 1x per day per user.

---

## Backward Compatibility

**All changes are additive.** No modifications to:
- Existing suggestion scoring (still works)
- User feedback system (still works)
- Bedtime prompts (enhanced, not replaced)
- Synthesis pipeline (enhanced, not replaced)

A user can ignore frontier ideas entirely and still get regular suggestions.

---

## Long-Term Evolution

### Future: Frontier Modes + Learning
After 6 months of data, you could:
1. Train a lightweight model to predict which modes spark each user
2. Weight frontier generation by user's historical spark rate per mode
3. Auto-select domains based on user's past successes
4. Recommend pairs of users with complementary interests to collaborate

### Future: Cross-User Frontier
1. When User A's idea sparks User B (unknown initially)
2. Recommend they explore the same domain pairing together
3. Shared frontier generation (collaborative ideation)

---

## Summary: Integration is Lightweight

- **New code:** ~3-4 new files (frontier modes, feedback summarizer, scorer, orchestrator)
- **Modified code:** 2-3 files (inject feedback into synthesis, extend schema)
- **Database:** 3 new tables + 4 columns on existing table (minimal)
- **No breaking changes:** Everything works independently; frontier is purely additive

The frontier modes system plugs into Polymath's existing strength (synthesis, feedback, embeddings) and amplifies it.

---

**Next Step:** Start with Phase 1 (Foundation) implementation.
