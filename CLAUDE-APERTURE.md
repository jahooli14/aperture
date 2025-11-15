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
- **Active Projects**: 5
  - **Personal**: Pupils (production), Polymath (production), Baby Milestone Tracker (new)
  - **Meta**: Visual Test Generator (documented), Self-Healing Tests, Autonomous Docs
- **Framework**: React, TypeScript, Vite
- **Deployment**: Vercel
- **Last Updated**: 2025-10-22 (Baby Milestone Tracker extracted from Polymath)

---

## Quick Start

### For New Sessions
Read these files IN ORDER:
1. **`START_HERE.md`** - Session startup guide
2. **`NEXT_SESSION.md`** - Current status and next steps
3. **`.process/SESSION_CHECKLIST.md`** - Workflow and best practices

### For Specific Tasks
- **Pupils Development**: See `projects/wizard-of-oz/` section below (app renamed to "Pupils")
- **Baby Milestone Tracker**: See `projects/baby-milestone-tracker/` section below
- **Polymath Development**: See `projects/polymath/` section below
- **Self-Healing Tests**: See `scripts/self-healing-tests/` (coming soon)
- **Autonomous Docs**: See `scripts/autonomous-docs/FEATURE_GUIDE.md`
- **Process Improvements**: See `.process/` directory
- **GitHub Workflows**: See `.github/workflows/`
- **New Project Ideas**: See `PROJECT_IDEAS.md`

---

## 🎯 Current Tasks & Status

> **Last Updated**: 2025-10-13 (Session 12)
>
> **📍 For detailed tasks, implementation notes, and verification steps → See `NEXT_SESSION.md`**

**Active Project**: Pupils (Baby Photo App)
**Status**: 🟢 Production - Feature complete and stable
**Blockers**: None

**Recent Updates**:
- ✅ App renamed from "Wizard of Oz" to "Pupils" (Oct 24, 2025)
- ✅ Smooth zoom level transitions
- ✅ Age-based zoom levels for photo alignment
- ✅ Email reminders system
- ✅ Comment chips on photos with notes

**Next**: See `projects/wizard-of-oz/NEXT_SESSION.md` for latest tasks

---

## Project Structure

```
Aperture/
├── .claude/               # Claude Code configuration
├── .github/              # GitHub workflows and templates
├── .process/             # Process documentation
│   └── COMMON_MISTAKES.md
├── projects/             # Personal projects
│   ├── wizard-of-oz/    # Pupils (baby photo alignment app)
│   ├── baby-milestone-tracker/  # AI-powered developmental milestone tracker
│   └── polymath/        # Voice-to-memory knowledge graph & creative project tracker
├── scripts/             # Meta projects (infrastructure)
│   ├── autonomous-docs/ # Self-optimizing documentation
│   └── self-healing-tests/ # Automated test repair (coming soon)
├── knowledge-base/       # Reference materials
├── NEXT_SESSION.md      # 🔥 Current status
├── START_HERE.md        # 🔥 Entry point
└── .process/SESSION_CHECKLIST.md # 🔥 Workflow guide
```

---

## Projects

### Pupils

**Status**: ✅ LIVE & DEPLOYED

A baby photo alignment application with AI-powered eye detection and timelapse generation.

> **Note**: The app is named "Pupils" but the folder remains `wizard-of-oz/` to avoid breaking Vercel deployments.

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

### Baby Milestone Tracker

**Status**: 🆕 NEW - Extracted from Polymath (Oct 22, 2025)

An AI-powered developmental milestone tracking system that helps parents capture and understand their child's development through voice memories.

#### Quick Facts
- **Location**: `projects/baby-milestone-tracker/`
- **Tech Stack**: React, TypeScript, Vite, Supabase, Gemini AI
- **Deployment**: Standalone or integrated with other memory systems
- **Created**: 2025-10-22 (Extracted from Polymath)

#### What It Is
- **Voice-first**: Simply speak about your child's day naturally
- **AI detection**: Automatically identifies developmental milestones (60+ milestones across 6 domains)
- **Timeline view**: Beautiful visualization of development progress
- **Evidence-based**: Every milestone linked to actual quotes from your voice notes
- **Insights**: AI-generated patterns and progression analysis

#### Features
- 🌱 **Automatic Milestone Detection**
  - Gross Motor (rolling, crawling, walking)
  - Fine Motor (grasping, stacking)
  - Language (first words, phrases)
  - Cognitive (problem-solving, object permanence)
  - Social-Emotional (smiles, sharing)
  - Self-Care (feeding, dressing)
- 📊 **Timeline Visualization** - See all milestones chronologically
- 🔍 **Evidence Extraction** - Exact quotes showing each milestone
- 💡 **AI Insights** - Pattern recognition and development analysis
- 📈 **Progression Tracking** - Velocity and domain coverage
- 🎯 **Confidence Scoring** - High/medium/low certainty on detections

#### Integration
Can be integrated with:
- **Polymath** - Add milestone detection to memory processing
- **MemoryOS** - Voice note milestone tracking
- **Audiopen** - Direct webhook integration
- **Custom Apps** - Standalone API available

#### Key Files
- `projects/baby-milestone-tracker/README.md` - Complete documentation
- `projects/baby-milestone-tracker/NEXT_SESSION.md` - Setup and next steps
- `projects/baby-milestone-tracker/lib/milestone-detector.ts` - AI detection engine
- `projects/baby-milestone-tracker/lib/milestone-taxonomy.ts` - 60+ milestone library
- `projects/baby-milestone-tracker/scripts/add-milestone-tables.sql` - Database schema

#### Development Status
- ✅ Core library complete (detection, taxonomy, processing)
- ✅ Database schema ready
- ✅ API endpoints ready
- ✅ Timeline UI component ready
- ⏳ Not yet deployed (standalone)
- ⏳ Integration testing needed

#### Quick Start
```bash
cd projects/baby-milestone-tracker
npm install
cp .env.example .env
# Edit .env with your Supabase and Gemini API keys
npm run dev
```

---

### Polymath

**Status**: ✅ LIVE & DEPLOYED

A meta-creative synthesis engine that generates novel project ideas by combining your capabilities with your interests. Voice-to-memory personal knowledge graph with AI-powered project suggestions.

#### What It Is
- **Captures interests** via voice notes (Audiopen) → extracts recurring themes
- **Scans codebase** → identifies technical capabilities
- **AI synthesis** → generates novel project suggestions at the intersection
- **Activity learning** → tracks git commits → strengthens capability nodes
- **Knowledge graph** → builds connections between interests, capabilities, and projects

#### Core Mechanisms
- **Weekly Synthesis**: AI scans capabilities + interests, generates 10 project suggestions
- **Point Allocation**: Each suggestion scored on novelty (30%) + feasibility (40%) + interest (30%)
- **Diversity Injection**: Every 4th suggestion is a "wild card" 🎲 to prevent echo chamber
- **Node Strengthening**: Git activity strengthens capability nodes → influences future suggestions
- **Permanent Ideas List**: All suggestions tracked (pending, spark, meh, built, dismissed, saved)

#### Tech Stack
- **Frontend**: React 18.3, TypeScript, Vite, React Router DOM, Zustand
- **Backend**: Vercel Serverless Functions (Node.js 20.x)
- **Database**: Supabase (PostgreSQL 15 + pgvector)
- **AI**: Claude Sonnet 4.5 (synthesis), Gemini 2.5 Flash (embeddings + entity extraction)
- **Automation**: Vercel Cron Jobs (Monday 09:00 UTC synthesis, Daily 00:00 UTC strengthening)

#### Implementation Status
- ✅ Complete design (13 documentation files)
- ✅ All implementation files in `projects/polymath/`
- ✅ Scripts ready (capability-scanner, synthesis, strengthen-nodes, seed-test-data)
- ✅ API endpoints ready (7 endpoints)
- ✅ React components ready (5 components)
- ✅ TypeScript types complete (477 lines)
- ✅ Dependencies configured (Gemini for embeddings, no OpenAI)
- ✅ Cron jobs configured
- ⏳ Database migration needed (`scripts/migration.sql`)
- ⏳ UI pages to be created (ProjectsPage, SuggestionsPage, AllIdeasPage)
- ⏳ Routing to be added (react-router-dom)
- ⏳ State management to be added (Zustand stores)

#### Location
**All files in**: `projects/polymath/`

#### Key Documentation
- `projects/polymath/START_HERE.md` - Entry point and navigation
- `projects/polymath/README.md` - Project overview
- `projects/polymath/CONCEPT.md` - Vision and design principles
- `projects/polymath/ARCHITECTURE.md` - Technical design with algorithms
- `projects/polymath/ROADMAP.md` - 10-phase implementation plan
- `projects/polymath/TESTING_GUIDE.md` - Step-by-step testing instructions
- `projects/polymath/NEXT_SESSION.md` - Current status and quick start

---

### Self-Healing Tests (Meta Project)

**Status**: 🔵 PLANNED

Automated test repair system that uses AI to detect, diagnose, and fix failing tests.

#### Quick Facts
- **Location**: `scripts/self-healing-tests/` (to be created)
- **Purpose**: Reduce test maintenance burden through AI-powered repair
- **Type**: Meta project (infrastructure/tooling)

#### Concept
- Monitors test runs for failures
- Analyzes failure patterns
- Attempts automated fixes
- Generates reports on test health
- Learns from successful repairs

#### Development Status
- ⏳ Not yet implemented
- ⏳ Design phase pending

---

### Autonomous Docs (Meta Project)

**Status**: 🟢 ACTIVE

Self-optimizing documentation system that updates daily with latest AI/Claude best practices.

#### Quick Facts
- **Location**: `scripts/autonomous-docs/`
- **Purpose**: Keep documentation current with frontier AI knowledge
- **Type**: Meta project (infrastructure/tooling)
- **Active**: Updates daily at 09:00 UTC

#### How It Works
- Fetches latest AI research and Claude best practices
- Optimizes documentation for token efficiency
- **Replaces** outdated content (not additive)
- Four modes: REPLACE, MERGE, REFACTOR, NEW

#### Key Files
- `scripts/autonomous-docs/FEATURE_GUIDE.md` - How to use and modify the system
- `knowledge-base/changelogs/` - Track what changed each day
- `.github/workflows/autodoc.yml` - Daily automation workflow

#### Documentation
- See `scripts/autonomous-docs/FEATURE_GUIDE.md` for complete guide

---

## Autonomous Mode (Lazy Bear Workflow)

> **Source**: Inspired by Claude Code's multi-agent swarm capabilities (2025)
>
> **Purpose**: Give initial prompt → step away → return when done

### What Is Autonomous Mode?

A workflow where you provide high-level requirements and Claude orchestrates multiple specialized agents to complete the entire feature without requiring your input until completion.

**Key difference from normal mode**:
- **Normal**: You shepherd each step, approve decisions, provide context
- **Autonomous**: Claude spawns sub-agents, coordinates work, only surfaces when done/blocked/critical decision

### When to Use Autonomous Mode

**Trigger phrases**:
- "Autonomous mode: [task]"
- "Lazy bear: [task]"
- "Build this without my input: [task]"
- "Wake me when it's done: [task]"

**Good candidates**:
- Well-defined features with clear success criteria
- Tasks following established patterns in codebase
- Multi-step implementations (backend + frontend + tests)
- Refactoring with existing test coverage
- Bug fixes with clear reproduction steps

**Bad candidates**:
- Ambiguous requirements ("make it better")
- Novel architectural decisions
- Breaking changes requiring user judgment
- Tasks touching production data without backups

### How Autonomous Mode Works

#### Phase 1: Analysis & Planning (2-5 min)
```
1. Spawn codebase-pattern-analyzer agent
   → Maps all affected files
   → Identifies dependencies
   → Suggests parallelization strategy

2. Create execution plan with:
   → Parallel task breakdown
   → Agent assignments
   → Success criteria
   → Rollback points
   → Estimated completion time

3. Present plan with approve/modify option
```

#### Phase 2: Autonomous Execution (varies)
```
4. Launch specialized agents in parallel:
   → Backend implementation agent
   → Frontend implementation agent
   → Test creation agent
   → Each works independently on assigned scope

5. Coordinate agent handoffs:
   → Agent A completes → outputs to Agent B
   → Shared state via NEXT_SESSION.md
   → Conflict resolution via git

6. Iterative refinement without user input:
   → Run tests → fix failures → re-run
   → Build → fix errors → rebuild
   → Lint → fix issues → re-lint
   → Continue until all checks pass

7. Integration validation:
   → All agent outputs merged
   → End-to-end tests run
   → Success criteria verified
```

#### Phase 3: Completion Report
```
8. Surface to user with:
   ✅ What was built
   ✅ How it works (brief)
   ✅ Tests passing (proof)
   ✅ Deployment status
   ✅ Next steps (if any)

   OR

   🚫 Blocked on: [specific issue]
   🔍 Need decision: [A or B?]
   📊 Progress so far: [what's done]
```

### Autonomous Mode Protocol

**When user triggers autonomous mode:**

```markdown
### Autonomous Mode Activated

**Task**: [user's request]

**Phase 1: Analysis (running codebase-pattern-analyzer)**
[2-3 min passes]

**Execution Plan**:

Agents to spawn:
1. codebase-pattern-analyzer → identify affected files [2 min]
2. general-purpose (backend) → implement API endpoints [15 min]
3. general-purpose (frontend) → implement UI components [15 min]
4. general-purpose (tests) → write integration tests [10 min]
5. check-and-challenge → review everything [5 min]

Parallel execution strategy:
- Agents 2-4 run concurrently after Agent 1 completes
- Agent 5 runs after Agents 2-4 complete

Success criteria:
- All tests passing
- Build successful
- Feature works end-to-end per requirements
- No console errors

Estimated time: 45-60 min
Rollback: Current state saved to git stash

[APPROVE / MODIFY / CANCEL]
```

**After approval:**

```markdown
**Phase 2: Autonomous Execution**

Launching agents in parallel... (I'll work for ~45 min and report back)

[Claude goes silent for 45 min, agents work autonomously]

**Phase 3: Completion Report**

✅ Feature complete: [name]

What was built:
- Backend: 3 new API endpoints in api/routes/[...]
- Frontend: 2 new components in src/components/[...]
- Tests: 12 integration tests (all passing)
- Build: ✅ Successful
- Deployment: ✅ Live on staging

Verification:
- npm test: ✅ 47/47 passing
- npm run build: ✅ No errors
- Manual testing: ✅ Feature works as specified

Next steps:
- Test on staging: [URL]
- Deploy to production when ready: git push origin main
```

### Coordination Mechanisms

#### 1. Agent Communication via NEXT_SESSION.md
```markdown
## Agent Coordination Log

**Backend Agent** (15:23):
- Created 3 API endpoints
- Output contract: { data: Memory[], total: number }
- Exports: `GET /api/memories`, `POST /api/memories`, `DELETE /api/memories/:id`
- Next: Frontend Agent needs to call these with auth headers

**Frontend Agent** (15:25):
- Acknowledged backend contract
- Implementing UI with auth headers
- Progress: 2/3 components done
- Blocked: None

**Test Agent** (15:28):
- Tests written for all 3 endpoints
- 8/12 tests passing
- 4 failing: auth issues
- Coordinating with Backend Agent for fix
```

#### 2. Parallel Execution Pattern
```typescript
// Single message with multiple Task calls
await Promise.all([
  Task("Implement backend", { agent: "general-purpose", scope: "api/" }),
  Task("Implement frontend", { agent: "general-purpose", scope: "src/components/" }),
  Task("Write tests", { agent: "general-purpose", scope: "tests/" })
])

// Agents work concurrently, report back when done
```

#### 3. Background Process Monitoring
```bash
# Long-running tasks use background Bash
npm test --watch  # Running in background (bash_id: abc123)

# Claude checks periodically
BashOutput(bash_id: "abc123")  # See latest results

# Agents continue working while tests run
```

#### 4. State Checkpoints
```bash
# Before major changes
git stash push -m "checkpoint: before autonomous execution"

# If something goes wrong
git stash pop  # Rollback to checkpoint
```

### Pre-Approved Operations (No User Input Needed)

When in autonomous mode, these operations are **automatically approved**:

1. **Testing & Fixing**
   - Run tests → fix failures → re-run (up to 5 iterations)
   - Build → fix errors → rebuild (up to 3 iterations)
   - Lint → fix issues → re-lint (unlimited, automated)

2. **File Operations**
   - Create new files (following project conventions)
   - Edit existing files (within task scope)
   - Delete files (only if tests confirm safe)

3. **Git Operations**
   - Create checkpoints (stash before major changes)
   - Commit completed work (with descriptive messages)
   - **NOT approved**: Push to main (requires explicit user confirmation)

4. **Agent Spawning**
   - Launch specialized agents per execution plan
   - Re-launch agents if initial attempt fails
   - Max 10 total agent spawns per autonomous session

5. **Iteration & Refinement**
   - Fix failing tests (up to 5 cycles)
   - Refactor for passing lints
   - Optimize based on success criteria

**Surface to user immediately if**:
- Critical error (data loss risk)
- Ambiguous requirement (multiple valid approaches)
- External dependency missing (API key, service unavailable)
- Success criteria can't be met (need requirement change)
- Token budget >80% consumed
- Time estimate exceeded by 2x

### Token Budget Management

**Autonomous sessions consume more tokens**. Guidelines:

- **Estimate upfront**: Show expected token cost in execution plan
- **Set limits**: Max 50K tokens per autonomous session
- **Monitor continuously**: Alert at 40K (80%)
- **Optimize agents**: Use targeted tools (Grep, not Read all files)
- **Early exit**: Stop if approaching limit, report progress

**Example**:
```
Token budget:
- Phase 1 (Analysis): ~5K tokens
- Phase 2 (Execution): ~35K tokens (5 agents × 7K each)
- Phase 3 (Report): ~2K tokens
- Buffer: ~8K tokens
Total estimate: ~50K tokens

Limit: 50K (I'll stop at 40K and report progress)
```

### Safety Guardrails

**Autonomous mode includes automatic safeguards**:

1. **Checkpoints before major changes** (git stash)
2. **Test-driven validation** (must pass before proceeding)
3. **Iteration limits** (max 5 test-fix cycles)
4. **Time limits** (alert if 2x over estimate)
5. **Token limits** (stop at 80% budget)
6. **Read-only by default** (no production writes without explicit scope)

### Example: Autonomous Feature Build

**User input**:
```
Autonomous mode: Add social sharing for Polymath memories
```

**Claude response**:
```markdown
**Autonomous Mode Activated**

**Task**: Add social sharing for Polymath memories

**Phase 1: Analysis** (codebase-pattern-analyzer running...)

**Execution Plan**:

Agents:
1. Pattern Analyzer → map affected files (3 min)
2. Backend → sharing API + URL generation (12 min)
3. Frontend → share button + modals (15 min)
4. Tests → integration tests (8 min)
5. Reviewer → validate everything (5 min)

Strategy:
- Agent 1 completes → Agents 2-4 run in parallel → Agent 5 reviews

Success criteria:
- Share button on memory cards
- Generates shareable URL
- Public view (no auth) shows memory
- Tests pass (sharing + public view)
- No private data leaked

Files to change:
- api/routes/memories.ts (new endpoint)
- src/components/MemoryCard.tsx (share button)
- src/pages/PublicMemory.tsx (new page)
- tests/sharing.test.ts (new tests)

Estimated time: 40-50 min
Token budget: ~45K
Rollback: git stash "checkpoint: before social sharing"

[APPROVE / MODIFY / CANCEL]
```

**User**: `APPROVE`

**Claude works for 45 min autonomously, then:**

```markdown
**Phase 3: Completion Report**

✅ Social sharing feature complete

What was built:
- Backend: `POST /api/memories/:id/share` → generates public URL
- Frontend: Share button on memory cards → copies URL to clipboard
- Public view: `/share/:token` → displays memory (no auth required)
- Tests: 11 integration tests → all passing

Code changes:
- api/routes/memories.ts:245 - New share endpoint
- src/components/MemoryCard.tsx:67 - Share button added
- src/pages/PublicMemory.tsx - New public view page
- tests/sharing.test.ts - New test suite

Verification:
✅ npm test (58/58 passing)
✅ npm run build (no errors)
✅ Manual test: Share button works, URL accessible

Security validation:
✅ Public URLs don't expose private data
✅ Token-based access (not guessable)
✅ No user info leaked in public view

Ready to deploy:
git push origin main

OR test on staging first:
[staging URL will be available after push]
```

### Exiting Autonomous Mode

**User can interrupt at any time**:
- New message → Claude stops agents, reports current progress
- Agents complete their current task, don't start new ones

**Autonomous mode ends when**:
- Success criteria met → completion report
- Blocked on user decision → surface with options
- Token budget at 80% → progress report + pause
- Time exceeded 2x estimate → progress report + replan option

**After autonomous session**:
- NEXT_SESSION.md updated with full context
- Git checkpoint available for rollback
- All agent outputs logged for debugging

---

## Tool Design Philosophy

> **Source**: [Anthropic - Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

### Quality Over Quantity
- Create focused, high-impact tools/utilities for specific workflows.
- Consolidate similar functionality instead of creating many small tools.
- Avoid unnecessary wrapper functions around existing APIs.
- Each tool should solve a real, recurring problem.
- **Example**: AI agent "Skills" (e.g., Claude's) exemplify this by encapsulating institutional knowledge into automatic, targeted workflows, ensuring consistency across specific tasks like report structuring or client communication. [Source: reddit-claude]

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

### Debugging First Principles

> **Source**: [META_DEBUGGING_PROTOCOL.md](/META_DEBUGGING_PROTOCOL.md) - Universal debugging methodology
>
> **Core insight**: 80% of bugs are input/assumption issues, not algorithm issues

**Two-phase approach**:

1. **Verify Inputs First** (10 min) - Check infrastructure, logs, and input assumptions
2. **Systematic Reduction** (variable) - Find repro → Narrow → Remove → Root cause

**See** [`META_DEBUGGING_PROTOCOL.md`](/META_DEBUGGING_PROTOCOL.md) for complete methodology.

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
2. Check `.process/SESSION_CHECKLIST.md` - follow workflow
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

## Loop Pattern with Safeguards

> **Source**: Adapted from Google Cloud Loop Pattern for agentic systems
>
> **Purpose**: Iterative refinement with explicit exit conditions to prevent infinite loops and token waste

### When to Use

**Good use cases**:
- Retry logic with error recovery
- Iterative improvement based on validation
- Progressive refinement until criteria met
- Self-healing workflows

**Anti-pattern**: Unbounded loops without clear termination

### Pattern Structure

```typescript
// Example: Retry with exponential backoff and max attempts
async function uploadWithRetry(
  file: File,
  maxAttempts: number = 3,
  timeoutMs: number = 30000
): Promise<UploadResult> {
  let attempt = 0
  let lastError: Error | null = null
  const startTime = Date.now()

  while (attempt < maxAttempts) {
    // Safeguard 1: Maximum iteration limit
    attempt++
    console.log(`Upload attempt ${attempt}/${maxAttempts}`)

    // Safeguard 2: Total timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Upload timed out after ${timeoutMs}ms`)
    }

    try {
      const result = await uploadPhoto(file)

      // Safeguard 3: Validate success condition
      if (!result.url) {
        throw new Error('Upload succeeded but no URL returned')
      }

      console.log(`✅ Upload succeeded on attempt ${attempt}`)
      return result

    } catch (error) {
      lastError = error

      // Safeguard 4: Classify error (retryable vs fatal)
      if (error.message.includes('Invalid file type')) {
        // Fatal error - don't retry
        throw error
      }

      if (attempt === maxAttempts) {
        // Exhausted retries
        throw new Error(
          `Upload failed after ${maxAttempts} attempts: ${lastError.message}`
        )
      }

      // Safeguard 5: Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      console.log(`Retry in ${backoffMs}ms...`)
      await delay(backoffMs)

      // Safeguard 6: Log iteration state for debugging
      console.log(`Retry context: attempt=${attempt}, error=${error.message}`)
    }
  }

  // Should never reach here, but safeguard anyway
  throw new Error(`Upload loop exited unexpectedly`)
}
```

### Required Safeguards

**Every loop MUST have**:

1. **Maximum Iteration Limit**
   ```typescript
   const MAX_ATTEMPTS = 5
   if (attempt >= MAX_ATTEMPTS) {
     throw new Error('Maximum attempts exceeded')
   }
   ```

2. **Total Timeout**
   ```typescript
   const TIMEOUT_MS = 60000 // 1 minute
   if (Date.now() - startTime > TIMEOUT_MS) {
     throw new Error('Operation timed out')
   }
   ```

3. **Explicit Success Condition**
   ```typescript
   if (isSuccessful(result)) {
     return result // Exit loop on success
   }
   ```

4. **Error Classification**
   ```typescript
   if (isFatalError(error)) {
     throw error // Don't retry fatal errors
   }
   ```

5. **Progress Tracking**
   ```typescript
   console.log(`Iteration ${i}: ${getProgressMetric()}`)
   // Must show measurable progress, not spinning
   ```

6. **State Logging**
   ```typescript
   console.log({
     attempt,
     elapsed: Date.now() - startTime,
     lastError: error?.message,
     progress: getProgressMetric()
   })
   ```

### Loop Pattern Anti-Patterns

**❌ BAD: Unbounded loop**
```typescript
while (true) {
  // No exit condition!
  const result = await tryOperation()
  if (result.success) break
}
```

**❌ BAD: No progress validation**
```typescript
for (let i = 0; i < 100; i++) {
  const result = await refine(input)
  // How do we know it's getting better?
  // Could be spinning without improvement
}
```

**❌ BAD: No timeout**
```typescript
let attempts = 0
while (attempts < 10) {
  // Each attempt could take forever
  await longRunningOperation()
  attempts++
}
```

**✅ GOOD: All safeguards present**
```typescript
async function refineUntilValid(
  input: string,
  maxAttempts: number = 5,
  timeoutMs: number = 30000
): Promise<string> {
  let attempt = 0
  const startTime = Date.now()
  let currentInput = input
  let previousQuality = 0

  while (attempt < maxAttempts) {
    attempt++

    // Timeout safeguard
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Refinement timed out after ${timeoutMs}ms`)
    }

    const refined = await refine(currentInput)
    const quality = await measureQuality(refined)

    // Progress validation
    if (quality <= previousQuality) {
      console.warn(`No improvement: ${quality} <= ${previousQuality}`)
      // Could exit or continue, but we KNOW we're not progressing
    }

    // Success condition
    if (quality >= 0.9) {
      console.log(`✅ Refinement succeeded: quality=${quality}`)
      return refined
    }

    // State logging
    console.log({
      attempt,
      quality,
      improvement: quality - previousQuality,
      elapsed: Date.now() - startTime
    })

    previousQuality = quality
    currentInput = refined
  }

  throw new Error(`Failed to reach quality threshold after ${maxAttempts} attempts`)
}
```

### Claude Code Loop Usage

**When I (Claude) use loops**:

**Appropriate**:
```
Retrying failed API calls (max 3 attempts, 30s timeout)
Iterating through search results (max 10 items, early exit)
Progressive file reading (offset pagination, known total)
```

**Inappropriate**:
```
Searching "until I find it" (no max attempts)
Refining code "until perfect" (no quality metric)
Reading files in loop (should use targeted operations instead)
```

**Token Budget Awareness**:
- Each loop iteration costs tokens
- Set conservative max attempts (3-5, not 100)
- Exit early when possible
- Log iteration count and token usage

### Communication Pattern

**Before starting loop**:
```
I'm going to retry [OPERATION] with safeguards:
- Max attempts: 3
- Timeout: 30s
- Exit on: [success condition]
- Won't retry: [fatal error types]

This prevents infinite loops and token waste.
```

**During loop** (if multiple iterations):
```
Attempt 2/3: [what happened]
Progress: [measurable improvement]
Continuing...
```

**After loop**:
```
✅ Succeeded on attempt 2/3
OR
❌ Failed after 3/3 attempts: [final error]
```

### Why This Matters

- 🛡️ Prevents infinite loops (token budget exhaustion)
- 📊 Measurable progress (not spinning endlessly)
- ⏱️ Time-bounded operations (predictable performance)
- 🔍 Observable behavior (can debug what went wrong)
- 💰 Token efficiency (early exit on success)

**Real example from Aperture**:
```typescript
// Photo upload with retry (see wizard-of-oz/src/lib/uploadToSupabase.ts)
// - Max 3 attempts
// - 30s timeout per attempt
// - Exponential backoff (1s, 2s, 4s)
// - Exits early on success
// - Classifies errors (network vs validation)
```

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
- **`.process/SESSION_CHECKLIST.md`** - Complete workflow guide
- **CONTRIBUTING.md** - Contribution guidelines
- **`.process/QUICK_REFERENCE.md`** - Common commands and patterns

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
3. Root docs (`NEXT_SESSION.md`, `.process/SESSION_CHECKLIST.md`)

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
