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
