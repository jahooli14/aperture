-- Bedtime Prompts Table
-- Stores trippy prompts for creative subconscious thinking

CREATE TABLE IF NOT EXISTS bedtime_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('connection', 'divergent', 'revisit', 'transform')),
  related_ids UUID[] DEFAULT '{}',
  metaphor TEXT,
  viewed BOOLEAN DEFAULT false,
  viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_bedtime_prompts_user_id ON bedtime_prompts(user_id);
CREATE INDEX idx_bedtime_prompts_created_at ON bedtime_prompts(created_at DESC);
CREATE INDEX idx_bedtime_prompts_viewed ON bedtime_prompts(viewed) WHERE viewed = false;

-- Enable RLS
ALTER TABLE bedtime_prompts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own prompts"
  ON bedtime_prompts FOR SELECT
  USING (true);

CREATE POLICY "System can insert prompts"
  ON bedtime_prompts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own prompts"
  ON bedtime_prompts FOR UPDATE
  USING (true);

COMMENT ON TABLE bedtime_prompts IS 'Trippy prompts for bedtime creative thinking (9:30pm daily)';
