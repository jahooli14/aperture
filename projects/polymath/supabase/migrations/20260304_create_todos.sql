-- ============================================================
-- Todos: Things 3-inspired task management for Polymath
-- Features: NLP-friendly, scheduled/deadline dates, areas,
--           soft deletes, links to memories & projects
-- ============================================================

-- Areas (like Things 3 Areas of Responsibility)
CREATE TABLE IF NOT EXISTS todo_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,        -- Emoji or Lucide icon name
  color TEXT,       -- Hex color for the area
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE todo_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own areas"
  ON todo_areas FOR ALL
  USING (user_id = current_user)
  WITH CHECK (user_id = current_user);

-- Main todos table
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Core fields
  text TEXT NOT NULL,
  notes TEXT,                           -- Optional longer description
  done BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,               -- Soft delete (Logbook uses done, trash uses this)

  -- Scheduling (Things 3 style: when vs deadline)
  scheduled_date DATE,                  -- "When": the day you intend to work on it
  deadline_date DATE,                   -- Hard deadline (shows red warning)

  -- Organisation
  area_id UUID REFERENCES todo_areas(id) ON DELETE SET NULL,
  project_id TEXT,                      -- Optional link to Polymath project
  tags TEXT[] NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,  -- 0=none, 1=low, 2=medium, 3=high

  -- Time & effort
  estimated_minutes INTEGER,

  -- Polymath integrations
  source_memory_id TEXT,                -- Linked memory that spawned this todo

  -- Ordering (manual sort within a view)
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own todos"
  ON todos FOR ALL
  USING (user_id = current_user)
  WITH CHECK (user_id = current_user);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_scheduled_date_idx ON todos(user_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS todos_done_idx ON todos(user_id, done) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS todos_area_idx ON todos(area_id) WHERE deleted_at IS NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_todos_updated_at();

CREATE TRIGGER todo_areas_updated_at
  BEFORE UPDATE ON todo_areas
  FOR EACH ROW EXECUTE FUNCTION update_todos_updated_at();
