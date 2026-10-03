# Next session

Done (Oct 2026 simplification): two-sided home card, move say-box replaces Guide, onboarding→first move/question, clutter and dead pages/jobs removed. See CLAUDE.md "What changed in the Oct 2026 simplification".

## Still open
- **Security:** `memories` and `reading_queue` readable by any signed-in user on production. Check `select tablename, policyname, qual from pg_policies where tablename in ('memories','reading_queue')`; policies should be `user_id = auth.uid()`.
- Rotate the Gemini and Supabase service keys pasted in chat.
- Untested live: onboarding conversation prompts, `startThingsMoving`, `loadFocus` question bias.
- Not built: contextual "push past your first answer" follow-up; Thought of the day rotating by originality.
- Undecided: merge bedtime prompt into the daily question; Reading tabs 6→3; settings admin buttons.
- `ProjectIdeasHome` kept as the one on-demand "suggest a project".
