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
| **Polymath** | `projects/polymath/` | Production | Creative harness — captures thoughts and directs your creative willpower toward the right project |
| **Analogue** | `projects/analogue/` | Active | Book publishing / manuscript editing IDE |
| **Idea Engine** | `projects/idea-engine/` | Active | Standalone evolutionary ideation system — emails a curated daily digest of frontier-of-human-knowledge ideas. **Not part of Polymath.** Don't conflate when working on Polymath's homepage surfaces. |
| **Golf Masters** | `projects/golf-masters/` | Active | Masters pool tracker with live ESPN scores |
| **Fix Queue** | `projects/polymath/` (feature) | **Needs review** — owner doesn't actively use this; code may still be running. Don't extend without checking. |

> **Sonically Sound** ships from outside this repo.

## Plain English (mantra — applies everywhere)

This applies to everything Polymath produces or surfaces: AI prompts, AI-generated copy, UI strings, error messages, settings labels, empty states, push notifications, anywhere words appear.

**Rules:**
- Real words people say. No "leveraging," "synergies," "soundscapes," "unlocking momentum," "psychological defenses," "feature-rich," "narrative substrate."
- No invented hyphenated jargon in scare-quotes ("friction-over-function," "blind-edit," "high-impact transition"). If a term needs scare-quotes to be understood, rewrite it.
- No analyst voice. The app is not consulting at the user. It's a friend who's paying attention.
- One idea per sentence. Long, hedged, multi-clause analysis is the failure mode (see the Context Engine sidebar — pretentious in exactly this way).
- Concrete nouns over abstract ones. "Logic Pro trial expired" beats "your reliance on the 90-day trial of Logic Pro acted as an artificial deadline."
- Imperative verbs are fine. Time estimates are fine. Don't hedge.
- If you can't say it plainly, you don't understand it well enough to surface it. Stay silent.

When you write or modify any prompt that asks the model for output, repeat the plain-English rule inside the prompt with a short anti-example. The default Gemini Flash voice drifts to corporate-coach unless told otherwise.



Polymath is a **creative harness**. The user opens it with willpower to spend on creative work; the app's job is to direct that willpower productively — name a project worth starting, resurface the right forgotten one, or extend an existing one in a specific direction. It is not a "knowledge graph" or a "second brain" in the Mem.ai / Roam sense. It is goal-directed.

### Core loop

1. User records a voice note **inside the app** (no AudioPen — the integration was never real). Pipeline transcribes, tidies the prose, generates a title, saves as a "thought."
2. Thoughts feed the project corpus: existing projects (active / dormant / abandoned), lists (films / books / places — these are **identity signals**, not consumption logs; reading *Flowers for Algernon* makes you a different creative person from someone reading *50 Shades*), reading queue + highlights.
3. The home delivers The Moment + active project focus.

### What's NOT in the user's mental model

- **Todos / Fix Queue / AudioPen** — historical or unused. Code may still exist for these. Don't reference them as live features. If asked to extend them, ask first.
- **Idea Engine emails** — separate Python project, not a Polymath surface.
- **Context Engine sidebar** (`src/components/context/ContextSidebar.tsx`) — exists, surfaces an "AI Analysis" panel from many pages, but the output is the exact pretentious-coach voice the plain-English mantra forbids. **Needs review and rewrite of its prompt** before extending. Owner forgot it existed.

### Project = creative goal with a defined output

Active, partly-shaped, dormant, and abandoned are different states. Long-dormant projects are explicitly **not** waste — they are eligible for reshape (see Mode 2b below).

### Home surface stack (target — work in progress to consolidate to this)

1. **Header** — brand + duration toggle + search
2. **The Moment** — single hero card, dynamic content based on which mode scores highest (see below)
3. **Keep Going** — focus mode for active projects, Power Hour planning
4. **Now Consuming** — compact strip of active list items
5. **Thought of the Day** — resurfaced memory quote

Cards being **deprecated / folded into The Moment**: This Week (mashups), Unshaped Nudge, Try Something New. Their jobs map to Mode 3, Mode 1, and Mode 2 respectively.

### The Moment — three modes, scored each time

The Moment is the killer surface. It scores three modes 0-100 and fires the highest. Each mode has its own quality bar; modes don't fire just because it's a slow week.

- **Mode 1 — NEW IDEA COALESCING.** Name a project the user has been quietly circling across 3+ captures over 30-90 days but hasn't said out loud. Ripe when a concrete artefact-shape can be named in ≤6 words AND the theme isn't already a project AND identity (lists / reading) reinforces.
- **Mode 2a — RECENT FORGOTTEN PROJECT (3-16 weeks dormant).** "You forgot about this — pick it up." Ripe when recent captures resonate with the project's themes AND it has a defined deliverable AND not surfaced in 4+ weeks.
- **Mode 2b — LONG-DORMANT RESHAPE (4+ months dormant).** "You started this when you were a different person. Here's the version that fits who you are now." The reshape uses what the user has acquired *since* (skills, reading, completed projects, taste) to re-frame the original. Cooldown 12 weeks; reshape regenerates each time so it lands fresh. Honor the original capture, serve the present self.
- **Mode 3 — EXTEND.** "Here's a specific direction for an existing project." A recent capture (≤30 days) suggests a concrete new feature/output for an existing active or dormant project. Ripe when the extension is specific (names the new output) and the project can absorb it.

### Anti-patterns (kill on sight)

- **Forced surrealist mashups** — "willow memory totem," "dazzle-patterned commuter bike." Inputs as motifs, not as load-bearing structure.
- **Cliché tech-Twitter projects** — newsletter, podcast, course, tracker app, "directory of," digital garden, second brain, year-of-X challenge, zine that "explores" interests.
- **Admin disguised as build** — "create a file named X.json," "open settings," "research Y." A real next step uses a tool against a workpiece (cut, drill, flash, commit with named first content, drive, phone).
- **Narrative why_now** — "the April note about X means Y can finally land" asserts a causal connection that isn't real. why_now must name a specific recent acceleration that genuinely unblocks something.

### Identity layer

Lists + reading queue + recent highlights are framing inputs. Same project surfaces with different framing depending on what the user has been reading. *Bed by Ten* after a minimalism book reads differently than *Bed by Ten* after a film about constraint.

### Inputs to add (high-leverage, in order)

1. **Session context at app open** — one tap before home renders: how long (15/60/90, already on the duration toggle) + how you're feeling (focused / scattered / restless). The Moment calibrates everything to context.
2. **Per-project blocker field** — when work pauses, prompt "what's blocked here?" One sentence captured at the moment of pause. Powers the long-dormant reshape.
3. **List-item / reading reaction tags** — one tap per item: "inspired me" / "felt off" / "made me want to make X." Identity signal.
4. **Post-Keep-Going capture** — after a focus session ends, prompt "what did you do? what's next?" 30-second voice note feeds project freshness + cooldowns.
5. **Voice-note intent extraction at capture time** — already transcribing + tidying. Also extract: project idea / frustration / reflection / taste signal. Zero friction. Powers Mode 1 and Mode 3.

## Commands

Each project is its own npm workspace — `cd projects/<name>` first, then:

```bash
npm run dev                  # all JS projects
npm run build                # all JS projects (run before pushing)
npm test                     # polymath, wizard-of-oz (vitest)
npm test -- <pattern>        # run a single test file
npm run lint                 # polymath (eslint src/ api/), analogue (eslint .)
npm run type-check           # polymath only (tsc --noEmit)
```

`projects/idea-engine/` is Python (pyproject.toml, requires 3.11+) — no `npm` here. Tests via `pytest`, format/lint via `black` + `ruff`.

`projects/polymath/` also wraps as an Android app via Capacitor — see `build-android.sh`.

## Tech + Style

- **Frontend**: React (18 in polymath, 19 elsewhere), TypeScript (strict, no `any`), Vite
- **Backend**: Vercel serverless functions in each project's `api/`, Supabase (Postgres + RLS)
- **AI**: Gemini for embeddings, classification, AND synthesis in Polymath (via `@google/generative-ai`). Claude is referenced in the Idea Engine project (Python) but Polymath itself does not currently call the Anthropic SDK — don't add it without asking.
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
- A PreToolUse hook (`.claude/hooks/check-pr-title.sh`) blocks PR titles that are multi-line or > 70 chars.

## Cron (`.github/workflows/cron.yml`)

One workflow dispatches every Vercel cron endpoint. Branches on `github.event.schedule` (the cron string that fired) — never wall-clock time, because GitHub delays scheduled runs. `BASE` is hardcoded to `https://aper-ture.vercel.app`. `workflow_dispatch` with `force=true` runs everything.

| Schedule | Endpoints |
|----------|-----------|
| `*/30 * * * *` | `idea-engine?action=generate`, `fix-queue?action=run-fixes` |
| `0 */6 * * *` | `fix-queue?action=draft-pending`, `projects?resource=recompute-heat` |
| `0 8 * * *` | `projects?resource=evolve` |
| `0 9 * * *` | `idea-engine?action=review` then `idea-engine?action=send-digest` (sequential) |
| `0 8 * * 0` | `projects?resource=generate-digest`, `utilities?resource=generate-project-ideas` |

> The `idea-engine?action=*` and `fix-queue?action=*` rows belong to the standalone Idea Engine project and the Fix Queue feature respectively. Both flagged for review (see Projects table). The `projects?resource=*` rows and `utilities?resource=generate-project-ideas` are part of Polymath proper.

## Fix Queue (Polymath feature)

Voice-capture life annoyances → AI drafts automated fixes → approve → runs on cron.

**Architecture**
- Triage: voice notes classified as `annoyance` by Gemini (severity + automatable flag)
- Drafting: AI generates data-driven fix specs
- Approval: `/fixes` page in Polymath UI
- Execution: cron (see table above) hits `/api/fix-queue`

**Fix action types**
- `send_email` — Reminder/notification via Resend
- `weather_email` — Email with live Open-Meteo weather data
- `smart_home` — Frame TV / Sonos / bird cam (Home Assistant or direct)
- `http_request` — Generic API calls

**Key files** (all under `projects/polymath/`)
- `api/fix-queue.ts` — Main API (draft-pending, run-fixes, approve, reject, list)
- `api/_lib/fix-queue/drafter.ts` — AI fix generation
- `api/_lib/fix-queue/runner.ts` — Fix execution (tests in `runner.test.ts`)
- `api/_lib/fix-queue/types.ts` — FixDraft, FixAction types
- `src/pages/FixQueuePage.tsx` — Approval UI

**Env vars**
- `RESEND_API_KEY` — Email (configured)
- `IDEA_ENGINE_SECRET` — Bearer token cron uses to call `/api/*` endpoints
- `HOME_ASSISTANT_URL` + `HOME_ASSISTANT_TOKEN` — Smart home hub (optional)
- `SONOS_HTTP_API_URL` — node-sonos-http-api bridge (optional)
- `FRAME_TV_IP` — Samsung Frame TV local IP (optional)
- `BIRD_CAM_URL` — Bird cam HTTP endpoint (optional)

## Session start

If `NEXT_SESSION.md` exists, read it. Otherwise just begin.
