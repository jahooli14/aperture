-- Daily voice note reminder: web push subscriptions + per-user schedule.
-- push_subscriptions already referenced (but never migrated) by
-- api/cron/jobs.ts for the bedtime push — creating it here makes that
-- code path actually work, and backs the new voice-note reminder too.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (true);

COMMENT ON TABLE push_subscriptions IS 'Web Push subscriptions (browser/PWA) for bedtime + voice-note reminders.';

CREATE TABLE IF NOT EXISTS voice_reminder_settings (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  hour INT NOT NULL DEFAULT 9,
  minute INT NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  last_sent_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE voice_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminder settings"
  ON voice_reminder_settings FOR SELECT
  USING (true);

CREATE POLICY "Users can upsert their own reminder settings"
  ON voice_reminder_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own reminder settings"
  ON voice_reminder_settings FOR UPDATE
  USING (true);

COMMENT ON TABLE voice_reminder_settings IS 'Per-user schedule for the daily "record a voice note" push reminder.';
