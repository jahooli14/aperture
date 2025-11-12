-- Add feedback loop columns to bedtime_prompts
-- Enables tracking what works for each user to personalize future prompts

-- Add format column (prompt variety)
ALTER TABLE bedtime_prompts
ADD COLUMN IF NOT EXISTS format TEXT CHECK (format IN ('question', 'statement', 'visualization', 'scenario'));

-- Add user feedback columns
ALTER TABLE bedtime_prompts
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS resulted_in_breakthrough BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_memory_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_bedtime_prompts_rating ON bedtime_prompts(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bedtime_prompts_breakthrough ON bedtime_prompts(resulted_in_breakthrough) WHERE resulted_in_breakthrough = true;

-- Update comment
COMMENT ON TABLE bedtime_prompts IS 'Bedtime prompts with feedback tracking for personalized learning';
COMMENT ON COLUMN bedtime_prompts.format IS 'Prompt format: question, statement, visualization, or scenario';
COMMENT ON COLUMN bedtime_prompts.rating IS 'User rating 1-5 stars';
COMMENT ON COLUMN bedtime_prompts.resulted_in_breakthrough IS 'Did this prompt lead to a breakthrough insight?';
COMMENT ON COLUMN bedtime_prompts.follow_up_memory_ids IS 'Memories created as follow-up to this prompt';
COMMENT ON COLUMN bedtime_prompts.user_notes IS 'Optional user notes about the prompt';
