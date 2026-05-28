# The Portrait — slice 1

A page in the app. Living, current, evidenced. Tap-to-cite. Predicts your week and gets graded on it.

This is the prototype slice — one section (`this week`), one prediction loop, one calibration score. Two weeks of real use. If it lands, we build the rest. If it doesn't, we found out cheap.

---

## The artifact

Mock render after two weeks of use. This voice — concrete, one idea per sentence, no analyst gloss — is the whole point.

> ### the portrait
>
> *updated 4 hours ago · calibration 7 / 10*
>
> ---
>
> **this week**
>
> You opened Analogue twice and closed it both times inside ten minutes. Third start-of-year session that didn't make it past warming up. Two films queued — *Bicycle Thieves*, *La Notte* — neither sitting on a recent capture, both sharing a long-take stillness the voice notes have been circling.
>
> Five thoughts captured. Three of them about your father. The fourth a sentence about the river you've now written, in some form, eight times since January. The fifth a project idea you've had before, listed under a different title, dismissed both times.
>
> Three projects you said mattered most this season went unopened.
>
> ---
>
> **last week, the harness predicted:**
> *"You'll capture something about your mother. You'll abandon the Saturday playlist by Wednesday. You'll open Analogue twice without writing."*
>
> → **partial — 2 of 3.** Analogue: yes. Playlist: abandoned Wednesday. Mother: not mentioned.
>
> ---
>
> **sealed for next week**
> *"You'll write the river sentence a ninth time. The Lisbon list will grow by at least two items. You'll start a music project Tuesday or Wednesday, and it'll be unnamed by Friday."*
>
> opens 3 June

Anything that drifts toward *"this reveals a pattern of…"*, *"what you couldn't see is…"*, *"a recurring theme in your work…"* fails. That's the analyst voice CLAUDE.md bans.

---

## Why this slice

Five things were on the table — living surface, speaks, predicts + graded, surfaces contradictions, pin a version.

This prototype builds **the living surface** + **predicts and gets graded**. The two that are load-bearing. The other three rest on whether these work. If the calibration loop doesn't feel real after two weeks, the whole portrait idea is wrong and we don't waste a month finding out.

It fits existing infrastructure exactly. No new model (Gemini Flash). No new third-party. The corpus is already gathered by `api/_lib/project-ideas/gather.ts` — we narrow the window.

---

## What ships

| | |
|---|---|
| **Route** | `/portrait`. Linked from the masthead next to search. Not folded into the home stack yet. The home stays goal-directed. The portrait earns its place in the stack only if the prototype works. |
| **API** | `utilities?resource=portrait`. `GET` returns the latest snapshot. `POST` regenerates (debounced 6h server-side, manual button on the page). |
| **Generator** | Single Gemini Flash call. Prompt interpolates `PLAIN_ENGLISH_RULES` from `api/_lib/plain-english.ts`, includes a BAD/GOOD anti-example, outputs strict JSON `{ body, evidence_refs, next_prediction }`. |
| **Reckoning** | New cron line at 06:00 UTC daily, scores any prediction whose `sealed_until` has passed. |
| **Calibration** | Rolling score across the user's last 10 reckonings. Hit=1, partial=0.5, miss=0. Rendered as `calibration 7 / 10`. |

---

## Schema

```sql
portrait_snapshots
  id            uuid pk default gen_random_uuid()
  user_id       uuid not null references auth.users(id) on delete cascade
  body          text not null
  evidence_refs jsonb not null default '[]'::jsonb
  generated_at  timestamptz not null default now()

portrait_predictions
  id              uuid pk default gen_random_uuid()
  user_id         uuid not null references auth.users(id) on delete cascade
  prediction      text not null
  week_starting   date not null
  sealed_until    date not null
  generated_at    timestamptz not null default now()

portrait_reckonings
  id              uuid pk default gen_random_uuid()
  prediction_id   uuid not null references portrait_predictions(id) on delete cascade
  called          text not null check (called in ('hit', 'partial', 'miss'))
  evidence        text not null
  score           numeric not null check (score in (0, 0.5, 1))
  evaluated_at    timestamptz not null default now()
```

RLS on all three: `user_id = auth.uid()` (reckonings join through `prediction_id`).

Migration: `projects/polymath/migrations/<next>_portrait.sql`.

---

## Prompt shape

Inputs (narrowed `gather.ts` — last 7 days only):

- Memories created in the last 7 days: `id, title, body, themes, memory_type, triage.category, created_at`
- List items touched in the last 7 days
- Project events in the last 7 days (state changes, sessions started, captures attached)
- Reading highlights in the last 7 days
- The prior prediction text (if one exists), so the model can reference what it said it would happen

Output JSON, validated against a Zod schema:

```ts
{
  body: string                    // 150–350 words, prose
  evidence_refs: Array<{
    kind: 'memory' | 'list_item' | 'project_event' | 'reading' | 'highlight'
    source_id: string
    span_start: number            // char index into body
    span_end: number              // char index into body
  }>
  next_prediction: string         // one falsifiable sentence
}
```

Anti-example baked into the prompt, after `PLAIN_ENGLISH_RULES`:

> **BAD:** *"This week reveals a pattern of returning to longform work after a period of fragmentation, suggesting a deeper reconnection with the creative practice."*
>
> **GOOD:** *"You opened Analogue twice and closed it both times inside ten minutes."*

Prediction rule: must name a behaviour or capture with a date, count, or named project. Plain language. No hedging. The reckoner can mark it `hit`, `partial`, or `miss` from the next week's corpus alone — if the prediction can't be checked, it's not a prediction.

---

## UI

Single-column page. Reuses the existing editorial system — `.section-header` for the section titles, `.section-seam` hairlines between blocks, the same hierarchy used on `HomePage.tsx`.

**Header:** title (`the portrait` lowercase serif), `updated 4 hours ago`, calibration badge (`7 / 10`).

**Section — this week:** the prose. Every sentence is tap-targetable. Tap → evidence panel slides in (desktop: right rail; mobile: bottom sheet). Panel shows the captures, items, and events the sentence was built from, with their snippets. Same pattern as the `see signals` reveal in `ProjectIdeasHome`.

**Section — last week, the harness predicted:** the prior prediction, the reckoning chip (`hit` / `partial` / `miss`), and the evidence sentence.

**Section — sealed for next week:** the new prediction. Plain text. No envelope skeuomorphism. The word "sealed" is the design.

**Refresh:** manual button in the page footer. Server-side 6h debounce so spam-clicking returns the cached snapshot instantly.

---

## Cron

Add to `.github/workflows/cron.yml` under the existing `0 8 * * *` block (alongside `polymath evolve`):

```yaml
hit "/api/utilities?resource=portrait-reckon" &
```

Server: iterates `portrait_predictions` where `sealed_until <= now()` and no `portrait_reckonings` row exists. For each, one Flash call with the prediction text + that week's corpus. Writes the reckoning row.

---

## What we'll know in two weeks

Open the portrait. Read it. Check whether the prior prediction was honest. Three questions:

- Did it tell you something you didn't already know?
- Did the prediction get it right enough that you trust the read?
- Would you miss it if it disappeared tomorrow?

**Two yeses → build the rest** (this season, who you are, where this is going, the speaking layer, contradictions, pin a version).

**One or fewer → kill it.** The portrait was wrong as a concept, not as an implementation. The slice cost a week. The cost of finding out late would have been a month.

---

## Not in this slice, and why

- **Speaking layer** (unprompted questions, addressable). Needs trust first. Trust comes from calibration.
- **Contradictions on the page.** Needs more than one week of corpus to surface meaningfully.
- **Pinning a version.** Pointless until the portrait is worth pinning.
- **Other sections** (this season / who you are / where this is going). Each is its own quality bar. Don't ship all four until `this week` earns it.

One page. One section. One prediction. One cron job. Uses what's already there. Tells us, fast, whether the rest is worth building.
