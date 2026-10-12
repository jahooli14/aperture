-- The weekend nudge: one push on a Saturday morning naming a project that's
-- been waiting, with a link to its catch-up. Off unless turned on in
-- Settings. Its own table rather than columns on voice_reminder_settings:
-- that row's `enabled` defaults to true, so creating it to hold this
-- setting would quietly switch the daily voice reminder on too.

CREATE TABLE IF NOT EXISTS weekend_nudge_settings (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  last_sent_date DATE,
  last_project_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE weekend_nudge_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekend nudge settings"
  ON weekend_nudge_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekend nudge settings"
  ON weekend_nudge_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekend nudge settings"
  ON weekend_nudge_settings FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE weekend_nudge_settings IS 'Opt-in Saturday push naming one project that has been waiting.';
