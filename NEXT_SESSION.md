# Next session

## What just shipped (branch `claude/polymath-gaps-improvements-AmdfG`)

1. **Session-context prompt** — `src/components/home/SessionContextPrompt.tsx`. One-tap "how are you arriving?" (focused / scattered / restless) shown once per browser session. Uses the existing `useSessionContextStore` (now also tracks `promptSeen`).
2. **Mode-register chip** — small uppercase chip on the home masthead naming what the lead card is firing in: `priority`, `keep going`, `quiet`, `restless · try new`, `small win`. Reads feeling + project state.
3. **Long-dormant hint** — `src/components/home/LongDormantHint.tsx`. Renders a single low-contrast line on the home for a shaped project dormant 120+ days. Mode 2b seed (no AI reshape yet).
4. **Reading reactions** — three-tap reaction picker in `ArticleCompletionDialog` ("Inspired me" / "Felt off" / "Made me want to make"). Persists onto `article.tags` as `reaction:<value>`. Identity-signal capture.
5. **Plain-English drift catchers** — added ~17 banned words + 8 cringe patterns to `api/_lib/plain-english.ts` (intentionality, discipline, lean into, double down, "the practice of X-ing", "your relationship with/to", etc.).
6. **`useLongDormantProject` selector** — in `useProjectStore.ts`. Returns oldest shaped + dormant project past the 120-day cutoff, or null.

List-item reactions (sparked / off / make) were already shipped in `ListDetailPage.tsx` — kept as-is.

## What's still missing (priorities for next session)

### High value, well-scoped
- **The Moment hero with AI synthesis** — Mode 1 (new idea coalescing) and Mode 2b (long-dormant *reshape*) both need a Gemini call. Pattern: new `api/moment.ts` endpoint that scores all four modes 0-100 and returns the winner with copy. The home should swap KeepGoingCard for The Moment when score ≥ 70.
- **Voice-note intent extraction at capture time** — when `useMediaRecorderVoice` finishes, run a tiny Gemini classifier (`project idea | frustration | reflection | taste signal`) and tag the resulting memory. Powers Modes 1 + 3.
- **Per-project blocker prompt at session start** — FocusSummary captures blockers on session *end* when the session stalled. Better: on the next session's start screen, surface the previous blocker as the opening prompt. Powers Mode 2b reshape.

### Medium
- **File splits** — `pages/ListDetailPage.tsx` (2081), `ProjectDetailPage.tsx` (1034), `pages/MemoriesPage.tsx` (892), `components/home/ConsumingWidget.tsx` (931), `components/home/ProjectIdeasHome.tsx` (838) — all over CLAUDE.md's 300-line guideline. Each splits cleanly into 2-3 files.
- **GET `?resource=project-ideas` should accept feeling** — currently only POST regen honors feeling. A query param + server-side re-rank of the pending queue gives feeling-aware ideas without a fresh LLM call.
- **Reading reactions don't surface anywhere yet** — they're stored, nothing consumes them. The Moment's identity layer should weight them: an article tagged `reaction:made_want_make` is a hot Mode 3 signal.

### Hygiene
- The `Fix Queue` is still marked "needs review — owner doesn't actively use this" in CLAUDE.md. Confirm with owner: keep, delete the routes, or hide behind a flag.

## Verification before pushing
- Ran no tests / no build yet — do it next.
- `npm run type-check` and `npm run build` in `projects/polymath/` before opening a PR.
