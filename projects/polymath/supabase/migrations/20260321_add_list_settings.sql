-- Add per-list settings column for status configuration
-- Allows toggling status tracking on/off and customising status labels per list
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
