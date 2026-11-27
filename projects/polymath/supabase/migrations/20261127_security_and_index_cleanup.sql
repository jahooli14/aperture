-- Supabase advisor clean-up (Nov 2026). Safe to re-run.

-- 1. handle_new_user() is a signup trigger, not something the public API should call.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. Pin search_path on public functions that had none. `public` stays on the
--    path so the pgvector operators the match_* functions use still resolve.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_todos_updated_at','enforce_single_priority','match_ie_ideas','calculate_mode_entropy',
        'search_similar_projects','get_neglected_domain_pairs','search_similar_capabilities',
        'update_updated_at_column','find_similar_tag','increment_tag_usage','update_project_last_active',
        'get_memory_progress','has_unlocked_projects','get_days_dormant','match_memory_responses',
        'match_projects','match_reading','match_list_items','match_memories','get_item_connections',
        'get_item_thread','update_project_metadata','handle_new_user','enforce_single_live_project')
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.sig);
  END LOOP;
END $$;

-- 3. Identical duplicate indexes: keep one of each pair.
DROP INDEX IF EXISTS public.idx_ie_domain_pairs_user_id;
DROP INDEX IF EXISTS public.idx_ie_feedback_summaries_user_id;
DROP INDEX IF EXISTS public.idx_ie_frontier_blocks_user_id;
DROP INDEX IF EXISTS public.idx_ie_generation_batches_user_id;
DROP INDEX IF EXISTS public.idx_ie_ideas_user_id;
DROP INDEX IF EXISTS public.idx_ie_mode_stats_user_id;
DROP INDEX IF EXISTS public.idx_ie_rejection_patterns_user_id;
DROP INDEX IF EXISTS public.memories_created_at_idx;
DROP INDEX IF EXISTS public.memories_embedding_idx;
