# Architectural Decision Records (ADRs)

> **Purpose**: Document significant architectural decisions and their rationale.
>
> **Format**: Date | Decision | Context | Rationale | Consequences

---

## How to Use This File

### When to Add an Entry
- Choosing between significant technology options
- Making architectural changes with broad impact
- Establishing patterns or conventions
- Deciding NOT to do something important

### Template
```markdown
## [Date] | [Decision Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]

**Context**:
What is the issue we're trying to solve? What constraints exist?

**Decision**:
What did we decide to do?

**Rationale**:
Why this choice over alternatives?

**Consequences**:
- Positive: What we gain
- Negative: What we lose or trade off
- Neutral: Other implications

**Alternatives Considered**:
1. Option A: [Pros/cons]
2. Option B: [Pros/cons]
```

---

## Decision Records

### 2025-10-10 | Use Gemini API for Eye Detection

**Status**: Accepted

**Context**:
wizard-of-oz app needs to detect eye positions in baby photos for alignment. Two main options: client-side MediaPipe or server-side Gemini API.

**Decision**:
Use Gemini 2.0 Flash API for eye detection.

**Rationale**:
1. **Simpler architecture**: Single API call vs complex ML library integration
2. **Better accuracy**: Handles poor lighting and odd angles more reliably
3. **Server-side only**: Cleaner separation of concerns, smaller client bundle
4. **Future extensibility**: Can add smile detection, milestone recognition later
5. **Negligible cost**: ~$0.0001/photo = $0.04/year for daily uploads

**Consequences**:
- **Positive**:
  - Cleaner codebase (no 2-3MB TensorFlow.js bundle)
  - Better handling of edge cases (baby crying, looking away)
  - Platform for future AI features
- **Negative**:
  - Small per-request cost (vs free MediaPipe)
  - API latency ~3-5 seconds (vs instant client-side)
  - Dependency on external service
- **Neutral**:
  - No real-time preview (could add MediaPipe later for preview only)

**Alternatives Considered**:
1. **MediaPipe Face Mesh** (client-side):
   - ✅ Free, fast, real-time preview
   - ❌ Large bundle size, less accurate in poor conditions
   - ❌ Runs on user's device (battery drain on mobile)

2. **Hybrid approach** (MediaPipe preview + Gemini final):
   - ✅ Best of both worlds
   - ❌ Added complexity, two systems to maintain
   - 📝 Could revisit if real-time feedback becomes critical

**Referenced in**: `projects/wizard-of-oz/README.md`, `projects/wizard-of-oz/api/detect-eyes.ts`

---

### 2025-10-10 | Aperture Process Framework Structure

**Status**: Accepted

**Context**:
Need to establish a scalable, learnable process for multiple AI-assisted projects. Previous experience showed that ad-hoc development leads to repeated mistakes and inefficiency.

**Decision**:
Create two-layer architecture:
- **Process layer** (`.process/`): How we work
- **Project layer** (`projects/`): What we build

With continuous improvement philosophy: capture mistakes immediately, detail at session end.

**Rationale**:
1. **Separation of concerns**: Process docs apply to all projects
2. **Continuous improvement**: Formalized learning from mistakes
3. **Onboarding**: New projects/developers get consistent structure
4. **Scalability**: Process evolves independently of individual projects
5. **Based on research**: Gemini deep research on agentic SDLC best practices

**Consequences**:
- **Positive**:
  - Systematic approach to AI-assisted development
  - Shared knowledge across projects
  - Faster project setup (reuse patterns)
  - Built-in reflection mechanism
- **Negative**:
  - Initial setup overhead
  - Need discipline to maintain docs
- **Neutral**:
  - More files to navigate (mitigated by clear README structure)

**Alternatives Considered**:
1. **Single project-level docs**:
   - ✅ Simpler initially
   - ❌ Duplicate knowledge across projects
   - ❌ No shared learning mechanism

2. **External wiki/Notion**:
   - ✅ Better formatting options
   - ❌ Not version-controlled with code
   - ❌ Context switching (leave repo)
   - ❌ Not accessible to Claude in same way

**Referenced in**: `README.md`, `CONTRIBUTING.md`, `SESSION_CHECKLIST.md`

---

### 2025-10-10 | Start Minimal Philosophy

**Status**: Accepted

**Context**:
Previous development built a testing agent so complex it slowed everything down. Need to establish principle of cost/benefit analysis before adding complexity.

**Decision**:
Adopt "Start Minimal" philosophy: Always implement simplest version first, add complexity only when ROI clearly pays off.

**Rationale**:
1. **Real failure**: Testing agent anti-pattern hurt velocity
2. **Faster iteration**: Simple systems easier to modify
3. **Lower maintenance**: Less code = less to maintain
4. **Clarity**: Forces clear thinking about actual requirements
5. **Reversibility**: Easy to add complexity, hard to remove

**Consequences**:
- **Positive**:
  - Faster development cycles
  - Less cognitive load
  - Easier debugging
  - Lower maintenance burden
- **Negative**:
  - May need to refactor later (acceptable trade-off)
  - Requires discipline to resist "perfect" solutions
- **Neutral**:
  - Need clear criteria for when to add complexity

**Decision Framework**:
Before adding complexity, answer:
1. What's the time investment?
2. What's the maintenance burden?
3. What's the actual benefit?
4. Does the math clearly pay off?

**Referenced in**: `.process/ARCHITECTURE.md`, `.process/COMMON_MISTAKES.md`

---

### 2025-10-10 | Placeholder Strategy for Advanced Features

**Status**: Accepted

**Context**:
Gemini research identified advanced patterns (subagents, multi-agent orchestration, custom SDK tools). We want to be aware of them without over-engineering.

**Decision**:
Create placeholders with clear decision criteria. Review at start of each session: "Is today the day we implement this?"

**Rationale**:
1. **Awareness without commitment**: Know what's possible
2. **Clear criteria**: When ROI justifies complexity
3. **Prevents premature optimization**: Build when needed, not "just in case"
4. **Continuous evaluation**: Regular review keeps options fresh

**Consequences**:
- **Positive**:
  - No over-engineering
  - Clear path to advanced features when needed
  - Informed decisions (not reactive)
- **Negative**:
  - Might miss optimization opportunities
  - Requires discipline to evaluate honestly
- **Neutral**:
  - Need to maintain decision criteria

**Placeholders Created**:
- Subagents (when task repeated 5+ times)
- Multi-agent orchestration (when need parallel work streams)
- Custom SDK tools (when specific integration need identified)

**Referenced in**: `SESSION_CHECKLIST.md`, `.process/ARCHITECTURE.md`

---

## Template for Future Decisions

### [Date] | [Decision Title]

**Status**: Proposed

**Context**:
[What problem are we solving? What constraints exist?]

**Decision**:
[What we decided to do]

**Rationale**:
[Why this over alternatives?]

**Consequences**:
- **Positive**: [What we gain]
- **Negative**: [What we lose/trade off]
- **Neutral**: [Other implications]

**Alternatives Considered**:
1. [Option]: [Pros/cons]
2. [Option]: [Pros/cons]

**Referenced in**: [Links to relevant docs/code]

---

**Last Updated**: 2025-10-10
**Total Decisions**: 4 (Gemini API, Process Framework, Start Minimal, Placeholder Strategy)
