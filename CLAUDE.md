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
- One idea per sentence. Long, hedged, multi-clause analysis is the failure mode — the analyst/oracle voice ("what you couldn't see," "what this reveals").
- Concrete nouns over abstract ones. "Logic Pro trial expired" beats "your reliance on the 90-day trial of Logic Pro acted as an artificial deadline."
- Imperative verbs are fine. Time estimates are fine. Don't hedge.
- If you can't say it plainly, you don't understand it well enough to surface it. Stay silent.

When you write or modify any prompt that asks the model for output, repeat the plain-English rule inside the prompt with a short anti-example. The default Gemini Flash voice drifts to corporate-coach unless told otherwise.



Polymath is a **creative harness**. The user opens it with willpower to spend on creative work; the app's job is to direct that willpower productively — name a project worth starting, resurface the right forgotten one, or extend an existing one in a specific direction. It is not a "knowledge graph" or a "second brain" in the Mem.ai / Roam sense. It is goal-directed.

### Core loop

1. **Capture.** Voice note in-app → transcribe → tidy prose → title → save as a "thought." Capture-time triage classifies intent (`memory_type`, `triage.category`) so downstream surfaces can find it.
2. **Feed the corpus.** Thoughts join projects (active / dormant / abandoned with `blockers`), lists (films / books / music / places / etc.), and reading (queue + RSS + highlights). Lists are **identity signals**, not consumption logs — reading *Flowers for Algernon* makes you a different creative person from someone reading *50 Shades*.
3. **Direct the willpower.** The home stacks a starred project to push on, recently-touched projects to keep warm, an on-demand "suggest a project" surface, and an identity strip showing what you're consuming.

### Home surface stack (as shipped — `HomePage.tsx`)

A labelled editorial stack, separated by hairline seams:

1. **Masthead** — "Aperture." wordmark + search + (after 21:30) bedtime icon.
2. **Your priority** — `KeepGoingCard` for the starred project. Pulls a Power Hour plan; "Start session" opens the focus overlay.
3. **Still warm** — `RecentlyActiveMini`, 2-up glass cards of recently-touched projects.
4. **The queue** — `UpNextMini`, 2-up ghost cards of projects waiting their turn.
5. **Try something new** — `ProjectIdeasHome`. Collapsed by default to a quiet "suggest a project" pill. Clicking either reveals a queued idea (instant, baked overnight) or kicks the fast path (~10s).
6. **Now consuming** — `ConsumingWidget`. Active list items on top; Saved reads + New reads dropdowns underneath.
7. **Thought of the day** — `ThoughtOfTheDay`, an editorial pull-quote from a past memory.

### "Suggest a project" — modes inside `ProjectIdeasHome`

The on-demand surface is the killer one. Two cooperating generators, with the UI deriving a visual mode per idea so each card reads as a distinct kind of correspondence from the harness:

- **READ mode** (`mode='read'` in the DB) — the longitudinal pattern reader. Names a through-line across projects/voice notes/lists/reading the user hasn't said out loud, then names the project that breaks or extends it. The pattern is the hero; the project title sits below as the consequence. Cron-only — too slow for the on-demand path. Auto-surfaces on confidence ≥70; below that it sits in the queue.
- **CROSSOVER mode** (`mode='crossover'`) — locked (centre × arrival) seed pairs. Has four derived visual sub-modes based on evidence:
  - **new_idea** — a project shape coalescing across recent captures.
  - **forgotten** (3–16 weeks dormant) — "you set this down — pick it up."
  - **reshape** (16+ weeks dormant) — "you started this when you were a different person; here's the version that fits who you are now." Honors the original capture, serves the present self.
  - **extend** — concrete new direction for an active project, prompted by a recent capture.

Cron bakes a deep queue overnight (full pipeline, Read enabled). The on-demand button either reveals a queued idea or runs the fast path (single Flash call over the full corpus, ~10s). Cooldowns enforced at the project level: rejected centres blocked 180d, shown-not-acted-on centres blocked 30d.

### What's NOT in the user's mental model

- **Todos / Fix Queue / AudioPen** — historical or unused. Fix Queue route + API still exist so old drafts stay visible, but cron is disabled and it isn't surfaced on home. Don't extend without checking.
- **Idea Engine emails** — separate Python project, lives in this repo for hosting cost only.
- **Context Engine sidebar** (`src/components/context/ContextSidebar.tsx`) — surfaces an "AI Analysis" panel from many pages. Prompts in `api/connections.ts` (`analyze` + the `ai-action` types) are plain-English and voice-gated via `findVoiceViolations`. Still owner-unloved — confirm it's wanted before extending. If you add a new `ai-action` prompt, include a concrete BAD/GOOD anti-example like the existing ones.

### Project = creative goal with a defined output

Active, partly-shaped, dormant, and abandoned are different states. Long-dormant projects are explicitly **not** waste — they are eligible for reshape via the crossover generator.

### Anti-patterns (kill on sight)

- **Forced surrealist mashups** — "willow memory totem," "dazzle-patterned commuter bike." Inputs as motifs, not as load-bearing structure.
- **Cliché tech-Twitter projects** — newsletter, podcast, course, tracker app, "directory of," digital garden, second brain, year-of-X challenge, zine that "explores" interests.
- **Admin disguised as build** — "create a file named X.json," "open settings," "research Y." A real next step uses a tool against a workpiece (cut, drill, flash, commit with named first content, drive, phone).
- **Narrative why_now** — "the April note about X means Y can finally land" asserts a causal connection that isn't real. why_now must name a specific recent acceleration that genuinely unblocks something.

### Identity layer

Lists + reading queue + recent highlights are framing inputs. Same project surfaces with different framing depending on what the user has been reading. *Bed by Ten* after a minimalism book reads differently than *Bed by Ten* after a film about constraint.

### Session context

`useSessionContextStore` carries a per-session `feeling` (focused / scattered / restless), captured by the FeelingPill at app open and persisted to sessionStorage (resets when the tab closes). The on-demand "suggest a project" path passes it into the generator prompt so the re-roll calibrates to right-now state.

### Inputs still to add

1. **List-item / reading reaction tags** — one tap per item: "inspired me" / "felt off" / "made me want to make X." Sharpens the identity signal beyond "added to list."
2. **Post-Keep-Going capture** — after a focus session ends, prompt "what did you do? what's next?" A 30-second voice note feeds project freshness + cooldowns.

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
- **AI thinking cost**: Flash-Lite is a *thinking* model — thinking tokens bill as output ($1.50/1M). Mechanical classify/extract/score calls pass a capped thinking level via `thinkingFragment()` in `api/_lib/gemini-thinking.ts`; creative synthesis stays on the model default. `GEMINI_THINKING_LEVEL` (Vercel env: `minimal`/`low`/`medium`/`high`) globally overrides every wired call — dial it up if output quality dips, down to cut cost. Keep new mechanical calls capped; never cap creative idea/prose generation.
- **Card surfaces**: use `.glass-card` (theme.css) — this is canonical. `.premium-card` / `.premium-glass` (premium-dark.css) are legacy; don't reach for them in new code.
- **AI voice**: every prompt that produces user-facing prose interpolates `PLAIN_ENGLISH_RULES` from `api/_lib/plain-english.ts`. Add new banned words / cringe patterns there, not inline.

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
| `*/30 * * * *` | `idea-engine?action=generate` |
| `0 */6 * * *` | `projects?resource=recompute-heat` |
| `0 8 * * *` | `projects?resource=evolve`, `utilities?resource=generate-project-ideas` |
| `0 9 * * *` | `idea-engine?action=review` then `idea-engine?action=send-digest` (sequential) |
| `0 8 * * 0` | `projects?resource=generate-digest` |

> The `idea-engine?action=*` rows belong to the standalone Idea Engine project (separate from Polymath; lives in this repo to keep hosting costs down). The `projects?resource=*` rows and `utilities?resource=generate-project-ideas` are part of Polymath proper. **Fix Queue cron is disabled** — the route and API remain so existing drafts stay visible, but no new drafts are generated or executed.

Background sync calls (DataSynchronizer): `/api/memories?action=evolution`, `/api/projects?resource=bedtime`, `/api/reading?resource=rss` — these are triggered from the client on internal timers, not by cron, so they are not in the table above.

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
- `BIRD_CAM_URL` — Bird cam HTTP endpoint (optional)

> Frame TV has no env var — it's driven through Home Assistant (`runner.ts`), since direct local-IP control isn't possible from the cloud.

## Session start

If `NEXT_SESSION.md` exists, read it. Otherwise just begin.
