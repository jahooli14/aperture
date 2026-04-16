# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

This file is the **single source of truth** for working on this repo. If something isn't here, it's probably not important.

## How I Like To Work

- Plain English. No jargon, no filler.
- Concise. Short sentences. Bullets over paragraphs.
- Say what you did and why — skip the "I will now..." preamble.
- If something is uncertain, say so in one line and ask.
- Don't create new docs. Edit the ones that exist.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment & milestone tracking |
| **Polymath** | `projects/polymath/` | Production | Voice-to-memory knowledge graph |
| **Analogue** | `projects/analogue/` | Active | Book publishing / manuscript editing IDE |
| **Idea Engine** | `projects/idea-engine/` | Active | Autonomous evolutionary ideation system |
| **Golf Masters** | `projects/golf-masters/` | Active | Masters pool tracker with live ESPN scores |
| **Fix Queue** | `projects/polymath/` (feature) | Active | Voice-captured annoyances → AI-drafted fixes |

> **Sonically Sound** ships from outside this repo.

## Commands

```bash
cd projects/wizard-of-oz && npm run dev   # Pupils
cd projects/polymath && npm run dev       # Polymath
cd projects/analogue && npm run dev       # Analogue
cd projects/idea-engine && npm run dev    # Idea Engine
cd projects/golf-masters && npm run dev   # Golf Masters
```

Build before pushing: `cd projects/<name> && npm run build`.

## Tech + Style

- **Frontend**: React 18, TypeScript (strict, no `any`), Vite
- **Backend**: Vercel serverless functions, Supabase (Postgres + RLS)
- **AI**: Gemini for embeddings/classification, Claude for synthesis
- **Naming**: PascalCase components, camelCase functions, feature-based folders, files ≤ 300 lines
- **AI model IDs**: Verify against live docs (e.g. [Gemini models](https://ai.google.dev/gemini-api/docs/models)) before changing. Models get deprecated — don't guess.

## Deploy

Push to `main` → Vercel auto-deploys. Env vars live in the Vercel dashboard, never commit them.

## Debugging checklist

1. Browser console for frontend errors.
2. Vercel function logs for API errors.
3. Confirm env vars are set in Vercel.
4. Supabase: empty results with data present usually means RLS — check the policies.

## Commits & PRs

Conventional commits. PR metadata is short.

**Commit subject**
- `type(scope): short summary`
- Single line, ≤ 70 chars, imperative mood.
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

**Commit body (optional)**
- Blank line after subject, then why + notable decisions. Wrap ~72 chars. Bullets fine.

**PR title**
- **Single line, ≤ 70 chars** — the commit subject, nothing more.
- Never paste the commit body into the title. Never include newlines.
- One commit → PR title = that commit's subject. Multiple commits → write one new subject.

**PR body**
- 1–3 bullets on what changed and why.
- Test plan: 1–3 bullets of what to verify.
- Skip boilerplate checkboxes unless a box genuinely applies.
- Link issue with `Fixes #N` if relevant.

**Workflow**
- Develop on the branch from the session brief.
- Only open a PR when explicitly asked.
- Run `npm run build` in the project folder before opening a PR.

## Fix Queue (Polymath feature)

Voice-capture life annoyances → AI drafts automated fixes → approve → runs on cron.

**Architecture**
- Triage: voice notes classified as `annoyance` by Gemini (severity + automatable flag)
- Drafting: AI generates data-driven fix specs
- Approval: `/fixes` page in Polymath UI
- Execution: GitHub Actions cron (every 30min) hits `/api/fix-queue`

**Fix action types**
- `send_email` — Reminder/notification via Resend
- `weather_email` — Email with live Open-Meteo weather data
- `smart_home` — Frame TV / Sonos / bird cam (Home Assistant or direct)
- `http_request` — Generic API calls

**Key files**
- `api/fix-queue.ts` — Main API (draft-pending, run-fixes, approve, reject, list)
- `api/_lib/fix-queue/drafter.ts` — AI fix generation
- `api/_lib/fix-queue/runner.ts` — Fix execution
- `api/_lib/fix-queue/types.ts` — FixDraft, FixAction types
- `src/pages/FixQueuePage.tsx` — Approval UI
- `.github/workflows/cron.yml` — Consolidated cron dispatcher. Draft every 6h (`0 */6 * * *`), runner every 30min (`*/30 * * * *`)

**Env vars**
- `RESEND_API_KEY` — Email (configured)
- `HOME_ASSISTANT_URL` + `HOME_ASSISTANT_TOKEN` — Smart home hub (optional)
- `SONOS_HTTP_API_URL` — node-sonos-http-api bridge (optional)
- `FRAME_TV_IP` — Samsung Frame TV local IP (optional)
- `BIRD_CAM_URL` — Bird cam HTTP endpoint (optional)

## Session start

If `NEXT_SESSION.md` exists, read it. Otherwise just begin.
