-- Capability pair learning: tracks which capability combinations the user likes
CREATE TABLE IF NOT EXISTS capability_pair_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  capability_a TEXT NOT NULL,
  capability_b TEXT NOT NULL,
  spark_count INTEGER DEFAULT 0,
  meh_count INTEGER DEFAULT 0,
  built_count INTEGER DEFAULT 0,
  weight REAL DEFAULT 0.0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, capability_a, capability_b)
);

ALTER TABLE capability_pair_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pair scores" ON capability_pair_scores
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_cap_pair_user ON capability_pair_scores(user_id);
CREATE INDEX idx_cap_pair_weight ON capability_pair_scores(user_id, weight DESC);
