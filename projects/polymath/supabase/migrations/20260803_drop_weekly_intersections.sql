-- Drop the weekly intersections cache — the backend (api/_lib/intersection-weekly.ts,
-- the `resource=intersections` API, and the daily cron's generation step) has been
-- removed. It generated a "mashups"/"insights" deck nightly via Gemini, but no
-- frontend surface ever read `resource=intersections` — pure orphaned spend.
-- Undoes 20260411_weekly_intersections.sql.
--
-- The shared intersection-discovery brain (api/_lib/intersection-engine.ts,
-- intersection-critic.ts) stays — it's still used by the live synthesis feature.

DROP TABLE IF EXISTS weekly_intersections_history;
DROP TABLE IF EXISTS weekly_intersections;
