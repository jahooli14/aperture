-- Synthesis Insights Cache
-- Stores Gemini-generated "so what" insights per user.
-- Single row per user, upserted on every generation.

CREATE TABLE IF NOT EXISTS synthesis_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insights JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE synthesis_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own insights" ON synthesis_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage insights" ON synthesis_insights
  FOR ALL USING (true);
