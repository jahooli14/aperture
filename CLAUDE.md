# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment app with MediaPipe eye detection |
| **Polymath** | `projects/polymath/` | Production | Voice-to-memory knowledge graph with AI synthesis |
| **Analogue** | `projects/analogue/` | Active | Mobile manuscript editing IDE for novelists |
| **Agentic Swarm** | `agentic-swarm/` | Active | Multi-provider agent orchestration system (Node.js library) |

## Dev Commands

```bash
cd projects/wizard-of-oz && npm run dev   # Pupils
cd projects/polymath && npm run dev       # Polymath
cd projects/analogue && npm run dev       # Analogue
cd agentic-swarm && npm run dev           # Agentic Swarm
```

Build and verify locally before pushing:

```bash
npm run build   # Must pass before git push
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18/19, TypeScript strict, Vite |
| Styling | Tailwind CSS, Framer Motion |
| State | Zustand (local), React Query (server — Polymath only) |
| Offline | Dexie (IndexedDB) in Polymath and Analogue |
| Backend | Vercel Serverless Functions (`/api/*`) |
| Database | Supabase (PostgreSQL + RLS + Storage) |
| AI | Gemini (embeddings/synthesis), Claude (synthesis), GLM (free tier) |
| Mobile | Capacitor (Polymath Android/iOS) |

## Code Standards

- **TypeScript strict** — no `any` types. Use `unknown` + type guards instead.
- **Functional React** — hooks only, no class components.
- **Naming** — `PascalCase` for components, `camelCase` for functions/variables.
- **File size** — keep files under 300 lines; split by feature if larger.
- **No secrets in repo** — all env vars in Vercel dashboard only.

### TypeScript: avoid `any`

```typescript
// Bad
const data: any = response

// Good
const data: unknown = response
if (isValidData(data)) { ... }
```

### Error handling pattern

```typescript
try {
  const result = await operation()
  if (!result) throw new Error('Operation failed')
  return result
} catch (error) {
  console.error('Context:', { operation, error })
  throw error
}
```

### Supabase queries

```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('field', value)

if (error) throw error
```

Always use the **anon key** on the frontend, **service role key** only in Vercel API functions.

## Project Summaries

### Pupils (`projects/wizard-of-oz/`)

Baby photo timelapse alignment app. MediaPipe eye detection runs entirely client-side (privacy-first). PWA with offline support, push notifications (Web Push), and email reminders (Resend).

Key patterns:
- Zustand stores in `src/stores/`
- Canvas API for photo alignment transforms
- Vercel cron: `api/cron/send-reminders.ts` (daily 3 PM UTC)
- Supabase tables: `photos`, `user_settings`, `user_shares`, `milestone_achievements`, `places`

Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`

### Polymath (`projects/polymath/`)

Voice-to-memory knowledge graph. Captures thoughts via voice, links them via vector embeddings, surfaces connections with multi-perspective AI synthesis.

Key patterns:
- React Query for server state; Dexie for offline fallback
- Gemini embeddings for semantic search (`api/_lib/gemini-embeddings.ts`)
- Progressive synthesis pipeline (`api/_lib/synthesis.ts`)
- Capacitor for mobile (Android/iOS)
- Masonry 2-column card layout in `MemoriesPage.tsx`
- `tsconfig.json` has `strict: false` (complex graph types)
- Supabase tables: `memories`, articles, `projects`, `todos`, `connections`, `tags`, `capabilities`

Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY`

Useful scripts:
```bash
npm run seed               # Seed test data
npm run backfill:embeddings  # Fill missing vector embeddings
npm run synthesize         # Run synthesis pipeline
```

### Analogue (`projects/analogue/`)

Manuscript editing IDE for novelists. Scene-based structure with sensory, reveal, and character voice audits. Offline-first via Dexie with Supabase sync.

Key patterns:
- Zustand stores: `useAuthStore`, `useManuscriptStore`
- Mammoth.js for Word document import/export
- Supabase tables: `manuscripts`, `scene_nodes`, `reverberations`, `glasses_mentions`, `speech_patterns`

Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Agentic Swarm (`agentic-swarm/`)

Pure Node.js library (no frontend) for multi-provider agent orchestration. Orchestrator-worker pattern with parallel task execution and automatic provider fallback.

Supported providers (cheapest to most capable):
| Provider | Model | Cost |
|----------|-------|------|
| GLM (Zhipu AI) | GLM Flash | Free |
| Google | Gemini Flash-Lite | ~$0.10/1M tokens |
| Google | Gemini Flash 2.5 | ~$0.30/1M tokens |
| Anthropic | Claude Sonnet 4 | ~$3.00/1M tokens |

Key patterns:
- `OrchestratorAgent` decomposes tasks; `WorkerAgent`s execute in parallel
- `ProviderFactory` handles provider selection and fallback
- ESM module, compiled to `dist/` before use
- Env vars: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `ZHIPU_API_KEY`

```bash
npm run build         # Compile TypeScript
npm run demo          # Swarm vs single-agent comparison
npm run overnight     # Deep research task (Claude)
npm run overnight-free  # Free tier (GLM workers)
```

## Deployment

- **Push to `main`** → Vercel auto-deploys all projects
- Each project has its own `vercel.json`
- CSP headers and SPA rewrites configured per project
- Env vars set in Vercel dashboard — never committed

```bash
npm run build   # Verify locally first
git push origin main
```

## Debugging

1. Check browser console for frontend errors
2. Check Vercel function logs for API errors
3. Verify env vars are set in Vercel dashboard
4. For Supabase empty results — check Row Level Security (RLS) policies

## Common Mistakes

- **Build fails on Vercel** → Run `npm run build` locally first
- **API returns 401/500** → Missing env var in Vercel dashboard
- **Supabase returns empty** → Check RLS policies for the table
- **Re-render loops** → Use `useMemo`/`useCallback` for expensive values
- **Using `any`** → Use `unknown` + type guards

## CI/CD

- `.github/workflows/` — build, test, deploy, doc-check, autodoc pipelines
- `.github/dependabot.yml` — weekly npm + GitHub Actions updates (grouped, assigned to @jahooli14)
- React major version updates are ignored by Dependabot

## Repository Structure

```
aperture/
├── projects/
│   ├── wizard-of-oz/     # Pupils
│   ├── polymath/         # Polymath
│   └── analogue/         # Analogue
├── agentic-swarm/        # Agentic Swarm (Node.js library)
├── pathway/              # Market data analysis (secondary)
├── knowledge-base/       # Reference documents
├── research/             # Research notes
├── scripts/              # Autonomous docs generator
├── .process/             # Dev process guides (ARCHITECTURE, DEPLOYMENT, etc.)
├── .github/              # CI/CD workflows + Dependabot
├── CLAUDE.md             # This file
├── CLAUDE-APERTURE.md    # Extended code patterns reference
└── START_HERE.md         # Quick start guide
```

## Skills

Use `/skill` for complex workflows:
- `session-start-hook` — Set up dev environment hooks
- `commit` — Generate conventional commit messages
- `qa` — Code quality review

## Session Start

Check `NEXT_SESSION.md` for current status and tasks (if present).
