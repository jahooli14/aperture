-- Migration: Tag all existing data to dmahorgan@gmail.com
-- The app was single-user with a hardcoded fallback user ID.
-- Now that auth is enforced, all existing data needs to be linked
-- to the actual Supabase auth user for dmahorgan@gmail.com.

DO $$
DECLARE
  target_user_id UUID;
  old_user_id UUID := 'f2404e61-2010-46c8-8edd-b8a3e702f0fb';
BEGIN
  -- Look up the real auth user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'dmahorgan@gmail.com'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User dmahorgan@gmail.com not found in auth.users — skipping migration';
    RETURN;
  END IF;

  RAISE NOTICE 'Migrating data from % to % (dmahorgan@gmail.com)', old_user_id, target_user_id;

  -- Core content tables
  UPDATE memories SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE projects SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE reading_queue SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE lists SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE todos SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;

  -- Relationship / metadata tables
  UPDATE connections SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE bridges SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE user_prompt_status SET user_id = target_user_id WHERE user_id = old_user_id;
  UPDATE memory_responses SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL;
  UPDATE knowledge_map_state SET user_id = target_user_id WHERE user_id = old_user_id;

  -- Feature tables (may not exist yet — use exception handling)
  BEGIN UPDATE rss_feeds SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE capabilities SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE bedtime_prompts SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE daily_power_hour SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE insights_cache SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE capability_pairs SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE prompt_type_scores SET user_id = target_user_id WHERE user_id = old_user_id OR user_id IS NULL; EXCEPTION WHEN undefined_table THEN NULL; END;

  RAISE NOTICE 'Migration complete — all data now belongs to %', target_user_id;
END $$;
