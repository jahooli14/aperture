# Common Mistakes & How We Fixed Them

> **Purpose**: Learn from every mistake. Capture immediately, detail at session end.
>
> **Format**: Date | Category | What Happened | Fix | Prevention

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
