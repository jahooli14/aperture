# Next session

Done (Oct 2026 simplification): two-sided home card, move say-box replaces Guide, onboarding→first move/question, clutter and dead pages/jobs removed. See CLAUDE.md "What changed in the Oct 2026 simplification".

## Still open
- **Security:** `memories` and `reading_queue` readable by any signed-in user on production. Check `select tablename, policyname, qual from pg_policies where tablename in ('memories','reading_queue')`; policies should be `user_id = auth.uid()`.
- Rotate the Gemini and Supabase service keys pasted in chat.
- Untested live: onboarding conversation prompts, `startThingsMoving`, `loadFocus` question bias.
- Not built: contextual "push past your first answer" follow-up; Thought of the day rotating by originality.
- Undecided: merge bedtime prompt into the daily question; Reading tabs 6→3; settings admin buttons.
- `ProjectIdeasHome` kept as the one on-demand "suggest a project".

## Left from the Oct 2026 code review (low risk, not fixed)
- `joints` is still a corpus table in `embeddings-maintenance.ts`, `embedding-coverage.ts` and `scripts/rebuild-embeddings.ts`; nothing reads it now.
- Dead: `reshapeDormantProjects` (project-maintenance.ts), `morningEnabled` fields in `useNotificationSettings`, `AutoSuggestionContext` (calls a handler that doesn't exist), the `'fix'` list type, `BUTTON_AUDIT.md`, and comments naming deleted files.
- `openVoiceCapture` is ignored while any dialog is open (FAB hidden).
- `say` is a read-modify-write on project metadata; two fast taps can double-write (the UI disables the button while sending).
- Small tap targets (~12px text buttons) on Home and the project page.
