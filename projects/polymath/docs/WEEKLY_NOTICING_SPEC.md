# Weekly Noticing — Follow-Up Spec

> **Status:** _Proposed, deferred. Not part of the onboarding scope shipped in PR #386._
> **Owner:** TBD
> **Depends on:** Onboarding chat (PR #386), captured-items extraction, `WeeklyIntersection` widget on Home

---

## TL;DR

Aperture writes a short prose "noticing" once a week, threading two things
the user has said into a single observation. Most weeks it's a reflection;
occasionally it pitches a project. It renders inside the existing card
aesthetic (no new visual language) and lives in the spaces we already have
— the onboarding reveal is its first instance, and the existing
`WeeklyIntersection` widget on Home becomes the recurring drip.

The point: turn the one-off reveal moment into a low-pressure rhythm that
makes the user feel noticed, occasionally produces project pitches, and
quietly justifies the existence of Memories + Lists by referencing them.

## Why this is a follow-up, not part of onboarding

The onboarding question was "after the chat, does the user understand
what's there?" — that is answered by the polished reveal + quiet seeding
of Lists, with no tour required. The Weekly Noticing answers a different
question: "what brings the user back next week?" That's a retention
problem, not an onboarding problem, and should be designed against
retention evidence rather than launched on a hunch.

## Design principles

1. **Noticings are observations, not assignments.** Most weeks the entry
   reads like a thoughtful friend pointing something out. No CTA. No
   "build this." Just a paragraph the user can savour and close.
2. **Old noticings don't accumulate visibly.** Home only ever shows the
   current week's. There is no scrollable backlog of unbuilt projects.
   An archive exists for users who want it (probably under Memories), but
   it's never in their face.
3. **Project pitches are rare and earned.** Roughly 1 entry in 3 or 4 ends
   with a soft project invitation, and only when the underlying signal is
   strong. Diluting that ratio turns the noticing into an inbox.
4. **Reuse the existing card aesthetic.** No new visual language. The
   reveal's hero card and Home's swipeable intersection card are both
   reused. Editorial typography lives _inside_ those existing containers.
5. **Lists earn their keep by being referenced.** Captured films, books,
   places appear as inline mentions inside noticings ("you mentioned
   _Blade Runner_, which you have on your Films list"). That's the moment
   Lists pays off — not at onboarding, not at capture, but when the
   editorial layer references them weeks later.

## The three flavours

Each weekly noticing is one of:

- **Reflective (≈60% of weeks).** Threads two memories or two list items
  into a single observation. No explicit ask. Two paragraphs of prose,
  with two short verbatim user phrases highlighted.
- **Progress (≈25% of weeks).** Threads recent project activity back to
  an earlier memory or pattern. Strengthens an existing project's
  narrative; doesn't propose a new one.
- **Generative (≈15% of weeks, only when signal is strong enough).**
  Reflects on a connection and ends with a soft invitation: "there might
  be a project in this — want to play with it?" Renders the suggestion
  using the existing "Try Something New" card style on the Projects page.

The model decides which flavour to write based on a fitness function over
the user's recent activity (memory volume, project velocity, captured-item
freshness, days since last generative noticing).

## How it ties to the onboarding reveal

The polished reveal in PR #386 is, structurally, the **first noticing**.
The two-quote split in `RevealSequence > InsightBody` is exactly the
visual language we want noticings to use. When this spec ships, the
onboarding reveal becomes "Page 1" of a journal that grows weekly — but
crucially we do _not_ tell the user that during onboarding. The framing
emerges naturally when their second noticing appears the following week.

## Surfaces

| Surface | What it shows | Notes |
|---|---|---|
| Onboarding reveal (existing) | The first noticing, rendered as the hero insight card. | Already shipped in PR #386. |
| `WeeklyIntersection` widget on Home | This week's noticing, in the existing swipeable card layout. | Replace generic "intersection" copy with the noticing's prose. Reuse the card chrome. |
| Project detail page | "From your noticing on April 12 →" backlink for projects born from a generative noticing. | One line in the existing typography. Optional — only renders when the project has a noticing source. |
| Memories archive (optional) | Browsable archive of past noticings. | Low-priority; only build if users ask for it. |

## Generation pipeline

Weekly cron (e.g. Sunday morning UTC) per active user:

1. **Gather corpus.** Last ~14 days of memories, last ~14 days of list
   items added, currently active project descriptions, and the user's
   coverage grid from onboarding.
2. **Score candidate threads.** Use embeddings + a lightweight scoring
   pass to find the top 3-5 candidate intersections (two items, one
   thread). Reject anything where the two items are too obviously related
   (must surprise) or too weakly related (must be plausible).
3. **Choose a flavour.** Based on:
   - Days since last generative noticing
   - Whether any active project is going stale (→ progress)
   - Whether two strong un-connected threads exist (→ generative)
   - Default → reflective
4. **Generate the noticing.** Use the same quote-and-link format as
   `first_insight` from the analyze prompt: two short verbatim user
   phrases joined by a connecting paragraph, plus an optional CTA for
   generative flavour.
5. **Validate.** Server-side validate that the two quoted phrases appear
   verbatim (or near-verbatim) in their source memories — same
   anti-hallucination gate the observer uses today.
6. **Persist.** Write to a `noticings` table keyed by user_id + week.
   Mark the previous noticing as archived.

## Data model

```sql
create table noticings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) not null,
  week_starting date not null,
  flavour text not null check (flavour in ('reflective', 'progress', 'generative')),
  quote_a text not null,
  quote_a_source_id uuid,         -- memory_id or list_item_id
  quote_b text not null,
  quote_b_source_id uuid,
  bridge text not null,           -- the connecting prose
  cta_text text,                  -- only for generative
  cta_project_seed jsonb,         -- only for generative
  status text not null default 'active' check (status in ('active', 'archived', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, week_starting)
);
```

## Open questions

- **Cadence.** Weekly is the working assumption; could be biweekly or
  triggered by activity volume rather than calendar.
- **Notification.** Push notification on Sunday morning when the new
  noticing is ready, or silent (user discovers on next visit)? Default to
  silent — the rhythm should be ambient, not push-driven.
- **First-noticing framing.** When the second noticing appears (week 2),
  do we add a one-time tooltip "this is the second page in your journal
  with Aperture"? Probably yes — it's the moment the cadence becomes
  legible.
- **Dismiss behaviour.** Should users be able to dismiss a noticing? If
  so, does dismissal feed back into future generation (avoid this kind
  of thread)?

## Out of scope (for this spec)

- Per-user voice tuning of the noticing prose.
- Multi-user / shared noticings.
- Branching off a noticing into a Polymath conversation thread.
- Audio playback of noticings.

## Success criteria (what we'd measure)

- **D7 / D30 retention** for users who received ≥1 noticing vs. those who
  didn't (cohort comparison).
- **Project creation rate** following a generative noticing vs. baseline.
- **Self-reported "feels noticed"** — short qualitative survey at week 4.

## Implementation rough cost

- Backend cron + generation + validation: ~3 days.
- DB migration + persistence: ~0.5 day.
- Home widget content swap (reuse existing card): ~0.5 day.
- Project detail backlink: ~0.5 day.
- Total: ~1 week of focused work.

## Decision log

- **2026-04-14.** Spec written as a follow-up to PR #386 (onboarding chat
  polish). Deliberately scoped out of the onboarding PR — onboarding is
  about the moment, this is about the rhythm. Build only after onboarding
  retention numbers are in and we have a real reason.
