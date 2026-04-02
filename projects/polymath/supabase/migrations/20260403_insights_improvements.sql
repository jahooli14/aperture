-- Insights improvements:
-- 1. Append-only history of past insight generations per user
-- 2. Feedback column on synthesis_insights for user ratings

CREATE TABLE IF NOT EXISTS synthesis_insights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insights JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  item_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE synthesis_insights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own insight history" ON synthesis_insights_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage insight history" ON synthesis_insights_history
  FOR ALL USING (true);

-- feedback: maps insight title -> 'up' | 'down', persists across regenerations
ALTER TABLE synthesis_insights
  ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}';
