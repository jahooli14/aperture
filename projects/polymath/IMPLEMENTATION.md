# Polymath — Metabolism Implementation Plan

Companion to `WHY.md`. This is the executable spec: every schema change, every endpoint branch, every component, phase by phase.

## Context

Polymath's real job is to be a **metabolism for creative energy**: ideas go in raw, a few projects get finished, the rest rest in the drawer and quietly ripen until either resurfaced or reshaped into something that will get done. The user should never feel overloaded with a visible backlog — only the actionable (warmed, mutated, newly relevant) surfaces to them. Everything else lives in the cupboard until it's ready.

This plan turns that vision into working code without adding any new API endpoint files, and fits inside the GitHub Actions free tier.

## Non-Negotiables

1. **Zero new endpoint files.** Every new capability is a new `?resource=` / `step:` branch inside an existing `api/*.ts` file.
2. **Silence over slop.** Any AI output (heat reason, mutation proposal, catalyst match, digest item) must cite the user's own material. If it can't cite concrete evidence, it is not shown.
3. **Session-one payoff.** First voice note returns something useful in the same session. Metabolism machinery never slows capture.
4. **Cognitive load invisible by default.** The drawer lives behind a nav icon. Only the Focus strip and a conditional "For you today" strip are on the home screen. "For you today" renders nothing when there's nothing to say.
5. **Language pass.** Ban `ship` / `shipping` / `shipped` from all new code, UI copy, and docs. Use `finish`, `complete`, `make`, `publish`, `out in the world`.
6. **GitHub Actions budget.** All crons live in the single `cron.yml` runner. No new workflow files.

## Architecture Map

| Need | Absorbed by | How |
|---|---|---|
| Heat score read | `api/projects.ts` | `?resource=drawer` |
| Heat recompute (cron) | `api/projects.ts` | `?resource=recompute-heat` |
| Multi-priority (focus tier) | `api/projects.ts` | Relax existing `?resource=set-priority` to toggle, cap 3 |
| Drawer Digest generate (cron) | `api/projects.ts` | `?resource=generate-digest` |
| Drawer Digest read | `api/projects.ts` | `?resource=digest` |
| Catalyst inference for a project | `api/brainstorm.ts` | `step: 'infer-catalysts'` |
| Mutation proposal | `api/brainstorm.ts` | `step: 'evolve-project'` with `mode` param |
| Retrospective → new sparks | `api/brainstorm.ts` | `step: 'retrospective'` |
| Heat bump on new voice note | `api/memories.ts` | Side-effect inside existing `action: 'process'` |

Zero new endpoint files. Zero new HTTP routes. Only new branches inside files that already use the `resource` / `step` pattern.

## Schema Delta (one migration)

Migration file: `supabase/migrations/20260404_metabolism.sql`

```sql
-- Heat + catalysts + lineage on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS heat_score       REAL        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heat_reason      TEXT,
  ADD COLUMN IF NOT EXISTS heat_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalysts        JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_id        UUID        REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lineage_root_id  UUID        REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_heat ON projects (user_id, heat_score DESC)
  WHERE status NOT IN ('completed', 'archived', 'abandoned', 'graveyard');

CREATE INDEX IF NOT EXISTS idx_projects_lineage ON projects (lineage_root_id);

-- Drawer digest weekly snapshots
CREATE TABLE IF NOT EXISTS drawer_digests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  warmed          JSONB DEFAULT '[]'::jsonb,
  evolutions      JSONB DEFAULT '[]'::jsonb,
  snapshot_prompt JSONB,
  status          TEXT DEFAULT 'unread' CHECK (status IN ('unread','read','acted'))
);

CREATE INDEX IF NOT EXISTS idx_drawer_digests_user ON drawer_digests (user_id, generated_at DESC);

-- Project retrospectives (completion ritual)
CREATE TABLE IF NOT EXISTS project_retrospectives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  answers     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retros_project ON project_retrospectives (project_id);
```

`project.metadata.conversation[]` is stored inside existing `jsonb metadata`, so no column addition for chat persistence.

## Language Pass Rules

Applied to every new file and every touched file:

| Banned | Replace with |
|---|---|
| ship / shipped / shipping | finish / finished, complete / completed, make / made, publish / published, out in the world |
| ship metric | finished-work metric |
| ship ritual | completion ritual |
| backlog | drawer / cupboard |
| build / built (in metabolism context) | make / made |

## Phase 1 — Schema + Focus Cap of 3

**Goal:** Up to 3 projects can be simultaneously `is_priority: true`. Foundation migration lands. Projects page shows up to 3 priority cards in the Focus strip.

**Files:**
- `supabase/migrations/20260404_metabolism.sql` (new)
- `src/types.ts` — add heat fields, catalysts, parent_id, lineage_root_id to `Project` interface; update `is_priority` comment
- `api/projects.ts` — `set-priority` becomes toggle semantic with cap 3
- `src/pages/ProjectsPage.tsx` — `activeList` logic supports multiple priorities
- `src/components/projects/ProjectCard.tsx` — priority cards render with focus styling
- Any other call site of `set-priority` (find via grep)

**Acceptance:**
- Migration runs clean.
- Toggling priority on a 4th project while 3 are already set returns a 409 with a clear message.
- Up to 3 focus cards render at the top of the projects page.

## Phase 2 — Persist Project Chat + Feed into Power Hour

**Goal:** Project chat turns persist to `metadata.conversation[]`. Power Hour generator reads the last N turns as context when building the ignition / core / shutdown arc.

**Files:**
- `src/types.ts` — add `conversation?: ChatTurn[]` to `ProjectMetadata`
- `src/components/projects/ProjectChatPanel.tsx` — on every successful turn, write `metadata.conversation` via `updateProject`
- `api/brainstorm.ts` — `project-chat` step already accepts history; ensure persisted history is fed in
- `api/_lib/power-hour-generator.ts` — ingest tail of `metadata.conversation` and include in the Gemini prompt

**Acceptance:**
- Close/reopen the chat panel on a project; previous turns are hydrated.
- Start a Power Hour after a chat session; the generator's prompt logs show conversation tail included.

## Phase 3 — Heat Score + "For you today" Strip + Drawer Behind Nav

**Goal:** The drawer moves behind a nav icon. A conditional "For you today" strip appears on the projects page showing warmed drawer items with citation lines. Recompute cron runs every 6 h via `cron.yml` (already wired).

**Files:**
- `api/projects.ts` — new `?resource=recompute-heat` (cron target). Iterates drawer-tier projects, scores them against recent memories / articles / chat mentions / taste signals, writes `heat_score` + `heat_reason` + `heat_updated_at`.
- `api/projects.ts` — new `?resource=drawer` returning heat-sorted tops + shuffle tail for the browse view.
- `api/memories.ts` — side-effect in existing `action: 'process'`: after embedding, cheap cosine match against drawer projects, bump heat in place for any match over threshold.
- `src/pages/ProjectsPage.tsx` — remove inline drawer section from main view; add Focus strip, Attention strip (`ForYouToday`), Recent strip; link to new DrawerPage for full browse.
- `src/pages/DrawerPage.tsx` — new page (single file) rendering the full drawer with heat-sorted top + daily shuffle tail. Wired into router.
- `src/App.tsx` — add route, add nav icon.
- `src/components/projects/ForYouToday.tsx` — new component. Renders nothing when empty.

**Key: "For you today" is invisible when empty.** No placeholder, no empty state.

**Acceptance:**
- Nav has a "Drawer" icon.
- Projects page shows Focus + Attention (or nothing if no heat) + Recent.
- Drawer page lists heat-sorted top, shuffle tail below.
- Cron dispatch calls recompute-heat every 6h and logs success.

## Phase 4 — Catalysts

**Goal:** Every project gets a `catalysts[]` field inferred from its description. Sidebar panel on project detail shows them and their current match state. Heat includes catalyst match.

**Files:**
- `api/brainstorm.ts` — new `step: 'infer-catalysts'`. Takes project title + description, returns `{ catalysts: [{text, kind}] }`. Called on project create and on explicit refresh.
- `api/projects.ts` — call `infer-catalysts` on project creation path. Store in `catalysts` column.
- `api/projects.ts` — `recompute-heat` includes catalyst match signal (simple lexical / embedding comparison against recent user material).
- `src/components/projects/CatalystsPanel.tsx` — new collapsed sidebar component. Shows each catalyst with a dot (green = matched, grey = waiting).
- `src/pages/ProjectDetailPage.tsx` — mount the panel in the sidebar region.

**Acceptance:**
- Creating a new project auto-populates catalysts.
- Panel renders on project detail.
- Heat score of a project bumps visibly when a matching catalyst shows up in a new memory.

## Phase 5 — Mutation Proposals + Weekly Drawer Digest

**Goal:** The Sunday cron produces a `drawer_digests` row with warmed projects, 0–2 evolution proposals, and optionally one snapshot prompt. A banner appears on the projects page when an unread digest exists. Tapping opens a sheet that surfaces proposals inline in the "For you today" strip.

**Files:**
- `api/brainstorm.ts` — new `step: 'evolve-project'`. Accepts `project_id`, `mode` (`shrink|merge|split|reframe|snapshot` — `handoff` gated by settings flag). Returns `{ proposal: {...}, evidence_refs: [...] }`.
- `api/projects.ts` — new `?resource=generate-digest` (cron target). For each warmed drawer project, calls `evolve-project` to pick a mode, writes one `drawer_digests` row.
- `api/projects.ts` — new `?resource=digest` (GET) returning the latest unread digest for the user.
- `api/projects.ts` — new `?resource=digest-act` (POST) to mark digest as read/acted and apply accepted mutations.
- `src/components/projects/DrawerDigestSheet.tsx` — new sheet component mounted in ProjectsPage.
- `src/components/projects/ForYouToday.tsx` — ingests digest items alongside heat items.
- Applying an accepted mutation: writes new project with `parent_id` set, optionally archives parent based on mode.

**Acceptance:**
- Sunday cron run produces a new `drawer_digests` row.
- Banner appears on projects page with unread digest.
- Accepting a shrink mutation produces a new project with `parent_id` set to original.
- Rejecting keeps digest status acted; nothing else changes.

## Phase 6 — Completion Ritual + Retrospective → New Sparks

**Goal:** When a user marks a project finished (or an artifact is detected), a three-question retro fires. Answers are stored and piped into the sparks engine so finished projects feed future ideation.

**Files:**
- `api/brainstorm.ts` — new `step: 'retrospective'`. Accepts project + answers, returns 1–3 new sparks to seed into `project_suggestions`.
- `api/projects.ts` — detect transition to `completed` status and emit a retro prompt flag; accept retrospective answers via an existing `update` resource or new `?resource=complete-with-retro`.
- `src/components/projects/CompletionRitual.tsx` — new modal with three questions (`what worked / what surprised / what next`).
- `src/pages/ProjectDetailPage.tsx` — hook into the "mark finished" action.

**Language:** Component is `CompletionRitual`, not `ShipRitual`. Copy uses "finish / finished" throughout.

**Acceptance:**
- Marking a project finished opens the ritual modal.
- Submitting saves a `project_retrospectives` row.
- 1–3 new rows appear in `project_suggestions` tied back to the finished project.

## Phase 7 — Lineage Breadcrumb on Project Detail

**Goal:** Projects with `parent_id` show a breadcrumb linking to the parent, expandable into a family view.

**Files:**
- `api/projects.ts` — enrich single-project GET to include `parent` and `lineage[]` siblings (children of the same `lineage_root_id`).
- `src/components/projects/LineageBreadcrumb.tsx` — new compact component.
- `src/pages/ProjectDetailPage.tsx` — mount above the title when `parent_id` exists.

**Acceptance:**
- Navigating to a project that was born from a mutation shows "← evolved from [parent]".
- Tapping expands a list of siblings (other evolutions of the same root idea).

## Phase 8 — Handoff Opt-In

**Goal:** Handoff becomes a valid evolution mode when the user enables it in settings. Off by default.

**Files:**
- `src/pages/SettingsPage.tsx` — add `allow_handoff_mutations` toggle.
- User settings storage (wherever prefs live — TBD on exact file, check `src/lib/user-settings.ts` or similar).
- `api/brainstorm.ts` — `evolve-project` excludes `handoff` unless the user's setting is on.
- Digest generator respects the flag.

**Acceptance:**
- Toggle off → handoff never proposed.
- Toggle on → handoff can appear as an evolution mode in the digest.

## Phase 9 — Rename `/suggestions` → "Sparks" + Full Language Pass

**Goal:** User-facing vocabulary matches the three tiers (Sparks → Drawer → Focus). All `ship` language is gone from new code and user-facing copy.

**Files:**
- `src/pages/SuggestionsPage.tsx` — heading, copy, route label changed to "Sparks"
- `src/App.tsx` — route alias/nav label
- Grep whole repo for `ship` / `Ship` / `SHIP` in new components and in any copy we've touched; replace per the language-pass table.
- Do **not** touch the `cron.yml` or unrelated legacy files.

**Acceptance:**
- Nav reads "Sparks".
- No occurrences of "ship" in any file we've created or modified in this implementation.

## Verification Strategy

- **After each phase**: `npm run typecheck` (or whichever script exists) and commit.
- **Schema check**: the migration file can be dry-run against Supabase locally before commit.
- **Cron check**: `workflow_dispatch` on `cron.yml` with `force: true` exercises every endpoint including the new metabolism ones. Failed endpoints log `!! failed:` without breaking the job.
- **Silence-over-slop test**: run heat recompute against a user with no recent activity. Assert `heat_score` stays 0 and `heat_reason` stays null — no invented citations.

## What We Are Not Building

- No new API endpoint files (strict).
- No new nav routes beyond the Drawer page.
- No per-card Evolve button; evolution is digest-driven only.
- No auto-handoff; requires the setting and explicit acceptance.
- No retirement of the daily shuffle in the drawer. Serendipity stays.
- No global creative-metrics dashboard. The Focus strip + Attention strip is the whole home.

## Ordering Summary

1. Schema + focus cap
2. Persist chat + Power Hour feed
3. Heat + Attention strip + drawer-behind-nav
4. Catalysts
5. Mutations + Digest
6. Completion ritual + retro
7. Lineage
8. Handoff opt-in
9. Rename + language pass

Every phase is independently deployable. Each phase gets its own commit on `claude/polymath-value-proposition-YL1uv`.
