-- Knowledge Map State Table
-- Stores the complete state of each user's knowledge map
CREATE TABLE IF NOT EXISTS knowledge_map_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  map_data JSONB NOT NULL, -- Stores cities, roads, viewport
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One map per user
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_map_user ON knowledge_map_state(user_id);

-- RLS policies
ALTER TABLE knowledge_map_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own map"
  ON knowledge_map_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own map"
  ON knowledge_map_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own map"
  ON knowledge_map_state FOR UPDATE
  USING (auth.uid() = user_id);
