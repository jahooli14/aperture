# UX persona review log

One line per pass. Newest at the bottom.

Format: `YYYY-MM-DD — <persona> on <surface>: <change>`

- 2026-05-12 — Jamie on Home: Keep Going carousel: drop the "Continue where you left off" fallback and hide the session preview block entirely when no real headline or incomplete task exists. The fallback was the exact analyst voice CLAUDE.md forbids — pretending to know a next step the system doesn't know.
- 2026-05-12 — Mara on Home: Project Ideas button: hide the redundant "suggest a project" pill when the earned teaser is showing. One CTA per state, not two competing CTAs.
- 2026-05-12 — Theo on Voice capture: onboarding (UnauthHome): drop the precious "Aperture listens. The thread between what you said reveals itself." subline. The hook + animated demo + "start talking" CTA carry the page; the subline was filler that read as marketing.
- 2026-05-12 — Theo on Home: Keep Going carousel: empty-state button "Start one" → "Start your first project". Ambiguous for a brand-new user.
- 2026-05-12 — Priya on Voice capture: FAB + recorder: fix the wrong aria-label on the FAB. It said "tap to record, hold to choose type" but tap actually opens the typed thought sheet and hold records voice. Replaced with "New thought — tap to write, hold to record".
- 2026-05-12 — Priya on Projects list page: add aria-label to the three icon-only header buttons (back, search, completed). They had title attributes (hover tooltip) but no aria-label, so screen readers got silence.
- 2026-05-12 — Priya on Context sidebar: add aria-label to the close (X) button. It had no accessible name.
- 2026-05-12 — Ben on Home: Now Consuming strip: section header "what you're consuming" → "what you're into". CLAUDE.md is explicit that lists are identity signals, not consumption logs; "consuming" was the exact second-brain framing the mantra forbids.
- 2026-05-12 — Ben on Context sidebar: action result header "Pattern Revealed" → "Pattern Found". Parallels "Thread Traced" / "Gaps Found" and drops the cinematic flourish.
- 2026-05-12 — Ben on Home: Keep Going carousel: dormancy label "slipping away" → "long quiet". Parallels "going quiet" and drops the melodrama; "slipping away" put agency in a weird place.
