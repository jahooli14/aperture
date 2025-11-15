# Context Engineering Analysis

> **Purpose**: Compare proposed context engineering best practices against Aperture's current process
>
> **Date**: 2025-10-12
>
> **Status**: Analysis for optimization

---

## Proposed Best Practices Summary

### Key Principles from Research

1. **Contextual Grounding (Mandatory)**
   - Response MUST be grounded exclusively in provided XML documentation
   - Quote relevant sections with line numbers before generating code
   - Cite sources for all decisions

2. **Retrieval Verification**
   - If context insufficient, use MCP tools to query external docs
   - Must state query parameters explicitly
   - Reference architecture and file paths from CLAUDE.md

3. **Action State Management**
   - Create/update task checklist in CLAUDE.md for multi-step tasks
   - Detail required steps, file modifications, verification commands
   - Check off items only after successful execution and verification
   - Document step-by-step process

4. **Output Format**
   - Provide full revised code files for modified files only
   - Maintain brevity and authority in explanations

---

## Current Aperture Process

### ✅ What We Already Do Well

#### 1. **Contextual Grounding**
- ✅ `START_HERE.md` - mandatory entry point
- ✅ `NEXT_SESSION.md` - current state documentation
- ✅ `CLAUDE-APERTURE.md` - project patterns and conventions
- ✅ `.claude/startup.md` - automatic context loading
- ✅ Project-specific READMEs and plan.md files

**Strength**: We have strong foundational documentation that grounds every session.

#### 2. **Retrieval Verification**
- ✅ File reading tools (Read, Glob, Grep)
- ✅ Slash commands for infrastructure checks (`/verify-infra`, `/vercel-logs`)
- ✅ Explicit "if unclear, ask" guidance in startup docs

**Strength**: We have tools and explicit permission to query when context is insufficient.

#### 3. **Action State Management**
- ✅ `TodoWrite` tool for tracking tasks
- ✅ Multi-step task breakdowns in NEXT_SESSION.md
- ✅ Session Checklist for workflow
- ✅ RECENTLY ADDED: Progressive NEXT_SESSION.md updates during session

**Strength**: We track progress and state throughout sessions.

#### 4. **Output Format**
- ✅ Concise, direct communication style (documented in CLAUDE.md)
- ✅ Code-focused outputs with minimal preamble
- ✅ "Do what's asked, nothing more" principle

**Strength**: We avoid verbose explanations and focus on action.

---

## 🔍 Gaps Identified

### Gap 1: **Source Citation & Line Number References**

**Proposed Practice**:
> "Before generating any code, you must quote the relevant sections (including line numbers from `<source>` tag) from `<document_content>` elements"

**Current Practice**:
- We reference files by name but don't consistently cite line numbers
- We don't quote relevant sections before making decisions
- No explicit "grounding statement" before code generation

**Example of Gap**:
```
❌ Current: "I'll update the alignment function"
✅ Proposed: "Based on NEXT_SESSION.md:75-90 which states 'Implement coordinate
scaling', I'll update the alignment function in align-photo-v4.ts"
```

**Impact**: Medium
- Makes reasoning traceable
- Helps user verify decisions
- Creates audit trail

**Recommendation**: 🟡 IMPLEMENT PARTIALLY
- Add for major decisions only (not every line)
- Format: `file_path:line_number` (we already use this pattern!)
- Example: "Per META_DEBUGGING_PROTOCOL.md:88-92, verifying inputs first"

---

### Gap 2: **Explicit MCP Query Documentation**

**Proposed Practice**:
> "You must clearly state the parameters of the query you execute"

**Current Practice**:
- We use tools (Glob, Grep, Read) but don't explicitly state query parameters beforehand
- Tool usage is reactive, not declarative

**Example of Gap**:
```
❌ Current: [Uses Grep tool silently]
✅ Proposed: "Querying codebase for 'align-photo' pattern in *.ts files to
locate implementation. Query params: pattern='align-photo', glob='**/*.ts'"
```

**Impact**: Low
- Adds verbosity without much value
- User can see tool calls in UI already

**Recommendation**: ❌ DON'T IMPLEMENT
- Current approach is sufficient
- Tool results are visible to user
- Adding explicit query documentation is redundant noise

---

### Gap 3: **Dedicated Task Checklist in CLAUDE.md**

**Proposed Practice**:
> "Create or update a dedicated task checklist within the CLAUDE.md file"

**Current Practice**:
- We use `TodoWrite` tool (ephemeral, session-scoped)
- Task lists in NEXT_SESSION.md (persistent but separate file)
- No centralized task tracking IN CLAUDE.md itself

**Example of Gap**:
```
❌ Current: Tasks in NEXT_SESSION.md + TodoWrite tool
✅ Proposed: Section in CLAUDE-APERTURE.md:
   ## Current Tasks
   - [x] Fix coordinate scaling
   - [ ] Deploy to production
   - [ ] Clean up test files
```

**Impact**: High
- Creates single source of truth for project state
- Persistent across sessions without separate file
- CLAUDE.md is already the entry point

**Recommendation**: 🟢 IMPLEMENT
- Add "## Current Tasks" section to CLAUDE-APERTURE.md
- Update during session (not just TodoWrite)
- Format: `- [ ] Task` / `- [x] Task` for markdown compatibility
- Link to NEXT_SESSION.md for detailed context

---

### Gap 4: **Verification Command Documentation**

**Proposed Practice**:
> "Detail required steps, file modifications, and verification commands"

**Current Practice**:
- We document what to do but not always HOW to verify
- Verification is implicit ("check logs") not explicit commands

**Example of Gap**:
```
❌ Current: "Deploy and verify it works"
✅ Proposed:
   - [ ] Deploy to Vercel
   - [ ] Verify: `curl https://api.vercel.com/.../deployments`
   - [ ] Verify: `/vercel-logs align-photo 10`
   - [ ] Verify: Check for errors in output
```

**Impact**: Medium
- Makes tasks more actionable
- Ensures nothing is missed
- Creates repeatable process

**Recommendation**: 🟢 IMPLEMENT
- Add explicit verification commands to task lists
- Format: `Verify: <command or check>`
- Include in NEXT_SESSION.md task breakdowns

---

### Gap 5: **Full File Output Policy**

**Proposed Practice**:
> "Provide the full, revised code files only for the specific files modified"

**Current Practice**:
- We often use `Edit` tool (partial updates)
- Sometimes show full files, sometimes just snippets
- No consistent policy

**Example of Gap**:
```
❌ Current: Edit tool changes one function
✅ Proposed: Show entire file after modification for context
```

**Impact**: Low (for our use case)
- Full files add token usage for large files
- Edit tool is more precise
- Depends on file size

**Recommendation**: 🟡 CONDITIONAL
- Small files (< 200 lines): Show full file after Edit
- Large files: Use Edit tool, show context around change
- Add policy to DEVELOPMENT.md

---

## 🎯 Recommended Changes

### Priority 1: HIGH IMPACT 🟢

#### 1. Add "Current Tasks" Section to CLAUDE-APERTURE.md

**Location**: After "Quick Start" section

**Format**:
```markdown
## 🎯 Current Tasks & Status

**Last Updated**: 2025-10-12

### Active Work
- [x] Fix coordinate scaling bug in alignment
- [x] Implement Python OpenCV solution
- [x] Create debugging protocols
- [ ] Create production Node.js wrapper for OpenCV
  - Verify: `npm run build` succeeds
  - Verify: `/vercel-logs align-photo 10` shows no errors
- [ ] Deploy to Vercel
  - Verify: `curl https://wizard-of-oz.vercel.app/api/align-photo`
- [ ] Clean up test scripts

**See NEXT_SESSION.md for detailed context and implementation notes.**
```

**Benefits**:
- Single source of truth in main documentation
- Quick status check without reading full NEXT_SESSION.md
- Persistent across sessions
- Includes verification commands

**Update Frequency**:
- After completing major tasks
- After breakthroughs or pivots
- Before closing session

---

#### 2. Add Verification Commands to Task Lists

**Update**: `.process/DEVELOPMENT.md` and NEXT_SESSION.md templates

**New Rule**:
Every task in a checklist must include verification step if applicable.

**Format**:
```markdown
- [ ] Deploy new alignment function
  - Verify: `git push && vercel --prod`
  - Verify: Check deployment logs for errors
  - Verify: Upload test photo and check alignment
```

**Template**:
```markdown
## Task Template

**Do**:
- [ ] <Action to take>

**Verify**:
- Command: `<command to run>`
- Expected: <what you should see>
- If fail: <troubleshooting step>
```

---

### Priority 2: MEDIUM IMPACT 🟡

#### 3. Add Source Citation Pattern

**Update**: `.process/DEVELOPMENT.md` - Add section on "Decision Documentation"

**New Rule**:
For major decisions (not every edit), cite source documentation.

**Format**:
```
Based on <file_path:line_number>, which states "<quote>", I will <action>.
```

**When Required**:
- Architectural decisions
- Choosing between approaches
- Following documented patterns
- Debugging protocol steps

**Example**:
```
Based on META_DEBUGGING_PROTOCOL.md:88-92, which states "verify inputs before
debugging algorithm", I'm checking coordinate dimensions before debugging the
alignment logic.
```

**Benefits**:
- Makes reasoning traceable
- User can verify decisions
- We already use `file:line` pattern for code references
- Extends to documentation references

---

#### 4. File Output Policy

**Update**: `.process/DEVELOPMENT.md` - Add "Code Output Standards"

**New Rule**:
```markdown
## Code Output Standards

**When to show full files**:
- File < 200 lines after modification
- New files being created
- Major refactoring (> 30% of file changed)

**When to use Edit tool**:
- File > 200 lines and < 30% changed
- Precise single-function updates
- Small bug fixes

**Always include**:
- File path with line numbers for references
- Context: What changed and why
- Verification step if applicable
```

---

### Priority 3: LOW IMPACT / DON'T IMPLEMENT ❌

#### 5. Explicit MCP Query Documentation

**Decision**: Don't implement

**Reason**:
- Tool results are visible in UI
- Adds verbosity without value
- Current approach is sufficient

---

## 📊 Summary Comparison Table

| Practice | Proposed | Current | Gap | Priority | Recommendation |
|----------|----------|---------|-----|----------|----------------|
| Contextual grounding via docs | ✅ | ✅ | None | - | Keep current |
| Entry point documentation | ✅ | ✅ | None | - | Keep current |
| Progressive state updates | ✅ | ✅ NEW | None | - | Keep current |
| Source citation with line numbers | ✅ | ⚠️ Partial | Medium | 🟡 | Implement for major decisions |
| Explicit query documentation | ✅ | ❌ | Low | ❌ | Don't implement |
| Task checklist in CLAUDE.md | ✅ | ❌ | High | 🟢 | **Implement** |
| Verification commands in tasks | ✅ | ⚠️ Partial | Medium | 🟢 | **Implement** |
| Full file output policy | ✅ | ⚠️ Inconsistent | Low | 🟡 | Document policy |
| Brevity in explanations | ✅ | ✅ | None | - | Keep current |

---

## 🚀 Implementation Plan

### Phase 1: High Impact Changes (30 min)

1. **Add "Current Tasks" to CLAUDE-APERTURE.md**
   - Create section after Quick Start
   - Migrate current tasks from NEXT_SESSION.md
   - Include verification commands
   - Document update frequency

2. **Update Task List Templates**
   - Add verification command format to DEVELOPMENT.md
   - Update NEXT_SESSION.md template
   - Add examples

### Phase 2: Medium Impact Changes (20 min)

3. **Document Source Citation Pattern**
   - Add to DEVELOPMENT.md
   - Provide examples
   - Define when required vs optional

4. **Document File Output Policy**
   - Add to DEVELOPMENT.md
   - Define clear rules for Edit vs full file
   - Add to code review checklist

### Phase 3: Process Integration (10 min)

5. **Update Startup Checks**
   - Add CLAUDE-APERTURE.md task section check to startup.md
   - Remind to update after major phases

6. **Update COMMON_MISTAKES.md**
   - Document if we miss these patterns
   - Track effectiveness

---

## ✅ What We're Already Doing Right

**Our process is STRONG in**:
1. Automatic context loading (startup.md)
2. Progressive state updates (NEXT_SESSION.md)
3. Debugging protocols (META_DEBUGGING_PROTOCOL.md)
4. Concise communication style
5. Tool-based verification (/verify-infra, /vercel-logs)

**The proposed changes are REFINEMENTS, not overhauls.**

---

## 🎯 Success Metrics

**After implementing these changes, we should see**:
- ✅ Every multi-step task has verification commands
- ✅ CLAUDE-APERTURE.md reflects actual current state
- ✅ Major decisions cite source documentation
- ✅ Consistent file output approach
- ✅ No ambiguity in "what to do next"

---

**Recommendation**: Implement Priority 1 (HIGH) immediately, Priority 2 (MEDIUM) when convenient.

**Expected Time**: ~1 hour total implementation

**Expected Benefit**: Eliminates ambiguity, makes process more traceable, ensures verification steps aren't skipped

---

**Last Updated**: 2025-10-12
**Next Review**: After implementing changes, validate effectiveness in next session
