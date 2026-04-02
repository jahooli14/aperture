# Frontier Modes Prompt Design: Complete Review

A comprehensive analysis of the evolutionary idea generation system's prompt architecture, gaps, and implementation strategy.

## Documents Overview

### 1. [FRONTIER_MODES_EXECUTIVE_SUMMARY.md](./FRONTIER_MODES_EXECUTIVE_SUMMARY.md) — START HERE
**Length:** 5 min read
**Audience:** Decision makers, product owners

Quick overview of the 8 critical gaps and what to do about them. Includes:
- The 8 gaps explained in plain language
- Why each gap matters
- Quick fix for each gap
- Expected outcomes after implementation
- Recommended next steps

**If you read nothing else, read this.**

---

### 2. [FRONTIER_MODES_PROMPT_REVIEW.md](./FRONTIER_MODES_PROMPT_REVIEW.md) — DEEP DIVE
**Length:** 30 min read
**Audience:** Prompt engineers, system designers

Complete analysis with:
- **Section 1:** Unified frontier mode prompt template (all 6 modes with config)
- **Section 2:** Feedback injection strategy (how to compress 3 weeks → 300 tokens)
- **Section 3:** Pre-filter rubric (scoring novelty, distance, tractability)
- **Section 4:** Opus review strategy (batch vs. sequential, verdict types)
- **Section 5:** Cold start seed examples (12-15 curated ideas)
- **Section 6:** Mode collapse prevention (entropy detection, forced diversity)
- **Section 7:** Tractability calibration (learning from outcomes)
- **Section 8:** Prompt engineering best practices (what's missing)

Includes concrete example prompts and code snippets you can copy directly.

---

### 3. [FRONTIER_MODES_IMPLEMENTATION.md](./FRONTIER_MODES_IMPLEMENTATION.md) — BUILD GUIDE
**Length:** 45 min read
**Audience:** Engineers implementing the system

Production-ready TypeScript code for:
1. **Frontier mode configuration** — Define all 6 modes with operations, examples, constraints
2. **Feedback summarizer** — Compress signals efficiently (token-aware)
3. **Pre-filter scorer** — LLM-based scoring with explicit rubric
4. **Frontier agent orchestrator** — Main generation pipeline
5. **API integration** — How to wire into existing Polymath systems
6. **Database schema** — New tables for tracking rejections/acceptances
7. **Weekly scheduler** — Opus review automation

All code is fully functional; copy-paste ready with TODO comments for your LLM provider.

---

## Quick Navigation by Role

### I'm a Prompt Engineer
1. Read EXECUTIVE_SUMMARY (5 min)
2. Read PROMPT_REVIEW sections 1-4 (frontier modes, feedback, pre-filter, Opus)
3. Study IMPLEMENTATION section 1-3 (the prompts themselves)
4. Build FeedbackSummarizer first (highest leverage)

### I'm a Backend Engineer
1. Read EXECUTIVE_SUMMARY (5 min)
2. Read PROMPT_REVIEW section 8 (best practices)
3. Read IMPLEMENTATION sections 4-7 (code, API, schema, scheduler)
4. Start with database schema migration
5. Wire up API endpoints

### I'm a Product Owner
1. Read EXECUTIVE_SUMMARY (entire, 5-10 min)
2. Focus on "Expected Outcomes" section
3. Read PROMPT_REVIEW "Summary: The Critical Path" section
4. Use the roadmap to plan sprints

### I'm Evaluating This Approach
1. Read EXECUTIVE_SUMMARY entirely
2. Read PROMPT_REVIEW sections 1, 4, 6 (frontier modes themselves, Opus review, mode collapse)
3. Skim IMPLEMENTATION for feasibility

---

## The 8 Critical Gaps (Quick Reference)

| # | Gap | Impact | Fix Token Cost |
|---|-----|--------|-----------------|
| 1 | No unified frontier mode template | Mode confusion, inconsistent quality | 500-700 tokens |
| 2 | Feedback bloat (no compression) | Prompt token explosion | 200-300 tokens max |
| 3 | Pre-filter rubric undefined | Inconsistent scoring, random rejections | 300-400 tokens |
| 4 | Opus review prompt undefined | No strategic evaluation | 400-500 tokens |
| 5 | No seed examples | Cold start confusion | 1-time setup |
| 6 | No mode collapse detection | Ideas converge to 1-2 modes | 200 tokens (analytics) |
| 7 | Tractability not calibrated | Estimates stay wrong | Monthly review (50 tokens) |
| 8 | Missing prompt best practices | Silent drift over time | Varies by practice |

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Define FrontierModeConfig for all 6 modes (IMPLEMENTATION section 1)
- [ ] Implement FeedbackSummarizer class (IMPLEMENTATION section 2)
- [ ] Implement PreFilterScorer with LLM integration (IMPLEMENTATION section 3)
- [ ] Curate 12-15 seed ideas (PROMPT_REVIEW section 5)
- [ ] Add seed ideas to database

### Phase 2: Intelligence (Week 2-3)
- [ ] Implement frontier agent orchestrator (IMPLEMENTATION section 4)
- [ ] Add API endpoint POST /api/frontier/generate (IMPLEMENTATION section 5)
- [ ] Implement OpusReviewer class (PROMPT_REVIEW section 4, IMPLEMENTATION section 7)
- [ ] Build weekly scheduler (IMPLEMENTATION section 7)
- [ ] Add feedback tracking tables (IMPLEMENTATION section 6)

### Phase 3: Calibration (Week 4+)
- [ ] Implement ModeCollapsePredictor (PROMPT_REVIEW section 6)
- [ ] Implement TractabilityCalibrator (PROMPT_REVIEW section 7)
- [ ] Build analytics dashboard (metrics: entropy, spark rate, avg scores)
- [ ] Run calibration monthly (update thresholds)
- [ ] Refine cold-start seeds based on real user data

---

## Key Insights

### 1. Structure Prevents Collapse
All 6 frontier modes need unified templates. Without it, they'll converge to whatever's easiest or most rewarding.

**Solution:** FrontierModeConfig system with explicit operation, examples, constraints, success criteria for each mode.

### 2. Feedback Must Be Compressed
Injecting raw rejection history into prompts explodes token count. You need a summarizer that distills signal.

**Solution:** FeedbackSummarizer that shows mode-by-mode acceptance rates, top rejection reasons, and actionable guidance in 200-300 tokens.

### 3. Cross-Domain Distance Is a Feature
Don't penalize ideas for being weird. Reward them (if tractable). This is the whole point of frontier modes.

**Solution:** Pre-filter rubric scores distance 0-1, with 1.0 (completely unrelated domains) as ideal.

### 4. Spark ≠ Build
Not every good idea is a project. Some are "catalyst ideas" that spark thinking without being directly buildable.

**Solution:** Opus review returns three verdicts: BUILD (do this), SPARK (interesting catalyst), REJECT (dead-end).

### 5. Recalibrate Monthly, Not Constantly
After 30 built/abandoned ideas, you have ground truth on tractability estimates. Adjust once, then wait for more signal.

**Solution:** TractabilityCalibrator runs monthly, computes systematic bias, adjusts future estimates.

---

## Expected Outcomes

After implementing all 8 fixes over 8-12 weeks:

1. **Ideas stay fresh** — Entropy detection keeps modes balanced
2. **System learns your taste** — Tracks which modes spark you most
3. **Scoring is consistent** — Rubric ensures fairness
4. **Catalysts are recognized** — Opus reviews distinguish sparks from projects
5. **Estimates improve** — Tractability scores get better each month
6. **Prompts don't bloat** — Feedback summaries keep things efficient
7. **Cold start works** — New users see exemplar ideas immediately
8. **Learning is visible** — Dashboard shows entropy, spark rates, trends

---

## Recommended Reading Order

1. **First:** FRONTIER_MODES_EXECUTIVE_SUMMARY.md (5 min)
2. **Then:** FRONTIER_MODES_PROMPT_REVIEW.md sections 1-4 (20 min)
3. **Then (if building):** FRONTIER_MODES_IMPLEMENTATION.md sections 1-3 (15 min)
4. **Then (if engineering):** FRONTIER_MODES_IMPLEMENTATION.md sections 4-7 (30 min)
5. **Reference:** FRONTIER_MODES_PROMPT_REVIEW.md sections 5-8 as needed

---

## Questions to Answer Before Implementation

1. **Feedback window:** Is 3 weeks too long or short for summarizing signals?
2. **Build velocity:** How many ideas per week does the typical user build?
3. **Domain discovery:** Do agents choose new domains, or stick to user's known capabilities?
4. **Opus frequency:** Weekly review OK, or do active users need daily?
5. **Seed validation:** Should users rate how well seeds exemplify each mode?

---

## File Locations (Absolute Paths)

- Executive summary: `/Users/danielcroome-horgan/Aperture/FRONTIER_MODES_EXECUTIVE_SUMMARY.md`
- Detailed review: `/Users/danielcroome-horgan/Aperture/FRONTIER_MODES_PROMPT_REVIEW.md`
- Implementation guide: `/Users/danielcroome-horgan/Aperture/FRONTIER_MODES_IMPLEMENTATION.md`
- This navigation guide: `/Users/danielcroome-horgan/Aperture/README_FRONTIER_REVIEW.md`

---

## Status

- **Written:** April 2, 2026
- **Scope:** Complete architectural review + implementation guide
- **Next step:** Implementation begins with Phase 1 (Week 1)
- **Review cadence:** After first 50 idea generation runs, iterate on prompts

---

**Start with the Executive Summary. Everything else builds from there.**
