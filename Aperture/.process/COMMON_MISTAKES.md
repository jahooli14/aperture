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
