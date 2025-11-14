-- Add 'incubation' format to bedtime_prompts
-- Incubation format is for dream seeding: seed + sensory anchor + permission to release

-- Update format constraint to include 'incubation'
ALTER TABLE bedtime_prompts
DROP CONSTRAINT IF EXISTS bedtime_prompts_format_check;

ALTER TABLE bedtime_prompts
ADD CONSTRAINT bedtime_prompts_format_check
CHECK (format IN ('question', 'statement', 'visualization', 'scenario', 'incubation'));

-- Update comment
COMMENT ON COLUMN bedtime_prompts.format IS 'Prompt format: question, statement, visualization, scenario, or incubation (dream seeding)';
