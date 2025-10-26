# Polymath - Creative Intelligence System

## Vision

A creative synthesis engine that **feeds off energy and doesn't feel like work**.

Polymath is MemoryOS's creative counterpart - while MemoryOS captures and connects your thoughts, Polymath generates and strengthens your creative possibilities.

Unlike traditional PM tools (JIRA, Asana), Polymath:
- Generates novel project ideas you wouldn't see yourself
- Tracks both personal creative pursuits AND technical capabilities
- Strengthens skills through active use (graph-based reinforcement)
- Prevents creative echo chambers through diversity injection
- Shows the full landscape of what you're creating AND what you could create

## Design North Star

**"Must feed off energy and not feel like work"**

## The Two Modes

### Mode 1: Personal Projects
Track any creative pursuit - painting, writing, music, crafts, experiments
- Could be goal-oriented ("finish the watercolor series") or ongoing practices ("sketching")
- Projects that bring joy, not obligation

### Mode 2: Meta-Creative Synthesis
AI-powered project suggestions from your technical capabilities
- Scans Aperture codebase for capabilities (MemoryOS voice processing, Wizard of Oz face alignment, etc.)
- Combines with MemoryOS interests to suggest novel projects
- Weekly synthesis generates X new ideas with Y points allocated
- Example: "Voice-annotated photo timeline" (MemoryOS + Wizard capabilities)

## Core Mechanisms

### The Knowledge Graph

**Nodes:**
- Personal projects (painting, music, etc.)
- Technical capabilities (voice processing, embeddings, face alignment, etc.)
- Interests from MemoryOS (abstract art, memory systems, etc.)
- Existing Aperture projects (MemoryOS, Wizard of Oz, autonomous docs, etc.)

**Edges:**
- Strength = activity level (more you work on it, stronger the node)
- Type = relationship (uses, combines, inspired-by, etc.)

**Meta-layer:**
- Point allocations (weighted suggestions)
- Rating history (tune future synthesis)
- Permanent ideas list (everything suggested, even if dismissed)

### Weekly AI Synthesis

**Process:**
1. Scan MemoryOS for recent interests/energy patterns
2. Scan Aperture codebase for technical capabilities
3. Generate X novel project suggestions (unique Venn overlaps)
4. Allocate Y points weighted by:
   - **Novelty** (unique capability combinations)
   - **Feasibility** (existing code reuse potential)
   - **Interest alignment** (matches recent MemoryOS themes)
5. **Diversity injection**: Occasionally surface "unpopular" ideas to prevent filter bubble

**Anti-Echo-Chamber:**
- Every N suggestions, include ideas you typically dismiss
- Prevents creative narrowing
- Keeps your creative range wide

### Strengthening Feedback Loop

**Active projects strengthen nodes:**
- Work on a project → that capability node grows stronger
- Stronger nodes → appear in more future suggestions
- Example: Build voice app → voice processing strengthens → more voice-based ideas surface

**Rating tunes synthesis:**
- "This sparked something" → boost similar combinations
- "Not interested" → prune that vector (but keep in permanent list)
- Implicit (you build it) + explicit ratings

### The Permanent Ideas List

**Everything is tracked:**
- Active projects (currently working on)
- Suggested projects (AI-generated, point-weighted)
- Dormant ideas (suggested but not pursued... yet)
- Dismissed ideas (rated down, but logged for diversity)

The full list = your creative possibility space. Seeing the whole landscape strengthens Venn understanding.

### How It Nudges

**Smart, context-aware surfacing:**
1. **Primary trigger**: Relevant MemoryOS voice notes
   - "I love abstract art" → surfaces personal art projects + suggests "generative art with AI"
2. **Time-based decay**: The longer dormant, the looser the connection
   - Fresh projects: only surface with strong relevance
   - 30+ days dormant: surface with loose connections
   - 90+ days: eventually everything surfaces on rolling basis
3. **Point allocation**: Higher-weighted suggestions surface more prominently

### Main View

**Unified gallery:**
- Personal projects + suggested technical projects
- Visual cards with point allocations
- Timeline overlay showing last activity
- Quick snapshot of creative landscape + possibility space

### Capture Methods
- **Voice notes** (same as MemoryOS) - effortless capture
- **Text notes** - quick jots
- **Implicit tracking** - active development strengthens nodes automatically

## Relationship to MemoryOS

**DECISION: Same app, deeply integrated**

**Why unified:**
- Shared knowledge graph (MemoryOS memories + Polymath projects)
- Bidirectional enrichment (interests feed projects, projects feed memories)
- Single Supabase instance, auth, deployment
- One app to open, not two

**MemoryOS → Polymath:**
- Interests/thoughts feed project suggestions
- "I love abstract art" → surfaces/suggests art projects

**Polymath → MemoryOS:**
- Active projects become entities in knowledge graph
- "Working on voice-photo-timeline" → MemoryOS bridges to related thoughts

**Technical integration:**
- Same codebase, different routes (/memories, /projects)
- Shared database schema with unified graph structure
- Cross-system embeddings for semantic connections

## Tech Stack

**Same as MemoryOS:**
- Frontend: React + TypeScript + Vite
- Backend: Supabase (shared instance with MemoryOS)
- Deployment: Vercel (same deployment)
- AI: Gemini 2.5 Flash (capability scanning) + Claude Sonnet 4.5 (synthesis/suggestions)
- Vector search: pgvector (semantic project connections)

## Implementation Approach

**Phase 1: Foundation**
- Extend MemoryOS database schema for projects + capabilities
- Add `/projects` route to existing MemoryOS app
- Basic project CRUD (create, view, update)

**Phase 2: Graph Building**
- Capability extraction from Aperture codebase
- Interest extraction from MemoryOS memories
- Node strength tracking (activity-based)

**Phase 3: AI Synthesis**
- Weekly synthesis cron job
- Point allocation algorithm (novelty + feasibility + interest)
- Suggestion generation with diversity injection

**Phase 4: Interaction**
- Rating system for suggestions
- Permanent ideas list view
- Strengthening feedback loop

## Next Steps

See `NEXT_SESSION.md` for current status and implementation tasks.
See `ARCHITECTURE.md` for detailed system design.
