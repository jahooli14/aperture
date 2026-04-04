-- Polymath Metabolism migration
-- Adds: heat score, catalysts, lineage to projects
--       drawer_digests table (weekly surfacing letter)
--       project_retrospectives table (completion ritual)

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS heat_score       REAL        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heat_reason      TEXT,
  ADD COLUMN IF NOT EXISTS heat_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalysts        JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_id        UUID        REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lineage_root_id  UUID        REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_heat
  ON projects (user_id, heat_score DESC)
  WHERE status NOT IN ('completed', 'archived', 'abandoned', 'graveyard');

CREATE INDEX IF NOT EXISTS idx_projects_lineage
  ON projects (lineage_root_id);

CREATE INDEX IF NOT EXISTS idx_projects_priority
  ON projects (user_id, is_priority)
  WHERE is_priority = true;

-- Drawer digest weekly snapshots
CREATE TABLE IF NOT EXISTS drawer_digests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  warmed          JSONB DEFAULT '[]'::jsonb,
  evolutions      JSONB DEFAULT '[]'::jsonb,
  snapshot_prompt JSONB,
  status          TEXT DEFAULT 'unread' CHECK (status IN ('unread','read','acted'))
);

CREATE INDEX IF NOT EXISTS idx_drawer_digests_user
  ON drawer_digests (user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_drawer_digests_unread
  ON drawer_digests (user_id)
  WHERE status = 'unread';

-- Project retrospectives (completion ritual answers)
CREATE TABLE IF NOT EXISTS project_retrospectives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  answers     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retros_project
  ON project_retrospectives (project_id);

CREATE INDEX IF NOT EXISTS idx_retros_user
  ON project_retrospectives (user_id, created_at DESC);
