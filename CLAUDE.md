# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment & milestone tracking app |
| **Polymath** | `projects/polymath/` | Production | Voice-to-memory knowledge graph |
| **Analogue** | `projects/analogue/` | Active | Book publishing / manuscript editing IDE |
| **Idea Engine** | `projects/idea-engine/` | Active | Autonomous evolutionary ideation system |
| **Golf Masters** | `projects/golf-masters/` | Active | Masters Tournament pool tracker with live ESPN scores |
| **Fix Queue** | `projects/polymath/` (feature) | Active | Voice-capture annoyances → AI-drafted automated fixes |

> **Sonically Sound** also exists as a deployed app but lives outside this repo.

## Fix Queue (Polymath Feature)

Voice-capture life annoyances → AI drafts automated fixes → approve → runs on cron.

### Architecture
- **Triage**: Voice notes classified as `annoyance` by Gemini, with severity + automatable flag
- **Drafting**: AI generates data-driven fix specs (email, weather, smart home, HTTP)
- **Approval**: `/fixes` page in Polymath UI — review draft, approve or reject
- **Execution**: GitHub Actions cron (every 30min) runs approved fixes via `/api/fix-queue`

### Fix Action Types
- `send_email` — Reminder/notification via Resend
- `weather_email` — Email with live Open-Meteo weather data
- `smart_home` — Frame TV / Sonos / bird cam (via Home Assistant or direct)
- `http_request` — Generic API calls

### Key Files
- `api/fix-queue.ts` — Main API (draft-pending, run-fixes, approve, reject, list)
- `api/_lib/fix-queue/drafter.ts` — AI fix generation
- `api/_lib/fix-queue/runner.ts` — Fix execution (email, weather, smart home)
- `api/_lib/fix-queue/types.ts` — FixDraft, FixAction types
- `src/pages/FixQueuePage.tsx` — Approval UI
- `.github/workflows/fix-queue-draft.yml` — Cron every 6h
- `.github/workflows/fix-queue-runner.yml` — Cron every 30min

### Env Vars Needed
- `RESEND_API_KEY` — For email fixes (already configured)
- `HOME_ASSISTANT_URL` + `HOME_ASSISTANT_TOKEN` — Smart home hub (optional)
- `SONOS_HTTP_API_URL` — node-sonos-http-api bridge (optional)
- `FRAME_TV_IP` — Samsung Frame TV local IP (optional)
- `BIRD_CAM_URL` — Bird cam HTTP endpoint (optional)

## Commands

```bash
cd projects/wizard-of-oz && npm run dev   # Pupils
cd projects/polymath && npm run dev       # Polymath
cd projects/analogue && npm run dev       # Analogue
cd projects/idea-engine && npm run dev    # Idea Engine
cd projects/golf-masters && npm run dev   # Golf Masters
```

## Skills

Use `/skill` for complex workflows:
- `session-start-hook` - Set up dev environment hooks

## Quick Reference

- **Deploy**: Push to `main` branch (Vercel auto-deploys)
- **Env vars**: Set in Vercel dashboard
- **Style**: TypeScript strict, functional React, no `any` types
- **AI model names**: ALWAYS verify model IDs against the latest online documentation (e.g. [Google Gemini models](https://ai.google.dev/gemini-api/docs/models)) before changing them. Never guess or rely on memory — models get deprecated and renamed frequently.

## How I Like To Work

- Plain English. No jargon, no filler.
- Concise. Short sentences. Bullets over paragraphs.
- Say what you did and why — skip the "I will now..." preamble.
- If something is uncertain, say so in one line and ask.

## Commits & PRs

Use conventional commits and keep PR metadata short.

**Commit subject**
- Format: `type(scope): short summary`
- Single line, ≤ 70 characters, imperative mood.
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

**Commit body (optional)**
- Blank line after subject, then why + notable decisions.
- Wrap at ~72 chars. Bullets fine.

**PR title**
- **Must be a single line, ≤ 70 chars** — the commit subject, nothing more.
- NEVER paste the commit body into the title. NEVER include newlines.
- If there is one commit, the PR title = that commit's subject.
- If there are multiple commits, write one new subject that covers them.

**PR body**
- 1–3 bullets on what changed and why.
- Test plan: 1–3 bullets of what to verify.
- Skip the boilerplate checklist unless a box genuinely applies.
- Link related issue with `Fixes #N` if relevant.

**Workflow**
- Develop on the branch specified in the session brief.
- Only open a PR when explicitly asked.
- Before opening a PR: run the project's `npm run build` in the project folder.

## Session Start

Check `NEXT_SESSION.md` for current status and tasks (if present).
