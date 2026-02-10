-- Track effectiveness of each prompt type per user
CREATE TABLE IF NOT EXISTS prompt_type_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('connection', 'divergent', 'revisit', 'transform')),
  shown_count INTEGER DEFAULT 0,
  breakthrough_count INTEGER DEFAULT 0,
  score REAL DEFAULT 0.25,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, prompt_type)
);

ALTER TABLE prompt_type_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scores" ON prompt_type_scores
  FOR ALL USING (auth.uid() = user_id);
