# Polymath UX persona review loop

A recurring review of Polymath's user-facing surfaces, run through five
imagined personas. Each pass picks one (persona, surface) pair in round-robin
order, reads the relevant code, and applies one concrete improvement.

Branch: `claude/ux-persona-review-loop-MNmoC`
State file: `.claude/ux-persona-review-state.json` (cursor into the persona
and surface arrays below)

## Personas

### 1. Jamie — the owner

The person this app exists for. Experienced creative, projects in every state
from active to long-dormant. Opens Polymath with willpower he wants directed
productively. Hates corporate-coach voice. Will close a card the moment it
reads like LinkedIn or a productivity coach.

What Jamie notices:
- Pretentious sentences masquerading as insight ("psychological defenses,"
  "narrative substrate," "high-impact transition").
- Words that don't match how he actually thinks about his projects
  (e.g. "consuming" for the films and books that shape his taste).
- Cards that ask him to do admin instead of make something.
- Empty states that feel like a sales page.

### 2. Mara — scattered creative

ADHD-leaning. Opens the app with restless energy and a 15-minute window.
Needs one clear next action. Bounces immediately if the home has more than
one ask, or if the first card is ambiguous about what to do.

What Mara notices:
- Multiple competing CTAs above the fold.
- Cards that describe a project without telling her what to do next.
- Decision overhead before she's even picked anything.
- Long sentences. Hedged language. Anything that takes more than one breath
  to read.

### 3. Theo — first-time visitor

Never seen Polymath. Mental model: note-taking app or productivity tool.
Sees "Keep Going" with no projects yet and has no idea what's supposed to
happen. Sees "The Moment" and reads it as marketing.

What Theo notices:
- Section names that assume context he doesn't have ("Keep Going,"
  "Now Consuming," "Up Next").
- Empty states that don't explain what the section will eventually do.
- Onboarding copy that sells the product instead of teaching the loop.
- Jargon: "thought," "capture," "shape," "harness."

### 4. Priya — accessibility-first

Keyboard-only navigation. Screen reader. Some colour-vision difference.
Dyslexic. Cares about real semantics, not just ARIA spackle.

What Priya notices:
- Buttons that are `<div>`s with onClick.
- Icon-only controls with no `aria-label`.
- Focus rings removed without a replacement.
- Low-contrast text (especially `opacity` on muted text colours).
- Animations that play even when `prefers-reduced-motion` is set.
- Decorative emoji or glyphs that the screen reader reads aloud.
- Hit targets under 44px on touch.

### 5. Ben — skeptical power user

Allergic to "second brain" framing, productivity-influencer voice, and
feature bloat. Closes the app the second anything smells like LinkedIn.
Will spot one buzzword and decide the whole product is fake.

What Ben notices:
- Words like "leveraging," "synergies," "soundscapes," "unlock momentum,"
  "psychological defenses," "narrative substrate."
- Invented hyphenated jargon in scare-quotes
  ("friction-over-function," "high-impact transition").
- Analyst voice — the app talking at him instead of acting like a friend.
- Features that exist to demo well rather than to help.

## Surfaces (round-robin)

1. **Home: Keep Going carousel** — `src/components/home/KeepGoingCarousel.tsx`
2. **Home: Up Next shelf** — `src/components/home/UpNextShelf.tsx`
3. **Home: Project Ideas button** — `src/components/home/ProjectIdeasHome.tsx`
4. **Home: Now Consuming strip** — `src/pages/HomePage.tsx` (`NowConsumingWidget`)
5. **Home: Thought of the Day** — `src/components/home/ThoughtOfTheDay.tsx`
6. **Home: Header** — `src/components/home/YourHourHeader.tsx`
7. **Voice capture: FAB + recorder** — `src/components/VoiceFAB.tsx`, `VoiceInput.tsx`
8. **Voice capture: onboarding live capture** — `src/components/onboarding/LiveVoiceCapture.tsx`
9. **Projects list page** — `src/pages/ProjectsPage.tsx`
10. **Project detail page** — `src/pages/ProjectDetailPage.tsx`
11. **Context sidebar (called out in CLAUDE.md as pretentious)** — `src/components/context/ContextSidebar.tsx`
12. **Lists detail / reading** — `src/pages/ListDetailPage.tsx`, `ReadingPage.tsx`

## Voice rules (from CLAUDE.md, repeated here so the loop has them inline)

- Real words people say. No "leveraging," "synergies," "soundscapes,"
  "unlock momentum," "psychological defenses," "narrative substrate."
- No invented hyphenated jargon in scare-quotes.
- No analyst voice. The app is a friend who's paying attention, not a
  consultant explaining you to yourself.
- One idea per sentence.
- Concrete nouns over abstract ones. "Logic Pro trial expired" beats "your
  reliance on the 90-day trial acted as an artificial deadline."
- Imperative verbs are fine. Time estimates are fine. Don't hedge.
- If you can't say it plainly, you don't understand it well enough to
  surface it. Stay silent.

## How a pass runs

1. Read `.claude/ux-persona-review-state.json`. The current pair is:
   - persona = `personas[step % personas.length]`
   - surface = `surfaces[step % surfaces.length]`

   `personas.length` (5) and `surfaces.length` (12) are coprime, so every
   step is a different persona *and* a different surface. The full cycle
   is 60 passes before any pair repeats.
2. Increment `step` by 1 and write the state back.
3. Read the surface's code. Look at the user-facing strings, the empty
   state, the focus behaviour, the keyboard path — through the chosen
   persona's eyes.
4. Apply **one** concrete improvement. Bias toward copy and semantics.
   Resist redesigns. The loop's value is many small passes, not one big one.
5. Append a line to `docs/ux-persona-review-log.md`:
   `YYYY-MM-DD — <persona> on <surface>: <what changed and why>`
6. Commit with a conventional subject. Push to
   `claude/ux-persona-review-loop-MNmoC`.

## Scope guardrails

- **Don't redesign.** If a surface needs a redesign, log it instead and
  move on. The loop produces incremental wins.
- **Don't extend Fix Queue, Idea Engine email, or the Context Engine
  sidebar's prompt logic** without asking — CLAUDE.md flags these.
- **No new dependencies.**
- **No new pages or routes** from inside the loop. Only edits to existing
  surfaces.
- **No emojis in user-facing copy** unless the user already uses them
  somewhere on that surface.
- **Skip a turn** rather than ship a weak improvement. Note the skip in
  the log with a reason.
