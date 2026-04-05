# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

## CRITICAL: Never push without explicit confirmation

**Vercel auto-builds on every push to remote and consumes paid build minutes.** To avoid burning through the Pro plan quota:

- NEVER run `git push` (to any branch, any remote) without explicit user confirmation **in the current turn**.
- Before pushing, you MUST ask: **"Ready to push?"** and wait for an explicit yes.
- Authorization from a previous turn does NOT carry over. Every push requires fresh confirmation.
- Only push when the work is genuinely complete (code done, tests passing, no WIP). Batch changes into a single push rather than pushing after every commit.
- Committing locally is fine and does not require confirmation — only the push to remote needs a gate.
- A PreToolUse hook in `.claude/settings.json` enforces this by blocking `git push` commands. If it blocks you, that is working as intended — stop and ask the user.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment & milestone tracking app |
| **Polymath** | `projects/polymath/` | Production | Voice-to-memory knowledge graph |
| **Analogue** | `projects/analogue/` | Active | Book publishing / manuscript editing IDE |
| **Idea Engine** | `projects/idea-engine/` | Active | Autonomous evolutionary ideation system |
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
```

## Skills

Use `/skill` for complex workflows:
- `session-start-hook` - Set up dev environment hooks

## Quick Reference

- **Deploy**: Push to `main` branch (Vercel auto-deploys)
- **Env vars**: Set in Vercel dashboard
- **Style**: TypeScript strict, functional React, no `any` types

## Session Start

Check `NEXT_SESSION.md` for current status and tasks (if present).
