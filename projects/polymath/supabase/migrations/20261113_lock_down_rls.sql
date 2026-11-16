-- Lock every Polymath table to its owner.
--
-- Why: the anon key ships in the browser bundle, so anything PostgREST can
-- reach with it is public. Across the migrations:
--   - memories (every voice note) never had RLS enabled at all;
--   - reading_queue, article_highlights, bedtime_prompts, push_subscriptions,
--     voice_reminder_settings were USING (true) ("open for now since
--     single-user");
--   - connections kept 006's USING (true) next to 007's owner policies
--     (policies OR together, so the open one wins);
--   - synthesis_insights(_history) had "service role" policies with no TO
--     clause, which means every role;
--   - rss_feeds had an insert WITH CHECK (true);
--   - todos compared user_id to current_user (the Postgres role name).
-- Plus tables made in the dashboard (user_settings, bridges, ...) that no
-- migration here describes.
--
-- What this does, for every table in public (Polymath has its own Supabase
-- project, so public is all Polymath + the idea engine):
--   1. enable RLS;
--   2. drop every existing policy;
--   3. if the table has user_id: one owner-only policy for signed-in users;
--      otherwise no policy (server-only: the API uses the service role, which
--      skips RLS, so the server is unaffected either way).
-- Views are switched to security_invoker so they obey the same rules.
-- Storage: thought-images stays a public bucket (public URLs still work), but
-- nobody can list, upload to or delete from it except the server, which mints
-- signed upload URLs.
--
-- Safe to re-run.

DO $$
DECLARE
  t record;
  pol record;
  col_type text;
  owner_expr text;
BEGIN
  FOR t IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.name);

      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t.name
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t.name);
      END LOOP;

      SELECT data_type INTO col_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t.name AND column_name = 'user_id';

      IF col_type IS NULL THEN
        RAISE NOTICE '%: no user_id, server-only', t.name;
        CONTINUE;
      END IF;

      owner_expr := CASE WHEN col_type = 'uuid'
        THEN 'user_id = (select auth.uid())'
        ELSE 'user_id = (select auth.uid())::text'
      END;

      EXECUTE format(
        'CREATE POLICY owner_only ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        t.name, owner_expr, owner_expr
      );
    EXCEPTION WHEN insufficient_privilege THEN
      -- Extension-owned tables (e.g. spatial_ref_sys) can't be altered here.
      RAISE NOTICE '%: skipped (not owner)', t.name;
    END;
  END LOOP;
END $$;

-- Views run as their owner and skip RLS unless told otherwise.
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.name);
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'view %: skipped (not owner)', v.name;
    END;
  END LOOP;
END $$;

-- Storage: only the server touches thought-images.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Check: every row here should read rls = true, and every policy should be
-- owner_only. Anything else is still open.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls,
  coalesce(string_agg(p.policyname || ' [' || array_to_string(p.roles, ',') || '] ' || coalesce(p.qual, ''), '; '), '(none: server-only)') AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;
