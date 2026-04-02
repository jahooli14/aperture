# Frontier Modes: Executive Summary of Gaps & Recommendations

## Quick Overview

You've designed a sophisticated 6-mode evolutionary idea generation system that *should* work brilliantly but has **8 critical gaps in prompt design, feedback architecture, and reliability**. The existing Polymath codebase has a foundation for this (synthesis engine, scoring models, feedback tracking), but the frontier modes implementation needs deliberate, careful design.

---

## The 8 Critical Gaps

### 1. **No Unified Frontier Mode Prompt Template**
**Problem:** Each mode (Translate, Tool Transfer, Assumption Audit, Analogy Mine, Compression, Inversion) needs its own prompt, but they should share a consistent structure to avoid mode collapse.

**Current State:** Undefined; the bedtime-ideas.ts file has ad-hoc prompts but no frontier mode infrastructure.

**Fix:** Create a base template with mode-specific injections (see FRONTIER_MODES_IMPLEMENTATION.md, Section 1). Each mode gets:
- Operation description (what cognitive work the mode forces)
- 3-5 worked examples showing the operation
- 2-3 explicit constraints
- 3 success criteria
- Temperature setting (0.85-1.15 range depending on mode)

**Token Cost:** ~500-700 tokens per frontier prompt (well within budget for Opus/Claude).

---

### 2. **Feedback Injection: Context Bloat Without Compression**
**Problem:** Feeding 3 weeks of rejection/acceptance signals into agent prompts will explode token count unless you compress aggressively. Current system (bedtime-ideas.ts) uses raw lists.

**Current State:** Breakthrough context is injected as raw strings; no summarization.

**Fix:** Use FeedbackSummarizer (FRONTIER_MODES_IMPLEMENTATION.md, Section 2) that:
- Compresses to 200-300 tokens max
- Shows mode-by-mode acceptance rates (not raw counts)
- Highlights problematic modes to avoid
- Flags most common rejection reasons
- Suggests mode to focus on this week

**Impact:** Feedback becomes signal instead of noise. User learns which modes spark their thinking.

**Example Compressed Output:**
```
Top modes: Translate (4 sparks), AnalogyMine (3 sparks)
Most common rejection: unclear_reasoning (6 cases)
Guidance: Rest ToolTransfer for 1 week. Explain your bridges better.
```

---

### 3. **Pre-Filter Rubric: Undefined, Inconsistent Scoring**
**Problem:** How do you score novelty (0-1), cross-domain distance (0-1), and tractability (0-1) consistently? Without an explicit rubric, LLM judges will vary wildly.

**Current State:** Hardcoded feasibility scores in synthesis.ts (0.9 creative, 0.6 technical). Novelty is semi-random (0.7-1.0).

**Fix:** Implement PreFilterScorer (FRONTIER_MODES_IMPLEMENTATION.md, Section 3) with a **rubric that LLM must follow**:
- Novelty: Does the idea match anything in the user's history? Is it incremental/lateral/paradigm-shifting?
- Cross-Domain Distance: How far apart are the domains? (Higher is better for frontier work!)
- Tractability: Can this start in 1 week? 1 month? 1 quarter? Or never?
- Hard Rejection: Hand-wavy reasoning, low-risk/low-reward combos, diminishing returns

**Key Insight:** Cross-domain distance is a **feature**, not a bug. An idea that bridges marine biology + software design is more interesting than one bridging UI design + interaction design.

---

### 4. **Opus Review: Batch vs. Sequential Trade-off Undefined**
**Problem:** Should Opus review 30 ideas at once (efficient) or 1-3 per day (nuanced)? What format should verdicts use?

**Current State:** No Opus review system exists; synthesis runs are fire-and-forget.

**Fix:** Implement batched reviews (Section 7 in Implementation doc):
- Run once per week on Monday
- Review all frontier-mode ideas from the past week
- Return 3 verdict types: **BUILD** (do this project), **SPARK** (interesting catalyst, don't build directly), **REJECT** (clever but dead-end)
- For SPARK ideas, ask a follow-up question that reframes the core insight

**Rationale:** Weekly cadence reduces API costs. Batching allows Opus to see patterns across the week. Spark verdicts acknowledge that some ideas aren't projects but are creative catalysts.

**Example Spark Verdict:**
```json
{
  "idea_title": "Git Workflows for Visual Design",
  "verdict": "SPARK",
  "reasoning": "This idea is clever but implementation is premature. But it reveals that design versioning is a real problem.",
  "follow_up_question": "What if we built not Git for design, but a 'diff algorithm' that shows pixel-level changes?"
}
```

---

### 5. **Cold Start: No Seed Examples to Prevent Mode Confusion**
**Problem:** Week 1, agents generate ideas, but humans (and agents evaluating ideas) haven't seen examples of each mode working. Ideas will be confused, low-quality, or all sound the same.

**Current State:** Polymath seeds some test data (seed-test-data.ts) but nothing for frontier modes.

**Fix:** Curate 12-15 seed ideas (3 per mode, showing range of quality):
- **Exemplar** (gold standard): Shows the mode at its best
- **Solid** (good): Shows realistic good work
- **Rough** (educational): Shows what "trying the mode" looks like

Include these seeds in:
1. Onboarding (users see the range)
2. Few-shot examples in agent prompts
3. Analytics dashboard (to compare user-generated ideas to seeds)

**Example Seed (Translate mode):**
```
Title: "Mycelium Project Planning"
Description: "A project system where coordination emerges from local decisions, not central planning."
Reasoning: "Mycelial networks have no central authority yet coordinate globally. What if PM worked the same way?"
Mode: Translate
Quality: Exemplar
Novelty: 0.81, Tractability: 0.72
```

---

### 6. **Mode Collapse: No Prevention Mechanism**
**Problem:** After 3-4 weeks, all ideas start using the same 2 modes. The system converges to whatever's easiest or most rewarding.

**Current State:** The constraint-based synthesis (one-skill, quick, stretch) has this problem; no mitigation.

**Fix:** Implement ModeCollapsePredictor (FRONTIER_MODES_PROMPT_REVIEW.md, Section 6):
- Weekly entropy check: measure distribution of modes (0-1 scale, 1.0 = perfectly balanced)
- If entropy < 0.6, flag "mode collapse detected"
- Force recommendations: push underrepresented modes next week
- Optional: Rotate modes every 2-3 weeks to avoid local optima

**Metric to track:**
```
Mode distribution (last 7 days):
- Translate: 15% (target 16.7%)
- ToolTransfer: 8% (LOW - force next week)
- AssumptionAudit: 18% (HIGH - rest this mode)
- AnalogyMine: 16%
- Compression: 24% (HIGH)
- Inversion: 19%

Entropy: 0.92 / 1.0 = Healthy
```

---

### 7. **Tractability Calibration: No Learning From Outcomes**
**Problem:** Your tractability_estimate scores are guesses. After users build (or abandon) ideas, you have ground truth. Use it to recalibrate.

**Current State:** feasibility_score is hardcoded (0.9 creative, 0.6 technical); no feedback loop.

**Fix:** Implement TractabilityCalibrator (FRONTIER_MODES_PROMPT_REVIEW.md, Section 7):
- After each idea reaches completion/abandonment, measure: "Did it actually take 3 months or 1 week?"
- Compute calibration offset (systematic bias)
- Adjust future estimates: `new_score = old_score - calibration_offset`
- Monthly recalibration check

**Expected Signal After 30 Ideas:**
```
Estimates were too optimistic by 0.15 on average.
Ideas estimated at 0.8 tractability actually took 2x longer.
Recommendation: Subtract 0.15 from all future tractability estimates.
```

---

### 8. **Prompt Engineering Best Practices: Incomplete Implementation**
**Problem:** Missing several best practices that keep prompts from degrading over time.

**Current State:** Mixed compliance (good user context injection, weak output schema validation).

**Specific Issues:**
| Practice | Gap | Fix |
|----------|-----|-----|
| **Explicit role definition** | "Idea engineer" undefined | Add: "You are X. Your constraints are Y. You succeed when Z." |
| **Output schema validation** | No JSON enforcement | Use LLM API's structured output feature |
| **Few-shot examples** | 2-3 examples only | Expand to 5-7 (include failure cases) |
| **Rejection criteria** | Vague | Make algorithmic: embed similarity > 0.92 = reject |
| **Token budget visibility** | None | Add comment: `// ~2400 tokens / 4096 available` |
| **Temperature control** | 1.0 everywhere | Vary: AssumptionAudit=0.85, Translate=1.15 |
| **Error handling** | Minimal | Add fallback: "If parsing fails, return emergency idea" |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Define frontier mode configs (all 6 modes with operation, examples, constraints)
- [ ] Build FeedbackSummarizer (compress 3 weeks → 300 tokens)
- [ ] Implement PreFilterScorer with explicit rubric
- [ ] Create seed ideas (12-15 examples across modes)
- [ ] Wire up pre-filter to reject ideas before Opus review

**Deliverable:** Frontier mode agents can generate ideas, pre-filter scores them consistently, and compress feedback for next run.

### Phase 2: Intelligence (Week 2-3)
- [ ] Implement Opus review prompt (batch weekly reviews)
- [ ] Add verdict logging (BUILD/SPARK/REJECT + reasons)
- [ ] Build mode collapse detector (weekly entropy check)
- [ ] Create feedback injection into agent prompts
- [ ] Test 50+ idea generation cycles, iterate on prompts

**Deliverable:** System learns which modes spark user's thinking. Mode distribution stays balanced. Opus verdicts guide future runs.

### Phase 3: Calibration (Week 4+)
- [ ] Track outcome data (completed / abandoned / in-progress ideas)
- [ ] Implement tractability recalibration (monthly)
- [ ] Build dashboard showing frontier metrics (mode distribution, spark rate, avg novelty score)
- [ ] A/B test: feedback-guided runs vs. exploration-only runs (track spark rate)
- [ ] Refine cold start seeds based on user data

**Deliverable:** System is self-correcting. Tractability estimates improve over time. Dashboard shows learning.

---

## Expected Outcomes (After 8-12 Weeks)

If you implement all 8 fixes:

1. **Ideas don't sound the same** — Mode collapse detection + forced diversity keeps ideas fresh
2. **Feedback loops** — System learns which modes spark the user's thinking (typically 1-2 standout modes per user)
3. **Scoring consistency** — Pre-filter rubric ensures all ideas evaluated on same criteria
4. **Genuine catalysis** — Opus reviews distinguish between "build this project" and "interesting catalyst" ideas
5. **Trust in estimates** — After 30-50 built/abandoned ideas, tractability scores are well-calibrated
6. **Reduced context bloat** — Compressed feedback summaries keep prompts efficient
7. **Cold start works** — New users see exemplar ideas, understand the system quickly
8. **Visible learning** — Dashboard shows entropy, spark rates, mode distribution trends over time

---

## Key Design Principles

### 1. Structure Prevents Collapse
Without explicit templates, all modes converge. Enforce structure:
- Every frontier prompt uses the same template
- Every verdict follows the same schema
- Every feedback signal is categorized the same way

### 2. Compression Is Valuable
Raw signals (lists of rejections) are noise. Summaries are signal:
- "You rejected 6 ideas" → "Reasoning clarity is your blocker"
- "Translate mode: 4 sparks, 2 rejects" → "Focus on Translate this week"

### 3. Cross-Domain Distance Is a Feature
Don't penalize ideas for being weird. Reward it (if tractable):
- Distance = 0.2 (design + UI) → Likely incremental
- Distance = 0.8 (biology + software) → Likely paradigm-shifting

### 4. Spark ≠ Build
Opus review should distinguish catalyst ideas from buildable projects. Both are valuable.

### 5. Monthly Recalibration > Constant Adjustment
Don't retune prompts every run. Collect signal for 30 days, then recalibrate. Prevents oscillation.

---

## Recommended Next Steps

1. **Read the detailed design document** (FRONTIER_MODES_PROMPT_REVIEW.md)
2. **Review implementation examples** (FRONTIER_MODES_IMPLEMENTATION.md)
3. **Pick frontier mode #1 to implement** (recommend: Translate, easiest to get right)
4. **Create 3 seed examples** for that mode (exemplar + solid + rough)
5. **Build the FeedbackSummarizer first** (highest leverage, impacts all modes)
6. **Test with 5-10 manual idea generation runs** before automating
7. **Once confident, expand to all 6 modes**
8. **Turn on Opus reviews** after 2 weeks of data

---

## Questions to Clarify

1. **Feedback window:** 3 weeks too long/short? (Affects summary compression)
2. **Build velocity:** How many ideas per week does the user build? (Affects evaluation cadence)
3. **Domain expertise:** Are the domains coming from the user's capabilities/interests, or should agents discover new domains?
4. **Opus frequency:** Weekly review enough, or daily for active users?
5. **Seed quality:** Should users rate seed ideas on "How well does this exemplify [mode]?" to validate seeds?

---

## Files Provided

1. **FRONTIER_MODES_PROMPT_REVIEW.md** — Detailed analysis of all 8 gaps, with example prompts and rubrics
2. **FRONTIER_MODES_IMPLEMENTATION.md** — Production-ready code (TypeScript) for all components
3. **This file** — Executive summary for quick reference

---

*Last updated: April 2, 2026*
*Author: Prompt Design Review*
*Status: Ready for implementation*
