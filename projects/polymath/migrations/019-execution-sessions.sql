-- 019-execution-sessions.sql
--
-- Foundation for the execution rebuild (see SPEC.md). Adds the session
-- contract's state and a `sessions` table. Nothing here touches the old
-- home surface — it's additive so the old and new models can run side by
-- side until the home rebuild lands.
--
-- Design notes (see SPEC.md for the full rationale):
--   - `state` supersedes `is_priority` as the source of truth for "what am
--     I executing." Existing projects default to 'mull' rather than being
--     auto-mapped from is_priority — the user makes a fresh declaration on
--     first run ("the app never picks it"), so nothing needs pre-sorting.
--   - `last_closeout_text` / `last_session_ended_at` together are what the
--     spec calls "last_stopped_at" — split into two columns because the
--     re-entry playback needs the words, and the re-ask/drift logic needs
--     the timestamp, and conflating them in one column name was a spec bug.
--   - `mvs_minutes` starts null (unseeded). Seeded once by the user on a
--     project's first session, then replaced by the measured value once
--     three "moved" sessions exist (see sessions.moved below).
--   - `slots` is JSONB: [{ name, filled: bool, filled_by_fragment_id }].
--     Modelled loosely on purpose — the slot vocabulary is expected to
--     evolve; a rigid schema here would need a migration per new slot type.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'mull'
    CHECK (state IN ('live', 'on-deck', 'mull', 'harvested')),
  ADD COLUMN IF NOT EXISTS mvs_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS last_closeout_text TEXT,
  ADD COLUMN IF NOT EXISTS last_session_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Only one live project per user, mirroring the old single-priority
-- constraint. A trigger (not a partial unique index) because "make this
-- one live" needs to *demote* the previous one atomically, not fail.
CREATE OR REPLACE FUNCTION enforce_single_live_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.state = 'live' THEN
    UPDATE projects
    SET state = 'on-deck'
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND state = 'live';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_single_live_project_trigger ON projects;
CREATE TRIGGER enforce_single_live_project_trigger
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_live_project();

CREATE INDEX IF NOT EXISTS idx_projects_state ON projects(user_id, state);

-- ─── sessions ───────────────────────────────────────────────────────────
-- Append-only. A session with ended_at = NULL and started_at older than a
-- few hours is a "deferred close-out" candidate, surfaced on next app open
-- rather than lost (see SPEC.md "Closing").

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  window_minutes INTEGER,          -- what the user said they had, if anything

  items JSONB NOT NULL DEFAULT '[]'::jsonb,   -- the 1-3 agreed shapes

  closeout_text TEXT,              -- the voice note, verbatim
  moved BOOLEAN,                   -- classified from closeout_text; null until closed

  source TEXT NOT NULL DEFAULT 'live'
    CHECK (source IN ('live', 'ondeck', 'shelf', 'different-thing', 'retro')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC);
-- Fast lookup for "any session waiting on a deferred close-out".
CREATE INDEX IF NOT EXISTS idx_sessions_pending_closeout
  ON sessions(user_id, started_at) WHERE ended_at IS NULL;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
CREATE POLICY "Users can view their own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own sessions" ON sessions;
CREATE POLICY "Users can insert their own sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;
CREATE POLICY "Users can update their own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own sessions" ON sessions;
CREATE POLICY "Users can delete their own sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
