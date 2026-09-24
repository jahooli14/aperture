-- What you made. One row per photo, screenshot or audio clip attached to a
-- project, usually at the end of a session.
--
-- The mirror counts hours. This is the other half: the actual things. A
-- wall of real outputs per project is what makes coming back feel worth it,
-- and it gives the next session something concrete to pick up from.
--
-- Its own table rather than projects.metadata: several writers replace
-- metadata wholesale from a client-side cache (the PATCH route, the offline
-- sync queue), so anything the server appended there could be silently
-- dropped by a stale copy on another device.
--
-- The files live in the existing public `thought-images` bucket; `path` is
-- the object name there. Until this runs, the API reports the feature as
-- unavailable and the UI hides it.

CREATE TABLE IF NOT EXISTS project_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_outputs_project
  ON project_outputs(project_id, created_at DESC);

ALTER TABLE project_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own outputs" ON project_outputs;
CREATE POLICY "Users manage their own outputs"
  ON project_outputs FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
