# Architecture Principles

> **Version**: 1.0 - This document will evolve as we learn. Update it as patterns emerge.

## Core Philosophy: Start Minimal

**The Testing Agent Anti-Pattern**: Complexity without clear ROI kills velocity.

### Real Example (Don't Repeat This)
During previous development, we built a testing agent so comprehensive it slowed everything to a crawl. The system had:
- Multi-layer test generation
- Exhaustive edge case coverage
- Complex mocking frameworks
- Automated test reviews

**The Problem**: The overhead of maintaining this system exceeded the value it provided. Tests took 10x longer to run, required constant debugging, and developers avoided writing tests because the tooling was intimidating.

**The Lesson**: Always ask "What's the minimum viable implementation?" before building something complex.

## Decision Framework: When to Add Complexity

Before implementing any architectural pattern or tooling, answer these questions:

1. **Cost/Benefit Profile**
   - What's the time investment to build this?
   - What's the ongoing maintenance burden?
   - What's the actual time savings or quality improvement?
   - Does the math clearly pay off?

2. **Minimum Viable Implementation**
   - What's the simplest version that provides 80% of the value?
   - Can we start there and add complexity only if needed?

3. **Team Impact**
   - Will this make development faster or slower?
   - Will new team members understand it quickly?
   - Does it remove friction or add cognitive load?

## Aperture Multi-Project Architecture

```
aperture/                           # The platform/process framework
├── .process/                       # Process documentation (you are here)
├── .claude/commands/               # Reusable AI workflows
├── knowledge-base/                 # Reference materials for AI context
├── projects/
│   └── wizard-of-oz/               # Self-contained projects
│       ├── src/
│       ├── api/
│       ├── plan.md                 # Current state & next steps
│       ├── architecture.md         # Project-specific design
│       └── decisions.md            # ADRs for this project
└── [future projects]
```

## Key Architectural Patterns

### 1. Separation of Concerns
- **Process layer** (.process/): How we work
- **Project layer** (projects/): What we build
- Projects reference process docs, not duplicate them

### 2. Context Hierarchy (CLAUDE.md files)
Following the Gemini research, we use hierarchical context:
- **~/.claude/CLAUDE.md**: Personal preferences (optional)
- **aperture/CLAUDE.md**: Framework-wide conventions
- **aperture/projects/wizard-of-oz/CLAUDE.md**: Project-specific rules

More specific contexts override general ones.

### 3. Memory Externalization
Critical artifacts MUST be written to disk, not just chat history:
- **plan.md**: Step-by-step implementation plan (with checkboxes)
- **architecture.md**: System design, schemas, API contracts
- **decisions.md**: Architectural Decision Records (ADRs)
- **todo.md**: Dynamic task list

**Why**: Chat context is ephemeral. Files are persistent, shareable, and version-controlled.

### 4. Token-Efficient Context Engineering
CLAUDE.md files consume tokens on every prompt. Write them like code, not prose:
- ✅ Short, declarative bullet points
- ✅ Pointers to example files (`<file_map>src/components/Button.tsx</file_map>`)
- ❌ Long narrative explanations
- ❌ Duplicate information that exists elsewhere

## Technology Decisions

### When to Choose What

| Pattern | Use When | Avoid When | Example |
|---------|----------|------------|---------|
| **Monolith** | Single team, shared domain logic | Multiple teams, scaling needs | wizard-of-oz (single-user app) |
| **Microservices** | Clear service boundaries, need independent scaling | Early-stage project, small team | Future: If we build multi-tenant SaaS |
| **Serverless Functions** | Sporadic traffic, stateless operations | Long-running tasks, stateful logic | wizard-of-oz API endpoints |
| **Edge Functions** | Low-latency global access, simple logic | Complex computation, large dependencies | Future: User-facing API gateway |

### Default Tech Stack (Aperture Standard)
- **Frontend**: React + TypeScript + Vite + Tailwind
- **State**: Zustand (simple) or Zustand + React Query (complex data fetching)
- **Backend**: Vercel Functions (Node.js + TypeScript)
- **Database**: Supabase (Postgres + Auth + Storage)
- **AI Integration**: Anthropic Claude API, Google Gemini API
- **Testing**: Vitest + React Testing Library (start minimal!)
- **CI/CD**: GitHub Actions + Vercel

**Why these defaults?** Fast iteration, minimal configuration, generous free tiers.

**When to deviate?** When specific project requirements clearly justify it. Document the decision in `decisions.md`.

## Scaling Patterns (Add When Needed)

### 🔮 Placeholder: Subagents (Future)
**Decision Criteria**: Implement when a specific task is repeated 5+ times and would benefit from specialized context.

**Example candidates**:
- Code review agent (read-only, focused on patterns)
- Test generation agent (pre-loaded with testing guidelines)
- Documentation agent (updates README on code changes)

**Implementation**: See `.process/SUBAGENTS.md` when ready.

### 🔮 Placeholder: Multi-Agent Orchestration (Future)
**Decision Criteria**: Implement when a single project requires parallel work streams that would benefit from independent contexts.

**Example**: Building a complex feature with simultaneous frontend, backend, and infrastructure work.

**Red Flag**: Don't implement just because it's cool. The coordination overhead is real.

### 🔮 Placeholder: Custom SDK Tools (Future)
**Decision Criteria**: Implement when we have a specific, high-value integration that isn't served by existing Claude tools.

**Example candidates**:
- Jira integration (read requirements, update status)
- Internal metrics dashboard (query performance data)
- Design system sync (Figma API integration)

## Performance Targets

Set clear, measurable goals for each project:

### wizard-of-oz Example
- **Frontend load**: < 2s initial paint
- **Photo upload**: < 10s including AI processing
- **Gallery load**: < 1s for 100 photos
- **Eye detection accuracy**: > 95% (well-lit photos)

Document targets in each project's `architecture.md`.

## Security Principles

1. **Never commit secrets** (use `.env`, `.env.local`)
2. **Use Row Level Security** (Supabase RLS for multi-tenant data)
3. **Principle of least privilege** (service keys only in serverless functions)
4. **Input validation** (Zod schemas at API boundaries)
5. **Rate limiting** (for public-facing APIs)

## Documentation Standards

Each project MUST have:
- **README.md**: Quick overview, setup, usage
- **SETUP.md**: Detailed step-by-step setup (for new devs)
- **plan.md**: Current implementation state
- **architecture.md**: System design
- **decisions.md**: ADRs

Optional (add when useful):
- **TROUBLESHOOTING.md**: Common issues & fixes
- **API.md**: Endpoint documentation
- **CONTRIBUTING.md**: Project-specific contribution guide

---

**Last Updated**: 2025-10-10
**Next Review**: When starting next project (evaluate what worked/didn't work for wizard-of-oz)
