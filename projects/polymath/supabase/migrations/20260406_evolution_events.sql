-- Evolution events — stores AI-generated evolution insights for the Evolution Feed.
-- Referenced by EvolutionFeed component via /api/projects?resource=evolution-feed
-- and written by the nightly evolve cron + the evolve resource handler.

CREATE TABLE IF NOT EXISTS evolution_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('intersection', 'reshape', 'reflection')),
  highlight   BOOLEAN DEFAULT false,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evolution_events_user ON evolution_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_events_project ON evolution_events (project_id);
