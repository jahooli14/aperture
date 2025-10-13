# Common Mistakes & How We Fixed Them

> **🧭 You are here**: Lessons Learned Repository
>
> **Purpose**: Learn from every mistake. Capture immediately, detail at session end.
>
> **Format**: Date | Category | What Happened | Fix | Prevention
>
> **Last Updated**: 2025-10-13

---

## 🧭 Navigation

**Where to go next**:
- If starting new work → Review recent entries here first
- If made a mistake → Add entry immediately (don't wait)
- If need process guidance → `.process/DEVELOPMENT.md`
- If implementing fix → Update relevant process docs

**Related documentation**:
- `.process/CONTINUOUS_IMPROVEMENT.md` - How to capture and fix mistakes
- `.process/DEVELOPMENT.md` - Process that should prevent mistakes
- `SESSION_CHECKLIST.md` - Check before closing session

**Referenced by**:
- `.claude/startup.md:157` - Update immediately when mistakes happen
- `SESSION_CHECKLIST.md:158` - Review and detail at session end
- `START_HERE.md:203` - Avoid known pitfalls

---

## 2025-10-12 | Process | NEXT_SESSION.md Drift

### What Happened
Spent entire session (90+ minutes) debugging coordinate scaling bug, creating OpenCV solution, and building debugging protocols. At end of session, NEXT_SESSION.md still showed "Phase 1: Evidence Gathering" from BEFORE the breakthrough. Fresh sessions would have no idea the work was completed.

### The Fix
Updated `.process/DEVELOPMENT.md` with new rule: **Update NEXT_SESSION.md progressively during session, not just at end**.

**Update NEXT_SESSION.md immediately after**:
1. Completing a major phase
2. Discovering a breakthrough or pivot
3. Changing approach
4. Before closing session (final update)

### Prevention Strategy
**Enforcement mechanisms**:
- TodoWrite checklist - mark major phases complete, triggers NEXT_SESSION update
- `.claude/startup.md` - validates NEXT_SESSION matches reality at session start
- Code review question: "Was NEXT_SESSION.md updated after breakthroughs?"

**Why this matters**:
- Prevents drift between documented plan and actual progress
- Ensures continuity if session runs out of tokens mid-work
- Fresh sessions can pick up exactly where you left off
- Captures breakthroughs while context is fresh

### Cost of Mistake
- **Time Lost**: 10 minutes of user confusion identifying the gap
- **Time to Fix**: 5 minutes to update documentation
- **Risk**: Fresh sessions could waste hours redoing completed work

---

## 2025-10-10 | Architecture | Over-Engineered Testing Agent

### What Happened
Built a comprehensive testing agent with multi-layer test generation, exhaustive edge case coverage, and complex mocking frameworks. The system became so complex it slowed development to a crawl. Tests took 10x longer to run, required constant debugging, and developers avoided writing tests because the tooling was intimidating.

### The Fix
- Stripped back to minimal testing setup (Vitest + React Testing Library)
- Focused on testing critical paths only
- Let developers write simple tests manually
- Only automate when pattern is proven and ROI is clear

### Prevention Strategy
**Decision Framework**: Before adding complexity, always ask:
1. What's the minimum viable implementation?
2. Does the cost/benefit profile clearly pay off?
3. Will this make development faster or slower?

**Documented in**: `.process/ARCHITECTURE.md` - "Start Minimal" principle

### Cost of Mistake
- **Time Lost**: ~2 weeks building the system
- **Ongoing Tax**: 10x slower test runs, constant maintenance
- **Team Impact**: Developers avoided testing (opposite of intended goal)

---

## 2025-10-10 | Deployment | Pushing Untested Build Fixes

### What Happened
Deployed wizard-of-oz app to Vercel but pushed 3+ TypeScript fixes without testing locally first. Each fix failed on Vercel, requiring user to manually copy-paste build errors from mobile device. This created an inefficient debugging loop that was frustrating on mobile.

### The Fix
- **Immediate**: Tested `npm run build` locally before pushing final fix
- **Process**: Updated workflow to ALWAYS run local build before pushing
- **Result**: Final push (commit 8239925) succeeded on first try after local testing

### Prevention Strategy
**New Rule**: For ANY code changes that affect build:
1. Run `npm run build` locally FIRST
2. Fix all errors until build succeeds
3. THEN commit and push
4. Monitor Vercel auto-deployment

**Documented in**: `SESSION_CHECKLIST.md` - Feature Development section

### Cost of Mistake
- **Time Lost**: ~30 minutes pushing failed builds
- **User Impact**: Poor mobile experience with manual error copy-paste
- **Iterations**: 4 failed deployments before testing locally

### Key Learning
Testing locally catches issues BEFORE they hit CI/CD, especially important when user is on mobile and can't easily debug build failures.

---

## 2025-10-10 | Debugging | Skipped Infrastructure Verification Before Code Debugging

### What Happened
User reported "upload button doesn't work". I immediately jumped into debugging the code - removed API calls, added extensive logging, improved file type handling, deployed 3 times with debugging improvements. After all this, the root cause was simply: **the Supabase storage bucket didn't exist**. No amount of code fixes would solve an infrastructure problem.

### Why I Didn't Catch It
1. **Assumed infrastructure was set up** - I saw SUPABASE_SETUP.sql existed and assumed it was run
2. **Didn't verify external dependencies** - Never checked if storage buckets actually existed in Supabase
3. **Focused on code first** - Went straight to debugging application logic instead of checking infrastructure
4. **No infrastructure checklist** - Had no systematic way to verify external services were configured

### The Fix
- **Immediate**: Created STORAGE_BUCKET_SETUP.md with step-by-step instructions
- **Infrastructure**: User needs to create 'originals' bucket in Supabase Dashboard
- **Process**: Added infrastructure verification checklist below

### Prevention Strategy
**New Rule**: When debugging "feature doesn't work", ALWAYS verify infrastructure FIRST:

**Infrastructure Verification Checklist** (check BEFORE debugging code):
1. ✅ Database tables exist? (`SELECT * FROM [table]` in Supabase SQL Editor)
2. ✅ Storage buckets exist? (Check Supabase Storage dashboard)
3. ✅ Storage policies configured? (Check bucket policies)
4. ✅ API keys valid? (Check .env and Vercel environment variables)
5. ✅ External services reachable? (Test API endpoints manually)
6. ✅ RLS policies enabled? (Check database policies)

**Then** start debugging code.

### Debugging Priority Order
When something doesn't work:
1. **Infrastructure** - Does the platform/service exist and is it configured?
2. **Authentication** - Is the user properly authenticated?
3. **Permissions** - Does the user/service have the right permissions?
4. **Network** - Can the services reach each other?
5. **Code Logic** - Only then debug application code

### Cost of Mistake
- **Time Lost**: ~45 minutes debugging code that was never the problem
- **Deployments**: 3 unnecessary deployments with debugging code
- **User Impact**: User waiting while I debug the wrong layer
- **Code Pollution**: Added extensive console.log debugging that should be removed

### Key Learning
**Infrastructure problems look like code problems.** Always verify the foundation exists before debugging the building. A storage upload will fail identically whether the bucket doesn't exist OR the code is broken - but only infrastructure verification can tell you which it is.

### Documented in
- `projects/wizard-of-oz/STORAGE_BUCKET_SETUP.md` - Created bucket setup guide
- This entry - Infrastructure verification checklist

---

## 2025-10-10 | Debugging | Production API URLs Must Include Protocol and Handle Vercel Environment

### What Happened
After implementing eye detection/alignment pipeline, uploads worked but photos stayed "Processing" forever. The pipeline had multiple silent failures:

1. **Relative API URLs don't work in production** - Frontend was calling `/api/detect-eyes` which worked locally but failed in Vercel
2. **VERCEL_URL missing protocol** - `detect-eyes` calling `align-photo` used `VERCEL_URL` which is just the domain without `https://`
3. **Fire-and-forget API calls hide errors** - No response checking meant failures were completely silent
4. **Empty Vercel logs despite 200 responses** - Functions returned 200 but had no logs because they exited early
5. **Database constraints override code checks** - Disabled daily upload limit in code but DB unique constraint still enforced it

### The Fixes
1. **Frontend API calls**: Changed `/api/detect-eyes` to `window.location.origin + '/api/detect-eyes'`
2. **Server-to-server calls**: Added `https://` prefix to `process.env.VERCEL_URL`
3. **Error handling**: Changed from `.catch()` to `.then()` chain with response checking
4. **Comprehensive logging**: Added console.log at every step to track execution
5. **Database constraints**: Temporarily removed unique constraint with `ALTER TABLE`

### Prevention Strategy

**Vercel Serverless Function Checklist**:
1. ✅ **Frontend → API**: Use `window.location.origin + '/api/endpoint'`
2. ✅ **Server → Server**: Use `https://${process.env.VERCEL_URL}/api/endpoint`
3. ✅ **Always check responses**: Don't fire-and-forget - log status and errors
4. ✅ **Add logging first**: Console.log at entry, key steps, and exit points
5. ✅ **Check Vercel logs**: Empty logs = early exit, look for missing env vars or errors
6. ✅ **Database constraints**: Remember they enforce even if code doesn't check

**API Call Pattern**:
```typescript
// ❌ DON'T: Fire and forget
fetch('/api/endpoint', { ... });

// ✅ DO: Check response and log
const response = await fetch(absoluteUrl, { ... });
console.log('Response:', response.status);
if (!response.ok) {
  const error = await response.text();
  console.error('API failed:', error);
}
```

### Debugging Silent Failures Checklist
When an async operation "works" but doesn't do anything:
1. **Add logging at every step** - Entry, progress, completion, errors
2. **Check Vercel logs** - Empty logs mean early exit or crash
3. **Verify URLs are absolute** - Print the full URL being called
4. **Check response status** - Don't assume success
5. **Verify environment variables** - Missing vars cause silent failures
6. **Check database directly** - Bypass code to see what's actually stored

### Cost of Mistake
- **Time Lost**: ~2 hours debugging silent failures across multiple layers
- **Deployments**: 8+ deployments adding logging and fixes
- **User Impact**: Feature appeared broken despite successful uploads
- **Complexity**: Multiple simultaneous issues compounded debugging

### Key Learning
**Silent failures are the hardest to debug.** In serverless environments:
- Functions returning 200 doesn't mean they succeeded
- Empty logs mean the function exited before logging
- Always use absolute URLs for API calls in production
- Check responses, don't fire-and-forget
- Add comprehensive logging FIRST, not after things break

### Documented in
- This entry - Vercel API patterns and debugging checklist
- Multiple commits with enhanced error handling and logging

---

## 2025-10-10 | Process | Documentation Not Following "Start Minimal" Philosophy

### What Happened
CI philosophy audit revealed documentation violated own "Start Minimal" principles:
- Mandatory 5-step startup for every session (even trivial tasks)
- 5 levels of "reasoning dial" creating decision fatigue
- 4 different task tracking systems (plan.md, todo.md, TodoWrite, checklist)
- 196-line CONTRIBUTING.md for personal project with no contributors
- 380-line testing guide when no tests written yet
- Token management buried at end of file despite being critical
- No automation for infrastructure checks that cost 6+ hours debugging
- Manual project detection requiring reading multiple files

### The Fix
**Immediate implementations** (all completed):

1. **Pre-Flight Automation** (.claude/commands/):
   - `/verify-infra` - Checks databases, buckets, env vars, Vercel settings
   - `/which-project` - Auto-detects NUDJ vs Aperture
   - Catches 80% of infrastructure issues in 2 minutes

2. **Token Budget Management**:
   - Added to SESSION_CHECKLIST.md step 0 (before anything else)
   - Clear thresholds: < 50K healthy, 50-100K warning, > 100K mandatory fresh
   - `/token-health` dashboard command

3. **Simplified Startup** (START_HERE.md):
   - Decision tree: 1 min (continue work) to 5 min (unfamiliar project)
   - No longer mandatory 5-step for every session
   - Integrated `/which-project` automation

4. **Single Task Tracking**:
   - TodoWrite during work → NEXT_SESSION.md at end
   - Removed references to maintaining separate todo.md
   - SESSION_CHECKLIST.md updated

5. **Simplified CONTRIBUTING.md**:
   - Reduced from 196 lines to 24 lines (88% reduction)
   - Removed unused open-source process overhead

6. **Restructured DEVELOPMENT.md**:
   - Context management moved to top (was at bottom)
   - Reasoning dial simplified from 5 levels to 2 (default vs "think hard")
   - Removed duplicate context section

7. **Git Hooks for Conventional Commits**:
   - `.scripts/commit-msg` enforces format
   - `.scripts/install-hooks.sh` for easy setup
   - Prevents manual non-standard commits

8. **Deployment Protection Check**:
   - Added to `/verify-infra` command
   - Automated script via Vercel API
   - Catches the "server-to-server calls return 401" issue

### Prevention Strategy
**Apply CI philosophy to documentation itself**:

1. **Cost/Benefit Analysis**:
   - Before adding process docs: "What's the ROI?"
   - Token budget: Is this file loaded every session?
   - Maintenance: Will this need updating frequently?

2. **Start Minimal**:
   - Simple path for simple tasks
   - Full process only when complexity justifies it
   - Placeholders for future features (not premature builds)

3. **Automate the Boring Stuff**:
   - Infrastructure checks → `/verify-infra` (not manual debugging)
   - Project detection → `/which-project` (not reading router files)
   - Token health → `/token-health` (not guessing thresholds)
   - Commit format → git hooks (not manual review)

4. **Continuous Improvement**:
   - Documentation should follow same rules as code
   - Audit against philosophy periodically
   - Remove/simplify what isn't providing value

### Documented in
- All improvements committed to repository
- New commands in `.claude/commands/`
- Updated SESSION_CHECKLIST.md, START_HERE.md, DEVELOPMENT.md
- Git hooks in `.scripts/`

### Cost of Mistake
**Before**:
- 5 minutes overhead per session × many sessions
- 6+ hours debugging infrastructure issues (could have been 2 min check)
- Token budget overruns (124K in recent session)
- Decision fatigue choosing "reasoning levels"
- Confusion with multiple task tracking systems

**After**:
- 1-2 min startup for continuing work (was 5 min)
- Pre-flight checks catch issues before debugging
- Token health monitored proactively
- Single task tracking system
- ~50% reduction in documentation token load

**Time saved**: 10-20 hours over next 10 sessions

### Key Learning
**Your process documentation must follow your process philosophy.** If "Start Minimal" is the rule, then documentation should be minimal too. Automate repetitive checks. Simplify decision trees. Remove unused overhead.

The best documentation improvement is often deletion, not addition.

---

## Template for Future Entries

### [Date] | [Category] | [Brief Title]

**What Happened**
[Describe the mistake in 2-3 sentences]

**The Fix**
- [Action taken to resolve]
- [Changes made to prevent recurrence]

**Prevention Strategy**
[How we'll catch this earlier next time]

**Documented in**: [Reference to updated process doc]

**Cost of Mistake**
- Time Lost: [estimate]
- Impact: [team velocity, code quality, etc.]

---

## Categories (for easy filtering)

- **Architecture**: System design decisions
- **Tooling**: Development tools and automation
- **Process**: Workflow and collaboration
- **Security**: Security vulnerabilities or oversights
- **Performance**: Performance issues and optimizations
- **Testing**: Testing strategy and implementation
- **Deployment**: Deployment and infrastructure
- **Documentation**: Documentation gaps or errors
- **AI Workflow**: Claude interaction patterns

---

## How to Use This File

### During Development (Immediate Capture)
When you notice a mistake:
```markdown
## [Date] | [Category] | [Title]
**What Happened**: [One-sentence description]
**Next**: Detail this at session end
```

### Session End (Detailed Reflection)
Expand captured mistakes with:
- Full context and impact
- The fix we implemented
- Prevention strategy
- References to updated docs

### Session Start (Review)
Skim recent entries before starting work to keep lessons fresh.

---

**Last Updated**: 2025-10-10
**Total Entries**: 1 (Testing Agent Anti-Pattern)
