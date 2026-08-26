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
| **Idea Engine** | `projects/polymath/api/_lib/idea-engine-v2/` | Active | Evolutionary ideation system — emails a curated daily digest of frontier-of-human-knowledge ideas. Not part of Polymath's product surface (don't conflate with Polymath's home feed). TypeScript, lives inside the polymath API — see Cron section below. |
| **Golf Masters** | `projects/golf-masters/` | Active | Masters pool tracker with live ESPN scores |
| **Heart Recovery** | `projects/heart-recovery/` | Active | Day-by-day post-heart-attack (stent/PCI) recovery guide — single user, no backend, localStorage only |
| **Relay** | `projects/relay/` | Active | Write a story with friends, a line at a time. PWA + web push. Up to 10 writers per story. |
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
2. **Today's answer** — `TodaysAnswerCard`, the single output box. One statement, one action ("Start session" → focus overlay), one quiet redirect ("or steer it"). The redirect panel owns BOTH the Focus chat thread and the full idea deck — these used to be separate stacked cards (`KeepGoingCard` + `FocusChat` + `ProjectIdeasHome`) and were merged. `FeelingPill` sits above it feeding session context.
3. **Everything else** — `EverythingElseMini`, one swipeable row: still-warm projects then queued ones. Replaced the old separate "still warm" / "the queue" grids.
4. **Worth a look** — `ReviewRotation`. Forgotten projects reviewed and acted on **in place** (pick it up / still mine / park it) — no navigation. **One card at a time**, the rest stacked behind it; an earlier cut showed all three at once, which put nine buttons on home and broke "guide, not menu". Ordered by shared label with the starred project, so a resurfaced one reads as a building block. Invisible once the batch is clear. See Project review below.
5. **Now consuming** — `ConsumingWidget`. Active list items on top; Saved reads + New reads dropdowns underneath.
6. **Thought of the day** — `ThoughtOfTheDay`, an editorial pull-quote from a past memory.

> "Guide, not menu" — one statement, one action, one quiet way to redirect. Never a question next to two competing buttons. Every section below the answer box is invisible when empty.

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
- **Idea Engine emails** — not a Polymath surface. Lives inside the polymath API (`api/_lib/idea-engine-v2/`). See Cron section.
- **Context Engine sidebar** (`src/components/context/ContextSidebar.tsx`) — surfaces an "AI Analysis" panel from many pages. Prompts in `api/connections.ts` (`analyze` + the `ai-action` types) are plain-English and voice-gated via `findVoiceViolations`. Still owner-unloved — confirm it's wanted before extending. If you add a new `ai-action` prompt, include a concrete BAD/GOOD anti-example like the existing ones.

### Project = creative goal with a defined output

Active, partly-shaped, dormant, and abandoned are different states. Long-dormant projects are explicitly **not** waste — they are eligible for reshape via the crossover generator.

### Anti-patterns (kill on sight)

- **Forced surrealist mashups** — "willow memory totem," "dazzle-patterned commuter bike." Inputs as motifs, not as load-bearing structure.
- **Cliché tech-Twitter projects** — newsletter, podcast, course, tracker app, "directory of," digital garden, second brain, year-of-X challenge, zine that "explores" interests.
- **Admin disguised as build** — "create a file named X.json," "open settings," "research Y." A real next step uses a tool against a workpiece (cut, drill, flash, commit with named first content, drive, phone).
- **Narrative why_now** — "the April note about X means Y can finally land" asserts a causal connection that isn't real. why_now must name a specific recent acceleration that genuinely unblocks something.

### Project labels + review rotation

**Labels, not containers.** Projects carry `metadata.tags: string[]` — a field that already existed and was already read by the idea generator (`gather.ts`, `seed-picker.ts`) and the resurface scorer, but had nothing writing to it. `api/_lib/project-tags.ts` fills it. A project can be both `music` and `woodwork`; that overlap is the point. `type` is legacy and is NOT a grouping axis — "creative" labels nothing when every project is creative.

- Vocabulary is **derived from what the user already has**, not a fixed enum. Existing labels are handed to the model as "strongly prefer these" so it reuses rather than minting near-synonyms. Free-text tags rot into forty singletons that group nothing.
- `normalizeTag` slugifies (lowercase, hyphenated, 2–24 chars) and drops anything that can't reduce to one. A malformed label is worse than a missing one — it becomes a filter matching exactly one project forever.
- Max 3 labels per project. Backfill is **idempotent** (skips projects that already have labels), so it's safe to re-run and safe on cron. `projects?resource=backfill-tags` POST, plus a 40-project pass in the Vercel daily cron to catch newly-created projects.

**The review rotation** (`api/_lib/project-review.ts` → `ReviewRotation` on home). A few priority projects live in the user's head fine; everything else goes out of sight and stops being able to spark the next thing. A flat list on another page doesn't fix that — nobody opens a list of forty things on purpose.

- **Rotation, not a list.** 2–3 at a time (`REVIEW_BATCH_SIZE`), surfaced on home, one tap each.
- **Acted on in place.** `still mine` / `pick it up` (→ active) / `park it` (→ dormant). Never navigates — the projects page is for *browsing*, the review finishes where it starts.
- Every action stamps `metadata.last_reviewed_at`, which sets a `REVIEW_COOLDOWN_DAYS` (21d) rest before the project is eligible again. That's what makes it rotate.
- **Ordering is what makes it useful:** projects sharing a label with the starred project come first (building blocks for what's already in motion), then longest-untouched. Excluded: the priority project, anything pinned to Up Next, unshaped captures, completed/graveyard.
- Reasons are **cited or plain** — "Also music, like The Album." when there's a real shared label, otherwise "Untouched 4 months." Never an invented causal story about what recent notes "mean" (the narrative `why_now` anti-pattern).
- Selection logic is pure (`selectReviewCandidates`) and unit-tested; the IO wrapper (`getReviewQueue`) just fetches and delegates. Pure view helpers live in `reviewRotationOps.ts` — the `.tsx` imports the API client, which reaches Supabase's build-time constants and so can't be imported under vitest.

**Labels drive colour** (`getTheme` in `projectTheme.ts`). Colour resolves label → legacy `type` → hashed title. A label with its own palette entry (music, art, writing…) uses it; any other label is hashed on the *label*, so every woodwork project comes out the same colour and the page reads as grouped by craft instead of as confetti. Every project card passes `metadata.tags` now. The review card also dims with dormancy (`dormancyFade`, floors at 0.62 — atmosphere, never an accessibility problem).

### Identity layer

Lists + reading queue + recent highlights are framing inputs. Same project surfaces with different framing depending on what the user has been reading. *Bed by Ten* after a minimalism book reads differently than *Bed by Ten* after a film about constraint.

### Session context

`useSessionContextStore` carries a per-session `feeling` (focused / scattered / restless), captured by the FeelingPill at app open and persisted to sessionStorage (resets when the tab closes). The on-demand "suggest a project" path passes it into the generator prompt so the re-roll calibrates to right-now state.

### Inputs still to add

1. **List-item / reading reaction tags** — one tap per item: "inspired me" / "felt off" / "made me want to make X." Sharpens the identity signal beyond "added to list."
2. **Post-Keep-Going capture** — after a focus session ends, prompt "what did you do? what's next?" A 30-second voice note feeds project freshness + cooldowns.

## Relay

Line-by-line collaborative stories. Started as a WhatsApp thread with Ben, moved
to Signal, now its own PWA. One person writes a line, the next person writes the
next one.

**The notification is the product.** Signal's notifications are why the thread
survived. If Relay's "your turn" push is worse than Signal's, it dies. Every
other feature is downstream of that working.

### Shape

- **Turn modes.** `rotation` is a strict queue (right for two people). `open`
  lets anyone but the last writer go (right for a group, where a strict queue
  stalls the moment someone's on holiday). Any member can **skip** a stalled
  turn — a rotation that can wedge is worse than no rotation.
- **Whose turn it is** is resolved by a database trigger in the same transaction
  as the line that changes it, never recomputed in the client. Pure helpers in
  `api/_lib/turns.ts` are unit-tested and shared with the UI.
- **Two views of the same thread.** `thread` shows who wrote what and when.
  `read` drops attribution and runs the lines together as prose — that's the
  reason to leave a chat app.
- **The exchange has to be visible without reading it.** In `thread`, turns sit
  on alternating sides with a rule and a faint wash in the writer's colour, so
  the back-and-forth reads at a glance — the thing chat apps got right and a
  flat list loses. Names are the fallback, not the signal. Line numbers stay in
  a fixed gutter regardless of indent, because the index cites them.
- **Chapters** are marked by the writer on the line that opens one. The story
  already did this in prose ("Chapter 2.", "III: When in Rome"); this makes it
  navigable.
- **No AI writes or suggests lines.** Ever. The whole point is that it's the two
  of you. Derived stats only — counts, gaps, chapters, all from the lines
  themselves. Never an invented story about what a gap "means".
- **The index** (`api/story-index.ts`) is the one place Gemini is used, and it
  reads rather than writes: people, places, and what keeps coming back, each
  pointing at the line numbers it came from. Tapping a number jumps there.
  - **Grounding is the whole design.** `api/_lib/index/ground.ts` checks every
    entry against the text: the cited line must exist, and the name must
    actually appear in one of the lines cited for it. Anything that fails is
    dropped, so an invented character can't reach the sheet. Pure and unit
    tested — never bypass it.
  - Notes are one plain sentence, and a note that slips into critic voice is
    dropped while the entry stands on its citations (`plain-english.ts`).
  - Built on demand, never automatically. Cached in `relay.story_index` with
    `up_to_position`, which is how the sheet knows it's behind.
  - `GEMINI_KEY` in Vercel. Without it everything else still works — the sheet
    just says so.
- **Sending is optimistic.** The line appears and the turn moves the moment you
  hit send; a failure pulls the placeholder back out and the composer restores
  your text, so a dropped connection never loses a line.
- **Push heals itself.** `ensurePushHealthy()` runs on sign-in: if permission is
  still granted but the subscription has gone (Safari drops them silently), it
  re-subscribes and re-saves. Settings has a test-notification button, because
  "did that actually work?" is otherwise unanswerable.
- **One nudge when a turn goes cold** (`api/cron/nudge.ts`, Vercel cron, daily).
  The only other push fires as a line is written — miss it and there is silence
  forever, which is how a thread dies. After `NUDGE_AFTER_DAYS` (3) the person
  who owes a line gets one reminder carrying the line they're following, then a
  `QUIET_PERIOD_DAYS` (4) rest. Stamped whether or not a push lands, so someone
  with notifications off isn't retried daily. The `relay.stale_turns` view
  answers "whose turn, how stale" in one place; solo stories are excluded.
- **Nothing written is lost.** A send that fails offline is queued in this
  browser (`lib/outbox.ts`) and retried on `online`; drafts save as you type,
  per story, and you can write when it *isn't* your turn — ideas don't wait for
  permission. Your own newest line stays editable for five minutes, and only
  while it is still the newest, since editing a line someone already answered
  rewrites what they were replying to.
- **Reading.** Long silences are named where they fall (`gapLabel`, from the
  timestamps only). How far you've read lives on `story_members`, so it follows
  you between devices. Search filters and marks hits. Names the index knows get
  a dotted underline in `thread` only — `read` stays pure prose.
- **Marks, not chat.** One tap says a line landed. No push, no reply, no thread.
- **The book** (`PrintPage`, `/story/:id/print`). Title page, chapters on fresh
  sheets, indented paragraphs, a colophon with who wrote what — printed through
  the browser, so Share → Print → Save as PDF on a phone. No attribution in the
  body: it's the thing you'd hand someone.

### Setup

Relay shares a Supabase project with another Aperture app — it lives in its own
`relay` schema rather than needing a free-tier slot of its own.

1. Run the migrations in `projects/relay/supabase/migrations/` in order
   (`0001_relay.sql`, `0002_story_index.sql`, `0003_nudges_marks_reading.sql`).
2. Supabase dashboard → **Settings → API → Exposed schemas** → add `relay`.
   PostgREST can't see the tables otherwise.
3. `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel. Without them the app works
   but notifications are off.
4. Seed the existing story, either way round:
   - **No terminal:** paste `supabase/seed-pasco.sql` into the SQL editor after
     both writers have signed in once. Three variables at the top to edit.
   - **Terminal:** `npm run seed -- --dan=you@example.com --ben=ben@example.com`,
     plus `--start=YYYY-MM-DD` to spread the line timestamps.
   Both are idempotent and both leave the turn with whoever is genuinely up.
   Regenerate the SQL from the transcript with
   `npx tsx scripts/make-seed-sql.ts` — never hand-edit it.

Auth is a six-digit emailed code — no passwords, no magic link. Email
templates are **per Supabase project**, and the shared one renders
`{{ .Token }}` only (Pupils signs in the same way), so a link-based flow would
send Relay's users a code with nowhere to type it. Codes also need no redirect
allow-list, and phones offer to autofill them. Don't edit that template to add
a link — it would change Pupils' email too. Env vars: `.env.example` in the
project folder (it's force-added past the root `.gitignore`).

Both SQL files are checked against a real Postgres 16 with a Supabase-shaped
shim (auth.users, auth.uid, the three roles, supabase_realtime): migration,
seed, turn trigger, 10-writer cap, invite redemption and the RLS policies.

### iOS caveat

Web push on iPhone only works once the PWA is installed to the home screen
(Share → Add to Home Screen, iOS 16.4+). A Safari tab gets nothing, and Safari
can silently drop the subscription. `NotificationToggle` detects this and says
so rather than failing quietly.

## Commands

Each project is its own npm workspace — `cd projects/<name>` first, then:

```bash
npm run dev                  # all JS projects
npm run build                # all JS projects (run before pushing)
npm test                     # polymath, wizard-of-oz, relay (vitest)
npm test -- <pattern>        # run a single test file
npm run lint                 # polymath (eslint src/ api/), analogue (eslint .)
npm run type-check           # polymath, relay (tsc)
```

`projects/polymath/` also wraps as an Android app via Capacitor — see `build-android.sh`.

## Tech + Style

- **Frontend**: React (18 in polymath, 19 elsewhere), TypeScript (strict, no `any`), Vite
- **Backend**: Vercel serverless functions in each project's `api/`, Supabase (Postgres + RLS)
- **AI**: Gemini for embeddings, classification, AND synthesis in Polymath (via `@google/generative-ai`). Claude is referenced in the Idea Engine project (Python) but Polymath itself does not currently call the Anthropic SDK — don't add it without asking.
- **Naming**: PascalCase components, camelCase functions, feature-based folders, files ≤ 300 lines
- **AI model IDs**: Centralized in `api/_lib/models.ts` (+ `idea-engine-v2/models.ts`). Chat/generation models use `-latest` aliases (`gemini-flash-lite-latest`, `gemini-pro-latest`) so they auto-track Google's newest build — no version to rot on deprecation. Caveat: `-latest` can hot-swap onto preview/experimental with ~2 weeks' notice, shifting voice/cost/rate-limits — if it drifts, pin a stable ID here. **Embeddings stay pinned** (`gemini-embedding-001`): an alias swap changes the vector space and breaks every stored embedding. Verify against [live docs](https://ai.google.dev/gemini-api/docs/models) before changing.
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
| `0 */2 * * *` | `idea-engine?action=generate` |
| `0 */6 * * *` | `projects?resource=recompute-heat` |
| `0 8 * * *` | `projects?resource=evolve`, `utilities?resource=generate-project-ideas` |
| `0 9 * * *` | `idea-engine?action=review` then `idea-engine?action=send-digest` (sequential) |
| `0 8 * * 0` | `projects?resource=generate-digest` |

> **Note:** the `idea-engine?action=*` endpoints are TypeScript, living in `projects/polymath/api/idea-engine.ts` + `api/_lib/idea-engine-v2/`, deployed as part of the polymath Vercel app — there's no separate standalone project. `idea-engine?action=generate` runs every 2 hours (was hourly, was `*/30 * * * *` before that) — cut because `action=review` only ever processes 10 pending ideas/day, so hourly generation (up to 24/day) was more than double what review could use.
>
> **Fix Queue cron is disabled** — the route and API remain so existing drafts stay visible, but no new drafts are generated or executed.

Besides the GitHub Actions table above, Vercel's own cron (`projects/polymath/vercel.json`, Hobby-tier limit of 1 cron) fires `/api/cron/jobs?job=daily` once a day at 21:30 UTC. That single request bundles several more Gemini-calling tasks: stuck-memory reprocessing, bedtime prompts, Power Hour plan, rotting-project detection, project labelling (untagged projects only, 40/run), embedding maintenance, and (Sundays) capability extraction + drawer digest. It used to also re-run project evolution (same prompt/table as the 08:00 UTC `projects?resource=evolve` above) — removed, since it meant every active project got evolved twice a day.

Background sync calls (DataSynchronizer): `/api/memories?action=evolution`, `/api/projects?resource=bedtime`, `/api/reading?resource=rss` — these are triggered from the client on internal timers, not by cron, so they are not in the table above. Of those, only `bedtime` can call Gemini, and only if the Vercel daily cron hasn't already generated today's prompts.

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
