-- Per-writer timezone and the streak-loss nudge's own state.
--
--   timezone                  — IANA name (e.g. 'Europe/London'), captured
--                                from the browser. Null means "don't nudge
--                                this person" rather than guessing UTC.
--   last_streak_alert_sent_on — the LOCAL date (in that timezone) the 6pm
--                                nudge last fired, so an hourly check can
--                                never send it twice in one day.

alter table relay.story_members add column if not exists timezone text;
alter table relay.story_members add column if not exists last_streak_alert_sent_on date;
