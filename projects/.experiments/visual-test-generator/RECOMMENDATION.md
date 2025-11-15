# Visual Test Generator - Official Recommendation

> **Date**: 2025-10-21 (Session 22)
>
> **Status**: Scope reassessment complete
>
> **Decision**: Defer full implementation, use pragmatic alternatives

---

## TL;DR

**Don't build Visual Test Generator as originally designed.**

**Instead**:
1. Use Playwright's built-in visual regression (zero setup)
2. If that's insufficient, build minimal version (1-2 sessions)
3. Only build full AI vision if validated valuable

---

## The Original Vision (ARCHITECTURE.md)

### What It Promised
- Record video of manual testing
- AI extracts UI elements (Florence-2)
- AI understands intent (SmolVLM + Whisper)
- AI generates Playwright code (WebLLM)
- "Transform manual testing into tests in 30 seconds"

### What It Actually Requires
- **Time**: 4-6 weeks (160-240 hours)
- **Complexity**: Browser AI integration (4 models)
- **Novel tech**: WebGPU, OPFS, multi-modal AI
- **Validation**: None (unproven hypothesis)
- **Value**: Unclear vs existing tools

### Why This Failed
**Violated core process principles**:
- ❌ Not minimal (trying to build everything at once)
- ❌ Not validated (assumed AI would work)
- ❌ Not focused (unclear problem being solved)
- ❌ Not pragmatic (ignored existing solutions)

---

## Official Recommendation

### Phase 1: Use What Exists (NOW)

**Playwright has built-in visual regression testing**:

```typescript
// In your test file
import { test, expect } from '@playwright/test';

test('homepage looks correct', async ({ page }) => {
  await page.goto('https://myapp.com');

  // First run: captures baseline
  // Future runs: compares against baseline
  await expect(page).toHaveScreenshot('homepage.png');
});

// Update baselines when intentional changes made
// npx playwright test --update-snapshots
```

**Benefits**:
- ✅ Zero setup (already have Playwright)
- ✅ Proven technology
- ✅ Built-in diff viewer
- ✅ Git-based approval (commit updated snapshots)
- ✅ Works today

**Try this first**. See if it solves your problem.

---

### Phase 2: Evaluate Need (1-2 WEEKS)

After using Playwright's built-in visual regression:

**Ask yourself**:
1. Does Playwright's visual regression solve the problem?
   - **If YES**: Stop. You're done.
   - **If NO**: Continue to Phase 3

2. What's missing?
   - Better diff UI?
   - Centralized storage?
   - Team collaboration features?
   - Historical diff tracking?

3. Is the gap worth building a custom tool?
   - **If NO**: Stop. Use Playwright.
   - **If YES**: Continue to Phase 3

---

### Phase 3: Build Minimal Version (1-2 SESSIONS)

**Only if** Playwright's built-in isn't enough.

**Scope** (Visual regression only, no AI):
```bash
# Capture screenshots
vtg capture --suite admin-tests

# Compare with baselines
vtg compare

# Review in web UI
vtg review

# Approve changes
vtg approve <test-id>
```

**Stack**:
- Playwright (screenshot capture)
- Pixelmatch (visual diff)
- React + Vite (review UI)
- Supabase (storage)
- Commander.js (CLI)

**Time**: 8-16 hours (1-2 sessions)

**Deliverable**: Working visual regression tool with better UX than Playwright's built-in

---

### Phase 4: Consider AI (MONTHS LATER)

**Only if**:
- Phase 3 tool is heavily used
- Team finds value in visual regression
- Manual test writing is a bottleneck
- You want to invest weeks in R&D

**Then**:
- Validate Florence-2 actually detects UI elements
- Prove SmolVLM understands test intent
- Build small proof-of-concept
- Iterate based on real feedback

**Timeline**: 4-6 weeks minimum
**Risk**: High (unproven approach)
**Value**: Unknown until validated

---

## Why This Recommendation?

### Lessons from Session 22

**We just learned** (COMMON_MISTAKES.md 2025-10-21):
> "Components working ≠ System working"
>
> Built complete Polymath system but only discovered it was broken when we traced the actual user flow.

**Apply same logic here**:
- Building complex AI system without validating it works = risky
- Building tool without validating the need = wasteful
- Starting with existing solution = pragmatic

### Process Philosophy

From `.process/CAPABILITIES.md`:
> **Start Minimal**: Build smallest thing that could work, then iterate

**Minimal for visual regression testing**:
1. Use Playwright's built-in (smallest = use existing)
2. Build simple wrapper if needed (small = one tool, one purpose)
3. Add AI only if proven valuable (iterate based on usage)

### Token Budget Reality

**Session 22 budget**:
- Started: ~24K tokens
- Current: 98K tokens
- Used on: Polymath fixes + process improvements

**Full Visual Test Generator**:
- Estimated: 50K+ tokens (complex multi-system build)
- Would hit limit mid-implementation
- Better to defer than build broken system

---

## Decision Tree

```
Do you need visual regression testing?
│
├─ No → Don't build anything
│
└─ Yes → Use Playwright's built-in
    │
    ├─ Works great → Stop. You're done.
    │
    └─ Not enough → Build minimal version (Phase 3)
        │
        ├─ Solves problem → Stop. You're done.
        │
        └─ Still want AI → Validate approach first
            │
            ├─ Doesn't work → Stop. Saved weeks.
            │
            └─ Works → Build full version (Phase 4)
```

---

## Action Items

### For User (NOW)

1. **Try Playwright's built-in visual regression**:
   ```bash
   cd projects/nudj-admin
   # Add to existing test:
   await expect(page).toHaveScreenshot('admin-dashboard.png');
   npx playwright test
   ```

2. **Use it for 1-2 weeks**

3. **Evaluate**:
   - Does it solve your problem?
   - What's missing?
   - Is the gap worth building a custom tool?

### For Future Sessions

**If Playwright insufficient**:
- Request: "Build minimal visual regression tool (Phase 3)"
- Expected time: 1-2 sessions
- Deliverable: CLI + Web UI for screenshot diff approval

**If want AI features**:
- Request: "Validate Florence-2 for UI detection (proof-of-concept)"
- Expected time: 1 session
- Deliverable: Evidence it works (or doesn't)

---

## Files Updated

**Created**:
- `WHY_NOT_BUILT.md` - Detailed analysis of why full vision isn't built
- `RECOMMENDATION.md` - This file

**Updated**:
- `package.json` - Changed from AI dependencies to minimal visual regression deps
- `NEXT_SESSION.md` - Will be updated to reflect this decision

**Preserved**:
- `ARCHITECTURE.md` - Full AI vision (for future reference)
- `ROADMAP.md` - 4-6 week plan (if ever needed)
- `RESEARCH.md` - AI model research

These docs remain as **aspirational vision** but not **current plan**.

---

## Key Takeaways

1. **Original vision was over-scoped** - 4-6 weeks is a long-term project, not a quick build

2. **Existing tools likely sufficient** - Playwright has visual regression built-in

3. **Start minimal, validate value** - Use existing → Build simple → Add AI only if needed

4. **Process philosophy matters** - We almost violated "Start Minimal" again

5. **Token budget is real** - Can't build everything in one session

---

## Recommendation Summary

**Immediate**: Use Playwright's built-in visual regression
**Short-term**: Build minimal tool if Playwright insufficient (1-2 sessions)
**Long-term**: Consider AI features only if validated valuable (4-6 weeks)

**Do NOT**: Build full AI vision without validation

---

**Status**: Recommendation documented ✅
**Next**: User tries Playwright built-in, evaluates need
**Future**: Build minimal version if needed, defer AI indefinitely
