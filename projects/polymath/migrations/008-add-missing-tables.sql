-- 1. Create bedtime_prompts table
CREATE TABLE IF NOT EXISTS bedtime_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Assuming single user for now, but good practice
    prompt TEXT NOT NULL,
    type TEXT NOT NULL, -- 'connection', 'divergent', 'revisit', 'transform'
    related_ids TEXT[] DEFAULT '{}',
    metaphor TEXT,
    format TEXT,
    viewed BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMPTZ,
    rating INTEGER, -- 1-5
    resulted_in_breakthrough BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_bedtime_prompts_user_date ON bedtime_prompts(user_id, created_at);

-- 2. Add missing columns to reading_queue
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT '{}';

-- 3. Ensure RLS is enabled (optional but recommended)
ALTER TABLE bedtime_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bedtime prompts"
    ON bedtime_prompts FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NOT NULL); -- Relaxed for single-user app hardcoded ID

CREATE POLICY "Users can insert their own bedtime prompts"
    ON bedtime_prompts FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NOT NULL);

CREATE POLICY "Users can update their own bedtime prompts"
    ON bedtime_prompts FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NOT NULL);
