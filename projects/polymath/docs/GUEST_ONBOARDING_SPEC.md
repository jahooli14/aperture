# Guest Onboarding (Try-Before-You-Buy) — Follow-Up Spec

> **Status:** _Proposed, deferred. Not part of PR #386._
> **Owner:** TBD
> **Depends on:** Onboarding chat (PR #386), `auto_credit` mechanism in `api/memories.ts`
> **Replaces:** the auth-gate added in PR #386 (`OnboardingChatPage` will allow guests again once this lands).

---

## TL;DR

Today the chat is gated behind sign-in (PR #386, Option A). This spec
describes Option B/C: let guests run the entire 3-minute chat without an
account, buffer everything client-side, and replay it server-side at
sign-in. This is the modern try-before-you-buy pattern (Linear, Notion,
Figma all do it) and almost certainly converts better than asking for an
account before the user has seen what they get.

## Why we deferred

Option A (gate) was the right small fix for shipping the onboarding chat
because:

- It's correct. Nothing is silently lost.
- It's tiny — one auth check, one sign-in screen, one whitelisted `next=`
  redirect on `/login`.
- Try-before-you-buy is a real chunk of work — buffer schema, replay
  semantics, partial-failure handling, transcript ordering, idempotency
  guarantees. Doing it badly is worse than gating.

Once we have evidence (sign-in conversion rates from the gated flow), we
can decide whether the conversion lift from removing the gate is worth
the implementation cost.

## What's broken today (with the gate removed)

If you simply remove the auth gate added in PR #386, you'd be back to the
pre-PR situation:

1. Voice chat works (token endpoint is open).
2. Per-turn `createMemory` calls return 401, get caught and logged, then
   forgotten.
3. `persistCapturedItems` calls return 401, captured films/places/music
   are lost forever.
4. `BookshelfStep` book writes return 401, books are lost.
5. The reveal still renders (analyze + book-search are open).
6. If the user hits "Sign in to save your idea" at the end of reveal:
   - `PostOnboardingFlow` runs.
   - `auto_credit=true` POST sends `{ analysis, transcripts }` to
     `api/memories.ts:handleAutoCredit`.
   - Foundational memories get synthesized from the transcripts after the
     fact.
   - **But** `captured_items` and selected `books` are **not** in the
     payload. So even with sign-in, those parts of the chat are lost.

The fix needs to address all of (2)-(4) by buffering, and (6) by
extending `auto_credit` to accept the buffer.

## Design

### Client buffer

A single `useGuestBuffer()` hook (or part of an existing store) holds:

```ts
interface GuestBuffer {
  // From the chat itself
  transcripts: string[]                          // Already exists as allTranscriptsRef
  captured_items: CapturedItem[]                 // Already exists as capturedItemsRef
  // From the bookshelf step
  selected_books: BookSearchResult[]             // The books they chose
  // The grid + analysis (so we don't lose them on refresh)
  coverage_grid: CoverageGrid | null
  analysis: OnboardingAnalysis | null
  // Provenance
  started_at: string                             // ISO timestamp
  completed_at: string | null
}
```

Persisted to `sessionStorage` (not `localStorage`) so:

- A page refresh mid-chat doesn't lose state.
- Multiple browser tabs don't fight over it.
- It vanishes on tab close, which is probably the right TTL — if you
  close the tab without signing up, you're not coming back.

`OnboardingChatPage` and `BookshelfStep` write to the buffer instead of
hitting the API directly when `!isAuthenticated`. When authed, they hit
the API as today.

### Replay endpoint

Extend `auto_credit=true` (currently just `analysis + transcripts`) into
a richer endpoint, OR introduce a sibling endpoint
`POST /api/memories?onboarding_credit=true`. The latter is cleaner —
`auto_credit` should stay narrow.

```http
POST /api/utilities?resource=onboarding-credit
Authorization: Bearer <new-user's session token>
Content-Type: application/json

{
  "transcripts": ["...", "..."],
  "captured_items": [
    { "type": "book", "name": "Dune", "raw_phrase": "I just finished Dune" }
  ],
  "selected_books": [
    { "title": "Dune", "author": "Frank Herbert", "thumbnail": "..." }
  ],
  "analysis": { /* OnboardingAnalysis */ },
  "started_at": "2026-04-14T...",
  "completed_at": "2026-04-14T..."
}
```

Server:

1. Validates the user's session token (must be authenticated).
2. **Idempotency:** dedupe by `started_at` — if a credit row already
   exists for this user with this `started_at`, return the existing
   result instead of re-applying. Prevents double-writes if the
   replay is retried.
3. Within a single transaction:
   - Insert a `memories` row per transcript (`memory_type: 'foundational'`,
     tags `['onboarding', 'live-hybrid']`).
   - Run the existing `auto_credit` logic to synthesize any required
     foundational prompts from `analysis` that aren't covered by the raw
     transcripts.
   - Group `captured_items` by type, find-or-create the user's matching
     list, insert each item (skipping duplicates by lower-cased name).
   - Insert each `selected_book` into the user's Books list, skipping
     anything already inserted via the `captured_items` book pass.
4. Returns a summary of what was written (counts per type) so the client
   can show a brief "X memories, Y books, Z films saved" confirmation
   if we want.

### When the replay fires

Two viable triggers:

- **A. At sign-in inside the reveal flow.** The "Sign in to save your
  idea" CTA on the reveal becomes the natural moment. After sign-in,
  the buffer replays before `PostOnboardingFlow` starts.
- **B. On any new sign-in if a buffer exists.** More general — if the
  user closes the tab and signs in elsewhere, we'd lose the buffer
  anyway (sessionStorage is per-tab), so trigger A is sufficient.

Recommend (A). Simpler, more predictable.

### Partial-failure handling

Replays should be all-or-nothing-per-table. Within the transaction:

- If any individual list-item insert fails, log it but continue (the
  user shouldn't lose their entire onboarding because one list item was
  malformed).
- If the memories insert fails wholesale, abort and return a clear error
  — the user can retry from a "we saved most of it but ran into trouble
  with X" UI.

The `started_at`-based idempotency means a user can hit retry safely.

### UI changes

- `OnboardingChatPage`: drop the auth gate, route writes through the
  buffer when `!isAuthenticated`.
- `BookshelfStep`: same — buffer instead of writing directly when guest.
- `PostOnboardingFlow`: detect the guest buffer at mount; if present and
  the user just signed in, fire the credit endpoint with it before any
  other side effects.
- `RevealSequence`: nothing changes structurally — the existing "Sign in
  to save your idea" CTA already does the right thing. The credit step
  becomes the post-sign-in handshake.
- Add a tiny "saved X memories, Y books" confirmation toast after a
  successful credit, so the user feels the moment of "yes, it was kept."

## Open questions

- **Voice cost for guests.** Today we mint a Gemini Live token for any
  caller of `/api/utilities?resource=onboarding-token`. With a guest
  flow, an unauthenticated user can rack up Live API costs without ever
  becoming a user. Mitigations: (a) add per-IP rate limit on the token
  endpoint; (b) add a captcha gate on the welcome screen; (c) require
  email-only sign-in (no full account) before chat starts. Pick one
  before shipping.
- **OAuth sign-in mid-flow.** OAuth redirects break the SPA, blowing
  away `sessionStorage` in some flows. Either persist the buffer to a
  server-side draft row keyed by an anonymous client_id, or only allow
  email-OTP at the reveal sign-in moment (no OAuth). Cleanest: OTP only
  at the reveal CTA; OAuth available from `/login` for users coming via
  the "Not now" path.
- **Demo / preview mode.** Should we let signed-out users see a
  pre-canned reveal as a marketing demo (no real chat, no real data)?
  Out of scope here, but a related question.

## Out of scope

- Multi-device buffer sync (the user starts on phone, signs in on
  laptop). No.
- Long-lived guest sessions across days. SessionStorage TTL is fine.
- Anonymous user IDs in Supabase (using `signInAnonymously`). Could be a
  cleaner implementation if the cost trade-off is right, but adds RLS
  complexity. Worth a separate spike.

## Success criteria

- **Sign-in conversion rate** for users who reach `/onboarding` (current
  gate) vs. users who reach the reveal (proposed flow). The hypothesis
  is that letting users complete the chat first significantly lifts
  sign-in conversion. If the lift is <10pp, the implementation cost
  isn't worth it.
- **Data integrity**: zero captured-items lost across 100 test runs of
  the guest-then-credit flow.

## Implementation rough cost

- Client buffer + sessionStorage persistence: ~1 day.
- Wiring buffer into OnboardingChatPage + BookshelfStep: ~0.5 day.
- New `onboarding-credit` endpoint + idempotency: ~1 day.
- Per-IP rate limit on token endpoint: ~0.5 day.
- E2E test of guest → credit flow: ~1 day.
- Total: ~4 days of focused work, plus a careful review pass.

## Decision log

- **2026-04-14.** Spec written as the proper follow-up to the auth-gate
  in PR #386. Gate ships first because correctness > conversion for the
  initial onboarding launch. Revisit once we have sign-in conversion
  numbers from the gated flow.
