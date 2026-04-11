-- Weekly Intersections Cache + History
--
-- The intersections section on the home page used to regenerate cards on every
-- cache miss, blowing latency and leaving users staring at nothing. We now
-- generate cards once a week via the daily cron's Monday branch and persist
-- them here so the GET endpoint can return instantly with no AI calls.
--
-- Two tables:
--   weekly_intersections          — current week's cards (one row per user)
--   weekly_intersections_history  — append-only archive of past weeks, used
--                                   to steer future generations (avoid disliked
--                                   themes, lean into liked ones).
--
-- Mirrors the synthesis_insights / synthesis_insights_history pattern from
-- 20260403_insights_improvements.sql.

CREATE TABLE IF NOT EXISTS weekly_intersections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  intersections JSONB NOT NULL DEFAULT '[]',     -- "mashups" deck
  insights JSONB NOT NULL DEFAULT '[]',          -- AI-discovered patterns deck
  feedback JSONB NOT NULL DEFAULT '{}',          -- { card_id: 'good' | 'bad' }
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,               -- generated_at + 7 days
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weekly_intersections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own weekly_intersections" ON weekly_intersections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage weekly_intersections" ON weekly_intersections
  FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS weekly_intersections_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intersections JSONB NOT NULL,
  insights JSONB NOT NULL,
  feedback JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weekly_intersections_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own weekly_intersections_history" ON weekly_intersections_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage weekly_intersections_history" ON weekly_intersections_history
  FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS weekly_intersections_history_user_idx
  ON weekly_intersections_history (user_id, generated_at DESC);
