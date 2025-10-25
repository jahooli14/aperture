# 🎨 Polymath - Meta-Creative Synthesis Engine

> Generates novel project ideas by combining your capabilities with your interests

---

## What Is This?

Polymath is a **meta-creative intelligence system** that helps you discover project ideas you wouldn't think of yourself. It:

1. **Scans your codebase** → extracts technical capabilities
2. **Captures your interests** → voice notes reveal recurring themes
3. **AI synthesis** → generates novel project suggestions
4. **Activity learning** → tracks what you build → strengthens nodes
5. **Knowledge graph** → builds connections over time

**Not a traditional PM tool.** It's about creative possibility, not obligation.

---

## The Big Idea

**Your interests** + **Your capabilities** = **Novel project possibilities**

```
Voice notes ──→ Extract interests ──→ Feed synthesis
                      ↖──────────────────↙
Git activity ──→ Strengthen capabilities ──→ Influence future suggestions
```

---

## How It Works

### Weekly Synthesis (Monday 09:00 UTC)

1. **Scan capabilities** - What technical skills do you have?
   - Voice processing (Audiopen integration)
   - Face alignment (computer vision)
   - Documentation generation (AI-powered)
   - Vector search (embeddings)
   - etc.

2. **Extract interests** - What are you thinking about?
   - From voice notes (captured via Audiopen)
   - Recurring themes, topics, people
   - Weighted by frequency + recency

3. **Generate suggestions** - Novel combinations
   - "Voice-annotated photo timeline" (voice + photos)
   - "Self-documenting creative portfolio" (docs + projects)
   - AI-powered (Claude Sonnet 4.5), scored by:
     - **Novelty** (30%): How unique is this combination?
     - **Feasibility** (40%): Can you actually build this?
     - **Interest** (30%): Does it match your themes?

4. **Diversity injection** - Every 4th suggestion is a "wild card" 🎲
   - Deliberately outside your usual range
   - Prevents echo chambers
   - Keeps creative range wide

---

## The Creative Feedback Loop

```
Week 1:
  - Synthesis generates 10 suggestions
  - "AI Baby Photo Timeline" (75pts)
  - "Voice-Tagged Memory Garden" (68pts)
  - etc.

You rate them:
  - 👍 Spark (interests you)
  - 👎 Meh (not interesting)
  - 💡 Build (let's do this!)

Week 2:
  - You build "AI Baby Photo Timeline"
  - Git commits detected
  - "Face detection" capability strengthens (+0.30)
  - "Photo manipulation" capability strengthens (+0.30)

Week 3:
  - New synthesis runs
  - Strengthened capabilities appear more often
  - "Face-Recognition Photo Organizer" (suggested)
  - "Emotion Detection in Baby Photos" (suggested)

System learns what you actually work on, not just what you rate.
```

---

## Key Features

### 1. Point Allocation
Every suggestion gets a score:
```
total_points = (novelty * 0.3 + feasibility * 0.4 + interest * 0.3) * 100
```

### 2. Activity-Based Learning
- Git commits → strengthen capability nodes
- Active capabilities appear in more suggestions
- Unused capabilities decay slowly
- System learns your actual patterns

### 3. Diversity Injection
- Every 4th suggestion is a "wild card"
- Prevents filter bubble
- Encourages serendipitous exploration

### 4. Permanent Ideas List
- All suggestions tracked forever
- Statuses: pending, spark, meh, built, dismissed, saved
- Can revisit old ideas
- Full history of creative exploration

### 5. Knowledge Graph
- Capabilities ↔ Interests ↔ Projects
- Strengthens over time
- Creates unexpected connections

---

## Tech Stack

### Frontend
- React 18.3 + TypeScript
- Vite 5.x
- React Router DOM (routing)
- Zustand (state management)

### Backend
- Vercel Serverless Functions
- Node.js 20.x

### Database
- Supabase (PostgreSQL 15 + pgvector)
- 6 tables: projects, capabilities, project_suggestions, suggestion_ratings, node_strengths, capability_combinations

### AI
- **Claude Sonnet 4.5** (project idea generation)
- **Gemini 2.5 Flash** (embeddings + entity extraction)

### Automation
- Vercel Cron Jobs
  - Monday 09:00 UTC: Weekly synthesis
  - Daily 00:00 UTC: Node strengthening

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Migration
Copy `scripts/migration.sql` to Supabase SQL editor and run it (creates 6 tables)

### 3. Environment Variables
Add to `.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...  # Only needed for synthesis
USER_ID=your-supabase-user-id
```

### 4. Seed Test Data
```bash
npx tsx scripts/polymath/seed-test-data.ts
```

### 5. Verify
Check Supabase tables:
- `capabilities` → 8 test capabilities
- `project_suggestions` → 4 test suggestions

---

## File Structure

```
projects/polymath/
├── api/                          # Vercel Serverless Functions
│   ├── capture.ts                # Voice note webhook
│   ├── process.ts                # Memory processing
│   ├── projects.ts               # Projects CRUD
│   ├── suggestions.ts            # List suggestions
│   └── cron/
│       ├── weekly-synthesis.ts   # Monday synthesis job
│       └── strengthen-nodes.ts   # Daily strengthening job
│
├── src/
│   ├── components/
│   │   ├── capabilities/
│   │   ├── projects/
│   │   └── suggestions/
│   ├── pages/                    # To build
│   ├── stores/                   # To build
│   └── types.ts
│
├── scripts/
│   ├── migration.sql             # Database schema
│   └── polymath/
│       ├── capability-scanner.ts # Scan codebase
│       ├── synthesis.ts          # AI synthesis engine
│       ├── strengthen-nodes.ts   # Activity tracker
│       └── seed-test-data.ts     # Test data
│
└── Documentation (13 files)
```

---

## Documentation

### Quick Start
- **START_HERE.md** - Entry point and navigation
- **WAKE_UP_SUMMARY.md** - Quick overview
- **TESTING_GUIDE.md** - Step-by-step testing

### Architecture
- **ARCHITECTURE_DIAGRAM.md** - Visual system design
- **CONCEPT.md** - Vision and design principles
- **ARCHITECTURE.md** - Technical design with algorithms

### Implementation
- **ROADMAP.md** - 10-phase implementation plan
- **API_SPEC.md** - Complete API documentation
- **UI_COMPONENTS.md** - React component specs

---

## What's Built vs What's Pending

### ✅ Built (Ready to Use)
- [x] Database schema (6 tables)
- [x] API endpoints (7 endpoints)
- [x] React components (5 components)
- [x] TypeScript types (complete)
- [x] Capability scanner (scans Aperture codebase)
- [x] Synthesis engine (AI generates ideas)
- [x] Node strengthening (tracks git activity)
- [x] Cron jobs (weekly synthesis, daily strengthening)
- [x] Test data script
- [x] Documentation (13 files)

### ⏳ Pending (Weekend Work)
- [ ] UI Pages (ProjectsPage, SuggestionsPage, AllIdeasPage)
- [ ] Routing (react-router-dom setup)
- [ ] State management (Zustand stores)
- [ ] Deployment (Vercel with env vars)

**Estimate**: 8-12 hours for full UI implementation

---

## Design Principles

1. **Energy-giving, not draining** - Feels like browsing inspiration, not managing tasks
2. **Diversity over confirmation** - Wild cards prevent echo chambers
3. **Activity over intention** - System learns what you build, not just what you say
4. **Permanent, not ephemeral** - All ideas tracked, can revisit dismissed ideas
5. **Novel, not obvious** - Combines capabilities you haven't thought to combine
6. **Autonomous, not manual** - Cron jobs run automatically, no daily input needed

---

## Example Suggestions

Real examples from test data:

1. **"Voice-Powered Memory Timeline"** (68pts)
   - Combines: Voice processing + Vector search
   - Wild card: No

2. **"Baby Face Journey Visualization"** (65pts)
   - Combines: Face alignment + Timeline visualization
   - Wild card: No

3. **"Self-Healing Documentation System"** (71pts) 🎲
   - Combines: Documentation generation + Health monitoring
   - Wild card: Yes (diversity injection)

4. **"Personal API Gateway"** (58pts)
   - Combines: Supabase integration + API development
   - Wild card: No

---

## Next Steps

**Testing** (1 hour):
1. Follow `TESTING_GUIDE.md`
2. Verify database migration
3. Seed test data
4. Check Supabase tables

**Implementation** (Weekend):
1. Follow `ROADMAP.md`
2. Build UI pages
3. Add routing
4. Create Zustand stores
5. Deploy to Vercel

---

## License

Private project - not open source

---

**Status**: Ready to deploy | Database migration required | UI pending

**Let's build something unexpected** ✨
# Force deploy - test new features Sat 25 Oct 2025 15:40:51 BST
