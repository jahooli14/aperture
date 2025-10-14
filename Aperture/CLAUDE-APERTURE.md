# CLAUDE.md - Aperture Projects

> **🚨 IMPORTANT NOTICE**:
>
> This is the **APERTURE** repository for **PERSONAL PROJECTS**.
>
> If you're working on **NUDJ** (work projects), see **`CLAUDE-NUDJ.md`** instead.

---

## Repository Overview

**Aperture** is a multi-project development framework for personal experiments, prototypes, and side projects.

### Current Status
- **Active Projects**: 1 (wizard-of-oz)
- **Framework**: React, TypeScript, Vite
- **Deployment**: Vercel
- **Last Updated**: 2025-10-10

---

## Quick Start

### For New Sessions
Read these files IN ORDER:
1. **`START_HERE.md`** - Session startup guide
2. **`NEXT_SESSION.md`** - Current status and next steps
3. **`SESSION_CHECKLIST.md`** - Workflow and best practices

### For Specific Tasks
- **Wizard of Oz Development**: See `projects/wizard-of-oz/` section below
- **Process Improvements**: See `.process/` directory
- **GitHub Workflows**: See `.github/workflows/`

---

## 🎯 Current Tasks & Status

> **Last Updated**: 2025-10-13 (Session 12)
>
> **📍 For detailed tasks, implementation notes, and verification steps → See `NEXT_SESSION.md`**

**Active Project**: Wizard of Oz (Baby Photo App)
**Status**: 🟢 Upload working end-to-end, ready for client-side alignment implementation
**Blockers**: None

**Session 12 Accomplishments**:
- ✅ Fixed invalid Supabase API key (was truncated)
- ✅ Fixed photos stuck in "processing" state
- ✅ Fixed upload button stuck on "Detecting..."
- ✅ Enhanced logging throughout upload flow

**Next**: Implement client-side photo alignment using Canvas API

---

## Project Structure

```
Aperture/
├── .claude/               # Claude Code configuration
├── .github/              # GitHub workflows and templates
├── .process/             # Process documentation
│   └── COMMON_MISTAKES.md
├── projects/             # Individual projects
│   └── wizard-of-oz/    # Baby photo alignment app
├── knowledge-base/       # Reference materials
├── NEXT_SESSION.md      # 🔥 Current status
├── START_HERE.md        # 🔥 Entry point
└── SESSION_CHECKLIST.md # 🔥 Workflow guide
```

---

## Projects

### Wizard of Oz

**Status**: ✅ LIVE & DEPLOYED

A baby photo alignment application with AI-powered eye detection and timelapse generation.

#### Quick Facts
- **Location**: `projects/wizard-of-oz/`
- **Tech Stack**: React, TypeScript, Vite, Supabase, Gemini AI
- **Deployment**: Vercel (auto-deploy on push to main)
- **Features**:
  - Daily photo uploads (camera or gallery)
  - AI eye detection and face alignment
  - Calendar view for browsing photo history
  - Photo gallery with processing status

#### Key Files
- `projects/wizard-of-oz/src/` - Source code
- `projects/wizard-of-oz/DEPLOYMENT.md` - 🔥 **CRITICAL: Deployment requirements**
- `projects/wizard-of-oz/package.json` - Dependencies and scripts

#### Development
```bash
cd projects/wizard-of-oz
npm install
npm run dev          # Start dev server
npm run build        # Build for production (test before pushing!)
```

#### Deployment
**⚠️ CRITICAL**: All changes MUST be committed to `main` branch for Vercel auto-deployment.

See `projects/wizard-of-oz/DEPLOYMENT.md` for complete deployment workflow.

#### Configuration
- **Supabase**: Database and storage backend
- **Gemini AI**: Eye detection and image processing
- **Vercel**: Hosting and deployment
- **Environment Variables**: Set in Vercel dashboard
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## Tool Design Philosophy

> **Source**: [Anthropic - Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

### Quality Over Quantity
- Create focused, high-impact tools/utilities for specific workflows
- Consolidate similar functionality instead of creating many small tools
- Avoid unnecessary wrapper functions around existing APIs
- Each tool should solve a real, recurring problem

### Targeted Operations Over Broad Listing
- **Prefer**: `grep "pattern" --glob "*.tsx"` (targeted search)
- **Avoid**: Reading all files then filtering in memory
- **Prefer**: Specific queries with filters
- **Avoid**: Fetching everything then processing client-side

**Examples**:
```bash
# ❌ BAD: Broad then filter
find . -name "*.ts" -exec cat {} \; | grep "useState"

# ✅ GOOD: Targeted from start
grep -r "useState" --include="*.ts"

# ❌ BAD: Read entire file to find one function
cat src/utils/imageUtils.ts | grep "alignPhoto"

# ✅ GOOD: Grep with context
grep -A 20 "alignPhoto" src/utils/imageUtils.ts
```

### High-Signal Output Design
- Return meaningful, contextual information
- Use natural language identifiers over cryptic codes
- Set sensible limits (prefer 10-50 results, not 1000)
- Truncate strategically with "... N more results"
- Include actionable next steps in responses

**Examples**:
```typescript
// ❌ BAD: Low-signal technical IDs
{ photoId: "uuid-1234", status: 2, error: "ERR_003" }

// ✅ GOOD: High-signal contextual info
{
  photo: "baby-smile-2025-01-15.jpg",
  status: "processing",
  issue: "Eye detection failed - photo may be too dark"
}
```

### Error Context and Recovery
- Explain what went wrong AND what to try next
- Include specific file paths and line numbers
- Provide recovery commands when possible
- Reference related documentation

**Format**:
```
❌ Error: [What failed]
📍 Location: [file:line]
🔍 Cause: [Why it failed]
✅ Fix: [Specific command or action]
📚 See: [Related doc]
```

---

## Code Style & Standards

### TypeScript
- **NO** `any` types - use `unknown`
- Interfaces over types for props
- Strict type safety enabled

### React
- Functional components with hooks
- Handler prefix: `handleClick`, `handleSubmit`
- File size: Keep under 200-300 lines

### Naming Conventions
- Components: PascalCase (`CalendarView.tsx`)
- Directories: kebab-case (`wizard-of-oz/`)
- Hooks: camelCase with `use` prefix (`usePhotoStore`)
- Utils: camelCase (`formatDate`)

### File Organization
- Feature-based organization
- Co-locate related files
- Keep components focused and small

### Communication Patterns

**Transparency in execution** - Always communicate what you're doing:

#### 1. Announce Parallel Operations
```
Running these checks in parallel:
- Git status
- Build verification
- Production log review

[Single message with 3 Bash tool calls]
```

#### 2. Declare Subagent Launches
```
Launching deep-research agent to investigate X while I work on Y

[Task tool + Continue with implementation]
```

#### 3. State Checkpoint Creation
```
Creating checkpoint before this change (rollback available if needed)

Current state: [what's working]
About to change: [what you'll modify]
Risk: [Low/Medium/High]
```

#### 4. Report Background Processes
```
Build running in background (2 min) - continuing with tests

[Bash with run_in_background + Continue with other work]
[Later: BashOutput to check results]
```

#### 5. Explain Tool Selection
```
I'm going to:
1. Read these 3 files in parallel (faster than sequential)
2. Then search for X pattern across codebase
3. Then analyze findings

[Execute parallel Reads, then Grep, then analysis]
```

#### 6. Token-Efficient Output Design

**Principle**: Return high-signal information; truncate low-signal details.

**Good response patterns**:
```
Found 3 upload handlers:
1. src/components/Upload.tsx:45 - Main photo upload
2. src/lib/uploadToSupabase.ts:12 - Storage upload
3. src/hooks/usePhotoUpload.ts:67 - Upload hook

... 2 more test files (not shown)
```

**Bad response patterns**:
```
Found 247 files containing "upload"...
[dumps entire file list]
[dumps file contents]
[provides minimal actionable insight]
```

**Guidelines**:
- Limit lists to 5-10 most relevant items
- Summarize remaining items: "... N more"
- Prioritize by relevance, recency, or importance
- Use natural identifiers: "Upload button handler" not "fn_003"
- Include location with results: `file:line`
- Default to concise; expand when asked

**Why this matters**:
- ⚡ Faster responses (less token processing)
- 🎯 User gets actionable info immediately
- 💰 More work per session (token budget)
- 🔍 Easy to scan and understand

**Related docs**:
- `.claude/startup.md` - Steps 5.5 & 5.6 (Parallel patterns)
- `.process/BACKGROUND_PROCESSES.md` - Background process guide

---

## Development Philosophy

> **Source**: Adapted from DSPy principles - Programming language model systems

### Separation of Concerns

**Core Principle**: Explicitly separate *what* from *how* from *done*.

#### Task Definition (WHAT)
Define the goal and desired outcome:
- What problem are we solving?
- What are the inputs and outputs?
- What constraints must be met?
- What does success look like?

#### Implementation (HOW)
Choose approach and execute:
- Which tools and patterns to use?
- What's the step-by-step approach?
- How do we handle edge cases?
- What trade-offs are we making?

#### Verification (DONE)
Prove the task is complete:
- How do we test this works?
- What metrics prove success?
- What verification commands to run?
- When can we confidently mark this complete?

**Why this matters**:
- 🎯 Prevents scope confusion
- 🤝 Clearer handoffs between sessions
- ✅ Objective completion criteria
- 📊 Measurable progress

**Anti-pattern**:
```
❌ "Implement photo gallery" - unclear what/how/done all mixed together
```

**Good pattern**:
```
✅ WHAT: Display photos in grid with pagination
✅ HOW: Use CSS Grid, React state for current page
✅ DONE: All photos accessible, navigation works, tests pass
```

---

## Task Specification Pattern

> **Source**: Adapted from DSPy's signature-based programming

Before starting any significant task, define:

### Task Signature

**Format**: `[inputs] -> [outputs]`

**Example**: `file_paths, search_pattern -> relevant_files, confidence_scores, next_actions`

### Template

```markdown
### Task: [Task name]

**Signature**: `input_1, input_2 -> output_1, output_2`

**Inputs**:
- input_1: [description, type, source]
- input_2: [description, type, source]

**Outputs**:
- output_1: [description, type, format]
- output_2: [description, type, format]

**Validation Criteria**:

Must Have (Assert - task fails if missing):
- [ ] Critical requirement 1
- [ ] Critical requirement 2

Should Have (Suggest - improves quality):
- [ ] Nice-to-have feature 1
- [ ] Nice-to-have feature 2

**Success Metrics**:
- Metric 1: [quantifiable measure]
- Metric 2: [quantifiable measure]
- Verification: [specific command to test]

**Constraints**:
- Time budget: [X minutes]
- Token budget: [X tokens]
- Dependencies: [what must exist first]
- Risk level: [Low/Medium/High]
```

### Example Task Specification

```markdown
### Task: Implement photo gallery pagination

**Signature**: `photos[], page_size -> paginated_view, navigation_controls`

**Inputs**:
- photos[]: Array of photo objects from Supabase
- page_size: Number of photos per page (default: 20)

**Outputs**:
- paginated_view: Component rendering current page
- navigation_controls: Prev/Next buttons with proper state

**Validation Criteria**:

Must Have:
- [x] All photos accessible via pagination
- [x] Navigation disabled appropriately (no "prev" on page 1)
- [x] No duplicate photos across pages

Should Have:
- [ ] Page indicator (e.g., "Page 3 of 12")
- [ ] Keyboard shortcuts (arrow keys)
- [ ] URL reflects current page

**Success Metrics**:
- User can access all photos in ≤ 3 clicks
- Navigation state persists on refresh
- Zero duplicate or missing photos
- Verification: `npm run test -- gallery.test.ts`

**Constraints**:
- Time budget: 45 minutes
- Token budget: 15K tokens
- Dependencies: Photo fetching working, Zustand store setup
- Risk level: Low (UI-only, no data migration)
```

**When to use**:
- Complex features (> 30 min work)
- Cross-session work (need clear handoff)
- Multiple implementation approaches (need to choose)
- User-facing features (need clear success criteria)

**When to skip**:
- Trivial tasks (< 10 min)
- Obvious requirements
- One-line fixes

---

## Development Workflow

### Before Starting Work
1. Read `NEXT_SESSION.md` - understand current status
2. Check `SESSION_CHECKLIST.md` - follow workflow
3. Review `.process/COMMON_MISTAKES.md` - avoid known pitfalls
4. **For complex tasks**: Define task signature (see above)

### During Development
1. **Test builds locally**: `npm run build` before pushing
2. **Lint before commit**: Check for errors (not just warnings)
3. **Commit to main**: Required for Vercel deployment
4. **Clear commit messages**: Describe what and why
5. **Track against metrics**: Reference success criteria from task signature

### After Completing Work
1. **Verify against metrics**: Check all validation criteria met
2. Update `NEXT_SESSION.md` with what you completed
3. Document any learnings in `.process/COMMON_MISTAKES.md`
4. Push to main for deployment
5. Verify deployment succeeded

---

## Common Patterns

### Targeted File Operations

**Principle**: Use targeted searches instead of broad operations.

#### Searching for Code Patterns
```bash
# ❌ BAD: Read all files then search
cat src/components/*.tsx | grep "useState"

# ✅ GOOD: Targeted grep
grep -r "useState" src/components/ --include="*.tsx"

# ❌ BAD: Find all files, read them, search
find . -name "*.ts" -exec cat {} \; | grep "interface Photo"

# ✅ GOOD: Grep with context
grep -r "interface Photo" --include="*.ts" -A 5
```

#### Finding Specific Implementations
```bash
# ❌ BAD: List all files, manually check each
ls -la src/components/
cat src/components/Upload.tsx
cat src/components/Gallery.tsx
# ... check each one

# ✅ GOOD: Grep for the function directly
grep -r "handleUpload" src/ --include="*.tsx" -n
```

#### Understanding Component Usage
```bash
# ❌ BAD: Read entire codebase
Read src/*

# ✅ GOOD: Search for specific imports/usages
grep -r "import.*PhotoGallery" src/ --include="*.tsx"
```

**Why this matters**:
- ⚡ 10-100x faster execution
- 💰 Saves thousands of tokens per search
- 🎯 Immediate, relevant results
- 🔍 Built-in context with `-A/-B/-C` flags

### HTML File Inputs
```tsx
// ❌ BAD: Single input with capture forces camera for both buttons
<input type="file" accept="image/*" capture="environment" />

// ✅ GOOD: Separate inputs for camera vs gallery
<input ref={cameraInputRef} type="file" accept="image/*" capture="environment" />
<input ref={galleryInputRef} type="file" accept="image/*" />
```

### Vercel Deployment
```bash
# ❌ BAD: Working on feature branch
git checkout -b feature/new-thing
git push origin feature/new-thing  # Won't deploy!

# ✅ GOOD: All work on main
git add .
git commit -m "feat: add new thing"
git push origin main  # Auto-deploys to Vercel
```

---

## Environment & Tools

### Required
- **Node.js**: >= 18.0.0
- **npm**: Latest version
- **Git**: For version control

### Recommended
- **VS Code**: Primary editor
- **Claude Code**: AI assistance (you!)

---

## Documentation

### Key Documents
- **START_HERE.md** - New session entry point
- **NEXT_SESSION.md** - Current status and immediate next steps
- **SESSION_CHECKLIST.md** - Complete workflow guide
- **CONTRIBUTING.md** - Contribution guidelines
- **QUICK_REFERENCE.md** - Common commands and patterns
- **CHEATSHEET.md** - Quick tips and shortcuts

### Process Documentation
- **.process/COMMON_MISTAKES.md** - Lessons learned
- **.github/workflows/** - CI/CD configurations

---

## Critical Reminders

### For Development
- ✅ **Test builds locally first** - `npm run build` catches errors early
- ✅ **Commit to main branch** - Required for Vercel deployment
- ✅ **Read NEXT_SESSION.md first** - Always know current status
- ✅ **Update documentation** - Keep knowledge current

### For File Operations
- ✅ **File inputs with capture** - Forces camera, separate inputs needed
- ✅ **Git paths in Aperture** - Repository adds `Aperture/` prefix in paths

### For Deployment
- ✅ **Vercel auto-deploys from main** - No feature branches
- ✅ **Environment variables in Vercel** - Set in dashboard
- ✅ **Build errors block deployment** - Fix locally first

---

## Getting Help

### Documentation Hierarchy
1. Project-specific docs (e.g., `projects/wizard-of-oz/DEPLOYMENT.md`)
2. Process docs (`.process/COMMON_MISTAKES.md`)
3. Root docs (`NEXT_SESSION.md`, `SESSION_CHECKLIST.md`)

### Common Issues
- **Build fails**: Check TypeScript errors with `npm run build`
- **Deployment not triggered**: Ensure pushing to `main` branch
- **Vercel errors**: Check environment variables in dashboard

---

## Next Steps

See **`NEXT_SESSION.md`** for:
- Current project status
- Immediate next steps
- Priority features
- Known issues

---

**Remember**: This is **APERTURE** (personal projects). For **NUDJ** work, use **`CLAUDE-NUDJ.md`**.
